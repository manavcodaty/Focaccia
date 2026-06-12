begin;

alter table public.gate_devices
  add column sync_public_key text,
  add column key_version integer not null default 1,
  add column revoked_at timestamp with time zone,
  add column last_seen_at timestamp with time zone,
  add constraint gate_devices_sync_public_key_format_check check (
    sync_public_key is null or sync_public_key ~ '^[A-Za-z0-9_-]{43}$'
  ),
  add constraint gate_devices_key_version_check check (key_version > 0);

create table public.gate_sync_nonces (
  gate_device_id uuid not null references public.gate_devices (id) on delete restrict,
  nonce text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  used_at timestamp with time zone not null default now(),
  primary key (gate_device_id, nonce),
  constraint gate_sync_nonces_gate_idempotency_key unique (gate_device_id, idempotency_key),
  constraint gate_sync_nonces_nonce_check check (nonce ~ '^[A-Za-z0-9_-]{22}$'),
  constraint gate_sync_nonces_hash_check check (request_hash ~ '^[a-f0-9]{64}$')
);

create table public.gate_checkins (
  id uuid primary key default gen_random_uuid(),
  gate_device_id uuid not null references public.gate_devices (id) on delete restrict,
  ticket_id uuid not null references public.event_tickets (id) on delete restrict,
  event_id text not null,
  pass_id text not null,
  decision text not null,
  gate_timestamp timestamp with time zone not null,
  nonce text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  received_at timestamp with time zone not null default now(),
  constraint gate_checkins_decision_check check (decision = 'ACCEPT'),
  constraint gate_checkins_nonce_check check (nonce ~ '^[A-Za-z0-9_-]{22}$'),
  constraint gate_checkins_hash_check check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint gate_checkins_event_pass_fkey foreign key (event_id, pass_id)
    references public.event_passes (event_id, pass_id) on delete restrict,
  constraint gate_checkins_event_pass_key unique (event_id, pass_id),
  constraint gate_checkins_gate_idempotency_key unique (gate_device_id, idempotency_key)
);

create index gate_checkins_event_received_idx
  on public.gate_checkins (event_id, received_at desc);

alter table public.gate_sync_nonces enable row level security;
alter table public.gate_sync_nonces force row level security;
alter table public.gate_checkins enable row level security;
alter table public.gate_checkins force row level security;
revoke all on table public.gate_sync_nonces from anon, authenticated;
revoke all on table public.gate_checkins from anon, authenticated;
grant select on table public.gate_checkins to authenticated;

create policy gate_checkins_organizer_owner_select
  on public.gate_checkins for select to authenticated
  using (public.owns_event(event_id));

drop policy gate_devices_owner_select on public.gate_devices;
create policy gate_devices_organizer_owner_select
  on public.gate_devices for select to authenticated
  using (public.owns_event(event_id));

create or replace function public.enforce_event_capacity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allocated integer;
begin
  if new.capacity = old.capacity then
    return new;
  end if;
  select count(*) into allocated
  from public.event_tickets
  where event_id = old.event_id and status in ('claimed', 'enrolled', 'checked_in');
  if new.capacity < allocated then
    raise exception using errcode = '23514', message = 'capacity_below_allocated';
  end if;
  return new;
end;
$$;

create trigger events_capacity_guard
before update of capacity on public.events
for each row execute function public.enforce_event_capacity_update();

create or replace function public.sync_default_ticket_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.event_ticket_types
  set capacity = new.capacity
  where event_id = new.event_id and is_default;
  return new;
end;
$$;

create trigger events_default_ticket_capacity_sync
after update of capacity on public.events
for each row execute function public.sync_default_ticket_capacity();

create or replace function public.enforce_ticket_type_capacity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allocated integer;
begin
  if new.capacity is null or new.capacity is not distinct from old.capacity then
    return new;
  end if;
  select count(*) into allocated
  from public.event_tickets
  where ticket_type_id = old.id and status in ('claimed', 'enrolled', 'checked_in');
  if new.capacity < allocated then
    raise exception using errcode = '23514', message = 'capacity_below_allocated';
  end if;
  return new;
end;
$$;

create trigger event_ticket_types_capacity_guard
before update of capacity on public.event_ticket_types
for each row execute function public.enforce_ticket_type_capacity_update();

create or replace function public.record_gate_checkin(
  p_gate_device_id uuid,
  p_event_id text,
  p_pass_id text,
  p_decision text,
  p_gate_timestamp timestamp with time zone,
  p_nonce text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  gate public.gate_devices;
  selected_event public.events;
  selected_pass public.event_passes;
  ticket public.event_tickets;
  idem public.idempotency_records;
  nonce_row public.gate_sync_nonces;
  existing_checkin public.gate_checkins;
  created_checkin public.gate_checkins;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_decision <> 'ACCEPT' then
    raise exception using errcode = '22023', message = 'invalid_gate_decision';
  end if;

  select * into gate from public.gate_devices
  where id = p_gate_device_id and event_id = p_event_id
  for update;
  if gate.id is null or gate.revoked_at is not null or gate.sync_public_key is null then
    raise exception using errcode = 'P0001', message = 'unknown_gate_key';
  end if;

  select * into selected_event from public.events where event_id = p_event_id;
  if selected_event.event_id is null then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;
  if p_gate_timestamp > now() + interval '5 minutes'
     or p_gate_timestamp < now() - interval '72 hours'
     or p_gate_timestamp < selected_event.starts_at - interval '24 hours'
     or p_gate_timestamp > selected_event.ends_at + interval '24 hours'
     or p_gate_timestamp < gate.provisioned_at then
    raise exception using errcode = 'P0001', message = 'stale_gate_timestamp';
  end if;

  idem := public.lock_idempotency(
    'gate:' || gate.id::text, 'record-gate-checkin', p_idempotency_key, p_request_hash
  );
  if idem.state = 'completed' then
    select * into existing_checkin from public.gate_checkins where id::text = idem.resource_id;
    return jsonb_build_object('idempotent_replay', true, 'checkin', to_jsonb(existing_checkin));
  end if;

  select * into nonce_row from public.gate_sync_nonces
  where gate_device_id = gate.id and nonce = p_nonce
  for update;
  if nonce_row.gate_device_id is not null then
    if nonce_row.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'gate_nonce_replay';
    end if;
  else
    begin
      insert into public.gate_sync_nonces (
        gate_device_id, nonce, idempotency_key, request_hash
      ) values (
        gate.id, p_nonce, p_idempotency_key, p_request_hash
      );
    exception when unique_violation then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end;
  end if;

  select * into selected_pass from public.event_passes
  where event_id = p_event_id and pass_id = p_pass_id
  for update;
  if selected_pass.id is null then
    raise exception using errcode = 'P0001', message = 'pass_not_found';
  end if;
  select * into ticket from public.event_tickets where id = selected_pass.ticket_id for update;

  if selected_pass.status <> 'active' or ticket.status <> 'enrolled'
     or ticket.current_pass_id <> selected_pass.pass_id then
    raise exception using errcode = 'P0001', message = 'pass_not_active';
  end if;

  insert into public.gate_checkins (
    gate_device_id, ticket_id, event_id, pass_id, decision,
    gate_timestamp, nonce, idempotency_key, request_hash
  ) values (
    gate.id, ticket.id, p_event_id, p_pass_id, p_decision,
    p_gate_timestamp, p_nonce, p_idempotency_key, p_request_hash
  ) returning * into created_checkin;

  update public.event_passes set status = 'used', used_at = p_gate_timestamp
  where id = selected_pass.id;
  update public.event_tickets set status = 'checked_in', checked_in_at = p_gate_timestamp
  where id = ticket.id;
  update public.gate_devices set last_seen_at = now() where id = gate.id;
  insert into public.ticket_activity_log (
    ticket_id, event_id, actor_gate_device_id, activity_type,
    from_status, to_status, pass_id
  ) values (
    ticket.id, ticket.event_id, gate.id, 'checked_in',
    'enrolled', 'checked_in', p_pass_id
  );
  perform public.complete_idempotency(idem.id, 201, created_checkin.id::text);
  return jsonb_build_object('idempotent_replay', false, 'checkin', to_jsonb(created_checkin));
end;
$$;

revoke all on function public.record_gate_checkin(uuid, text, text, text, timestamp with time zone, text, uuid, text) from public;
grant execute on function public.record_gate_checkin(uuid, text, text, text, timestamp with time zone, text, uuid, text) to service_role;

alter publication supabase_realtime add table public.event_tickets;
alter publication supabase_realtime add table public.ticket_activity_log;
alter publication supabase_realtime add table public.gate_checkins;

commit;

begin;

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_scope text not null,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  state text not null default 'in_progress',
  response_status integer,
  resource_id text,
  response_ciphertext text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  expires_at timestamp with time zone not null default (now() + interval '2 minutes'),
  constraint idempotency_records_scope_operation_key_key unique (
    actor_scope, operation, idempotency_key
  ),
  constraint idempotency_records_scope_check check (char_length(actor_scope) between 3 and 200),
  constraint idempotency_records_operation_check check (operation ~ '^[a-z][a-z0-9_-]{1,63}$'),
  constraint idempotency_records_hash_check check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint idempotency_records_state_check check (state in ('in_progress', 'completed')),
  constraint idempotency_records_response_status_check check (
    response_status is null or response_status between 200 and 599
  )
);

create table public.api_rate_limits (
  actor_scope text not null,
  operation text not null,
  window_started_at timestamp with time zone not null default now(),
  request_count integer not null default 0,
  blocked_until timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  primary key (actor_scope, operation),
  constraint api_rate_limits_count_check check (request_count >= 0)
);

create trigger idempotency_records_set_updated_at
before update on public.idempotency_records
for each row execute function public.set_updated_at();

create trigger api_rate_limits_set_updated_at
before update on public.api_rate_limits
for each row execute function public.set_updated_at();

alter table public.idempotency_records enable row level security;
alter table public.idempotency_records force row level security;
alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limits force row level security;
revoke all on table public.idempotency_records from anon, authenticated;
revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.lock_idempotency(
  p_actor_scope text,
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns public.idempotency_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.idempotency_records;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_request_hash';
  end if;

  insert into public.idempotency_records (
    actor_scope, operation, idempotency_key, request_hash
  ) values (
    p_actor_scope, p_operation, p_idempotency_key, p_request_hash
  ) on conflict (actor_scope, operation, idempotency_key) do nothing;

  select * into result
  from public.idempotency_records
  where actor_scope = p_actor_scope
    and operation = p_operation
    and idempotency_key = p_idempotency_key
  for update;

  if result.request_hash <> p_request_hash then
    raise exception using errcode = 'P0001', message = 'idempotency_conflict';
  end if;

  return result;
end;
$$;

create or replace function public.complete_idempotency(
  p_id uuid,
  p_response_status integer,
  p_resource_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.idempotency_records
  set state = 'completed',
      response_status = p_response_status,
      resource_id = p_resource_id,
      completed_at = now(),
      expires_at = now()
  where id = p_id;
$$;

revoke all on function public.lock_idempotency(text, text, uuid, text) from public;
revoke all on function public.complete_idempotency(uuid, integer, text) from public;

create or replace function public.ensure_attendee_profile(p_full_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_email text;
  profile public.attendee_profiles;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if char_length(btrim(coalesce(p_full_name, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_full_name';
  end if;

  select lower(btrim(email)) into actor_email from auth.users where id = actor;
  if actor_email is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  insert into public.attendee_profiles (user_id, email, full_name)
  values (actor, actor_email, btrim(p_full_name))
  on conflict (user_id) do update set full_name = excluded.full_name
  returning * into profile;

  return jsonb_build_object(
    'user_id', profile.user_id,
    'email', profile.email,
    'full_name', profile.full_name,
    'created_at', profile.created_at,
    'updated_at', profile.updated_at
  );
end;
$$;

create or replace function public.create_event_with_default_ticket_type(
  p_event_id text,
  p_name text,
  p_description text,
  p_location text,
  p_capacity integer,
  p_is_listed boolean,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_join_code text,
  p_event_salt text,
  p_pk_sign_event text,
  p_signing_secret_ciphertext text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  created_event public.events;
  ticket_type public.event_ticket_types;
begin
  if actor is null or not public.is_organizer(actor) then
    raise exception using errcode = '42501', message = 'organizer_required';
  end if;

  insert into public.events (
    event_id, name, description, location, capacity, is_listed,
    starts_at, ends_at, join_code, event_salt, pk_sign_event, created_by
  ) values (
    btrim(p_event_id), btrim(p_name), btrim(coalesce(p_description, '')),
    btrim(coalesce(p_location, '')), p_capacity, p_is_listed,
    p_starts_at, p_ends_at, p_join_code, p_event_salt, p_pk_sign_event, actor
  ) returning * into created_event;

  insert into public.event_ticket_types (
    event_id, name, price_pence, currency, capacity, is_active, is_default, sort_order
  ) values (
    created_event.event_id, 'General Admission', 0, 'GBP', created_event.capacity, true, true, 0
  ) returning * into ticket_type;

  insert into public.edge_event_secrets (event_id, sk_sign_event_ciphertext)
  values (created_event.event_id, p_signing_secret_ciphertext);

  return jsonb_build_object(
    'event_id', created_event.event_id,
    'name', created_event.name,
    'description', created_event.description,
    'location', created_event.location,
    'capacity', created_event.capacity,
    'is_listed', created_event.is_listed,
    'starts_at', created_event.starts_at,
    'ends_at', created_event.ends_at,
    'join_code', created_event.join_code,
    'event_salt', created_event.event_salt,
    'pk_sign_event', created_event.pk_sign_event,
    'ticket_type', jsonb_build_object(
      'id', ticket_type.id,
      'name', ticket_type.name,
      'price_pence', ticket_type.price_pence,
      'currency', ticket_type.currency,
      'capacity', ticket_type.capacity
    )
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'event_or_join_code_exists';
end;
$$;

create or replace function public.manage_event_ticket_type(
  p_event_id text,
  p_ticket_type_id uuid,
  p_name text,
  p_description text,
  p_price_pence integer,
  p_capacity integer,
  p_is_active boolean,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.event_ticket_types;
  consuming integer;
begin
  if actor is null or not public.owns_event(p_event_id, actor) then
    raise exception using errcode = '42501', message = 'event_not_owned';
  end if;

  if p_ticket_type_id is null then
    insert into public.event_ticket_types (
      event_id, name, description, price_pence, currency, capacity, is_active, sort_order
    ) values (
      p_event_id, btrim(p_name), btrim(coalesce(p_description, '')),
      p_price_pence, 'GBP', p_capacity, p_is_active, p_sort_order
    ) returning * into result;
  else
    select count(*) into consuming
    from public.event_tickets
    where ticket_type_id = p_ticket_type_id
      and status in ('claimed', 'enrolled', 'checked_in');

    if p_capacity is not null and p_capacity < consuming then
      raise exception using errcode = '23514', message = 'capacity_below_allocated';
    end if;

    update public.event_ticket_types
    set name = btrim(p_name),
        description = btrim(coalesce(p_description, '')),
        price_pence = p_price_pence,
        capacity = p_capacity,
        is_active = p_is_active,
        sort_order = p_sort_order
    where id = p_ticket_type_id and event_id = p_event_id and not is_default
    returning * into result;

    if result.id is null then
      raise exception using errcode = 'P0001', message = 'ticket_type_not_found';
    end if;
  end if;

  return to_jsonb(result) - 'normalized_name';
end;
$$;

create or replace function public.claim_free_ticket(
  p_event_id text,
  p_ticket_type_id uuid,
  p_claim_code_digest text,
  p_claim_code_ciphertext text,
  p_claim_code_hint text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_scope text;
  idem public.idempotency_records;
  selected_event public.events;
  selected_type public.event_ticket_types;
  existing_ticket public.event_tickets;
  created_ticket public.event_tickets;
  event_count integer;
  type_count integer;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not exists (select 1 from public.attendee_profiles where user_id = actor) then
    raise exception using errcode = '42501', message = 'attendee_profile_required';
  end if;

  actor_scope := 'user:' || actor::text;
  idem := public.lock_idempotency(actor_scope, 'claim-free-ticket', p_idempotency_key, p_request_hash);
  if idem.state = 'completed' then
    select * into existing_ticket from public.event_tickets where id::text = idem.resource_id;
    return jsonb_build_object('idempotent_replay', true, 'ticket', to_jsonb(existing_ticket));
  end if;

  select * into selected_event
  from public.events
  where event_id = p_event_id
  for update;

  if selected_event.event_id is null or selected_event.deleted_at is not null or not selected_event.is_listed then
    raise exception using errcode = 'P0001', message = 'event_not_available';
  end if;
  if now() >= selected_event.ends_at then
    raise exception using errcode = 'P0001', message = 'event_ended';
  end if;

  select * into selected_type
  from public.event_ticket_types
  where id = p_ticket_type_id and event_id = p_event_id
  for update;

  if selected_type.id is null or not selected_type.is_active then
    raise exception using errcode = 'P0001', message = 'ticket_type_not_available';
  end if;
  if selected_type.price_pence > 0 then
    raise exception using errcode = 'P0001', message = 'paid_ticket_unavailable';
  end if;

  select * into existing_ticket
  from public.event_tickets
  where event_id = p_event_id and attendee_user_id = actor;
  if existing_ticket.id is not null then
    raise exception using errcode = '23505', message = 'ticket_already_exists';
  end if;

  select count(*) into event_count
  from public.event_tickets
  where event_id = p_event_id and status in ('claimed', 'enrolled', 'checked_in');
  if event_count >= selected_event.capacity then
    raise exception using errcode = 'P0001', message = 'event_sold_out';
  end if;

  if selected_type.capacity is not null then
    select count(*) into type_count
    from public.event_tickets
    where ticket_type_id = p_ticket_type_id and status in ('claimed', 'enrolled', 'checked_in');
    if type_count >= selected_type.capacity then
      raise exception using errcode = 'P0001', message = 'ticket_type_sold_out';
    end if;
  end if;

  insert into public.event_tickets (
    event_id, ticket_type_id, attendee_user_id, claim_code_digest,
    claim_code_ciphertext, claim_code_hint
  ) values (
    p_event_id, p_ticket_type_id, actor, p_claim_code_digest,
    p_claim_code_ciphertext, p_claim_code_hint
  ) returning * into created_ticket;

  insert into public.ticket_activity_log (
    ticket_id, event_id, actor_user_id, activity_type, to_status
  ) values (
    created_ticket.id, p_event_id, actor, 'claimed', 'claimed'
  );

  perform public.complete_idempotency(idem.id, 201, created_ticket.id::text);
  return jsonb_build_object('idempotent_replay', false, 'ticket', to_jsonb(created_ticket));
end;
$$;

create or replace function public.cancel_ticket(
  p_ticket_id uuid,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  idem public.idempotency_records;
  ticket public.event_tickets;
  previous_status text;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  idem := public.lock_idempotency('user:' || actor::text, 'cancel-ticket', p_idempotency_key, p_request_hash);
  if idem.state = 'completed' then
    select * into ticket from public.event_tickets where id::text = idem.resource_id;
    return jsonb_build_object('idempotent_replay', true, 'ticket', to_jsonb(ticket));
  end if;

  select * into ticket from public.event_tickets where id = p_ticket_id for update;
  if ticket.id is null or ticket.attendee_user_id <> actor then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;
  if ticket.status not in ('claimed', 'enrolled') then
    raise exception using errcode = 'P0001', message = 'ticket_state_conflict';
  end if;

  previous_status := ticket.status;
  if ticket.status = 'enrolled' and ticket.current_pass_id is not null then
    update public.event_passes
    set status = 'revoked', revoked_at = now()
    where event_id = ticket.event_id and pass_id = ticket.current_pass_id and status = 'active';
    insert into public.revocations (event_id, pass_id, ticket_id, reason, revoked_by)
    values (ticket.event_id, ticket.current_pass_id, ticket.id, 'ticket_cancelled', actor)
    on conflict (event_id, pass_id) do nothing;
  end if;

  update public.event_tickets
  set status = 'cancelled', cancelled_at = now()
  where id = ticket.id
  returning * into ticket;

  insert into public.ticket_activity_log (
    ticket_id, event_id, actor_user_id, activity_type, from_status, to_status, pass_id
  ) values (
    ticket.id, ticket.event_id, actor, 'cancelled', previous_status, 'cancelled', ticket.current_pass_id
  );
  perform public.complete_idempotency(idem.id, 200, ticket.id::text);
  return jsonb_build_object('idempotent_replay', false, 'ticket', to_jsonb(ticket));
end;
$$;

create or replace function public.issue_ticket_pass(
  p_ticket_id uuid,
  p_pass_id text,
  p_payload_hash text,
  p_valid_from timestamp with time zone,
  p_valid_until timestamp with time zone,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  idem public.idempotency_records;
  ticket public.event_tickets;
  selected_event public.events;
  created_pass public.event_passes;
  next_generation integer;
  activity text;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  idem := public.lock_idempotency('user:' || actor::text, 'issue-pass', p_idempotency_key, p_request_hash);
  if idem.state = 'completed' then
    select * into created_pass from public.event_passes where id::text = idem.resource_id;
    return jsonb_build_object('idempotent_replay', true, 'pass', to_jsonb(created_pass));
  end if;

  select * into ticket from public.event_tickets where id = p_ticket_id for update;
  if ticket.id is null or ticket.attendee_user_id <> actor then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;
  if ticket.status not in ('claimed', 'enrolled') then
    raise exception using errcode = 'P0001', message = 'ticket_state_conflict';
  end if;

  select * into selected_event from public.events where event_id = ticket.event_id for update;
  if selected_event.deleted_at is not null or now() >= selected_event.ends_at then
    raise exception using errcode = 'P0001', message = 'event_ended';
  end if;
  if selected_event.pk_gate_event is null then
    raise exception using errcode = 'P0001', message = 'gate_not_provisioned';
  end if;
  if p_valid_from < selected_event.starts_at or p_valid_until > selected_event.ends_at or p_valid_from >= p_valid_until then
    raise exception using errcode = '22023', message = 'invalid_pass_window';
  end if;

  next_generation := ticket.generation_count + 1;
  if next_generation > 3 then
    raise exception using errcode = 'P0001', message = 'pass_generation_limit';
  end if;

  if ticket.status = 'enrolled' and ticket.current_pass_id is not null then
    update public.event_passes
    set status = 'revoked', revoked_at = now()
    where event_id = ticket.event_id and pass_id = ticket.current_pass_id and status = 'active';
    insert into public.revocations (event_id, pass_id, ticket_id, reason, revoked_by)
    values (ticket.event_id, ticket.current_pass_id, ticket.id, 'pass_regenerated', actor)
    on conflict (event_id, pass_id) do nothing;
    activity := 'pass_regenerated';
  else
    activity := 'pass_issued';
  end if;

  insert into public.event_passes (
    event_id, ticket_id, pass_id, generation, payload_hash,
    valid_from, valid_until
  ) values (
    ticket.event_id, ticket.id, p_pass_id, next_generation, p_payload_hash,
    p_valid_from, p_valid_until
  ) returning * into created_pass;

  update public.event_tickets
  set status = 'enrolled',
      generation_count = next_generation,
      current_pass_id = p_pass_id,
      enrolled_at = coalesce(enrolled_at, now())
  where id = ticket.id;

  insert into public.ticket_activity_log (
    ticket_id, event_id, actor_user_id, activity_type,
    from_status, to_status, pass_id, metadata
  ) values (
    ticket.id, ticket.event_id, actor, activity,
    ticket.status, 'enrolled', p_pass_id,
    jsonb_build_object('generation', next_generation)
  );
  perform public.complete_idempotency(idem.id, 201, created_pass.id::text);
  return jsonb_build_object('idempotent_replay', false, 'pass', to_jsonb(created_pass));
end;
$$;

create or replace function public.reset_attendee_pass(
  p_ticket_id uuid,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  idem public.idempotency_records;
  ticket public.event_tickets;
  old_pass_id text;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  idem := public.lock_idempotency('user:' || actor::text, 'reset-attendee-pass', p_idempotency_key, p_request_hash);
  if idem.state = 'completed' then
    select * into ticket from public.event_tickets where id::text = idem.resource_id;
    return jsonb_build_object('idempotent_replay', true, 'ticket', to_jsonb(ticket));
  end if;

  select * into ticket from public.event_tickets where id = p_ticket_id for update;
  if ticket.id is null or not public.owns_event(ticket.event_id, actor) then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;
  if ticket.status <> 'enrolled' or ticket.current_pass_id is null then
    raise exception using errcode = 'P0001', message = 'ticket_state_conflict';
  end if;

  old_pass_id := ticket.current_pass_id;
  update public.event_passes set status = 'revoked', revoked_at = now()
  where event_id = ticket.event_id and pass_id = old_pass_id and status = 'active';
  insert into public.revocations (event_id, pass_id, ticket_id, reason, revoked_by)
  values (ticket.event_id, old_pass_id, ticket.id, 'organizer_reset', actor)
  on conflict (event_id, pass_id) do nothing;

  perform set_config('focaccia.allow_ticket_reset', 'on', true);
  update public.event_tickets
  set status = 'claimed', generation_count = 0, current_pass_id = null, enrolled_at = null
  where id = ticket.id
  returning * into ticket;

  insert into public.ticket_activity_log (
    ticket_id, event_id, actor_user_id, activity_type,
    from_status, to_status, pass_id
  ) values (
    ticket.id, ticket.event_id, actor, 'pass_reset', 'enrolled', 'claimed', old_pass_id
  );
  perform public.complete_idempotency(idem.id, 200, ticket.id::text);
  return jsonb_build_object('idempotent_replay', false, 'ticket', to_jsonb(ticket));
end;
$$;

create or replace function public.revoke_ticket(
  p_ticket_id uuid,
  p_reason text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  idem public.idempotency_records;
  ticket public.event_tickets;
  previous_status text;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'invalid_revocation_reason';
  end if;
  idem := public.lock_idempotency('user:' || actor::text, 'revoke-ticket', p_idempotency_key, p_request_hash);
  if idem.state = 'completed' then
    select * into ticket from public.event_tickets where id::text = idem.resource_id;
    return jsonb_build_object('idempotent_replay', true, 'ticket', to_jsonb(ticket));
  end if;

  select * into ticket from public.event_tickets where id = p_ticket_id for update;
  if ticket.id is null or not public.owns_event(ticket.event_id, actor) then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;
  if ticket.status not in ('claimed', 'enrolled') then
    raise exception using errcode = 'P0001', message = 'ticket_state_conflict';
  end if;
  previous_status := ticket.status;

  if ticket.status = 'enrolled' and ticket.current_pass_id is not null then
    update public.event_passes set status = 'revoked', revoked_at = now()
    where event_id = ticket.event_id and pass_id = ticket.current_pass_id and status = 'active';
    insert into public.revocations (event_id, pass_id, ticket_id, reason, revoked_by)
    values (ticket.event_id, ticket.current_pass_id, ticket.id, btrim(p_reason), actor)
    on conflict (event_id, pass_id) do nothing;
  end if;

  update public.event_tickets set status = 'revoked', revoked_at = now()
  where id = ticket.id returning * into ticket;
  insert into public.ticket_activity_log (
    ticket_id, event_id, actor_user_id, activity_type,
    from_status, to_status, pass_id, metadata
  ) values (
    ticket.id, ticket.event_id, actor, 'ticket_revoked',
    previous_status, 'revoked', ticket.current_pass_id,
    jsonb_build_object('reason', btrim(p_reason))
  );
  perform public.complete_idempotency(idem.id, 200, ticket.id::text);
  return jsonb_build_object('idempotent_replay', false, 'ticket', to_jsonb(ticket));
end;
$$;

create or replace function public.consume_api_rate_limit(
  p_actor_scope text,
  p_operation text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value public.api_rate_limits;
  window_end timestamp with time zone;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_configuration';
  end if;

  insert into public.api_rate_limits (actor_scope, operation)
  values (p_actor_scope, p_operation)
  on conflict (actor_scope, operation) do nothing;
  select * into row_value from public.api_rate_limits
  where actor_scope = p_actor_scope and operation = p_operation
  for update;

  if row_value.blocked_until is not null and row_value.blocked_until > now() then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from row_value.blocked_until - now())))::integer
    );
  end if;

  window_end := row_value.window_started_at + make_interval(secs => p_window_seconds);
  if now() >= window_end then
    update public.api_rate_limits
    set window_started_at = now(), request_count = 1, blocked_until = null
    where actor_scope = p_actor_scope and operation = p_operation;
    return jsonb_build_object('allowed', true, 'remaining', p_limit - 1);
  end if;

  if row_value.request_count + 1 > p_limit then
    update public.api_rate_limits set blocked_until = window_end
    where actor_scope = p_actor_scope and operation = p_operation;
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from window_end - now())))::integer
    );
  end if;

  update public.api_rate_limits set request_count = request_count + 1
  where actor_scope = p_actor_scope and operation = p_operation;
  return jsonb_build_object('allowed', true, 'remaining', p_limit - row_value.request_count - 1);
end;
$$;

revoke all on function public.ensure_attendee_profile(text) from public;
revoke all on function public.create_event_with_default_ticket_type(text, text, text, text, integer, boolean, timestamp with time zone, timestamp with time zone, text, text, text, text) from public;
revoke all on function public.manage_event_ticket_type(text, uuid, text, text, integer, integer, boolean, integer) from public;
revoke all on function public.claim_free_ticket(text, uuid, text, text, text, uuid, text) from public;
revoke all on function public.cancel_ticket(uuid, uuid, text) from public;
revoke all on function public.issue_ticket_pass(uuid, text, text, timestamp with time zone, timestamp with time zone, uuid, text) from public;
revoke all on function public.reset_attendee_pass(uuid, uuid, text) from public;
revoke all on function public.revoke_ticket(uuid, text, uuid, text) from public;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public;

grant execute on function public.ensure_attendee_profile(text) to authenticated;
grant execute on function public.create_event_with_default_ticket_type(text, text, text, text, integer, boolean, timestamp with time zone, timestamp with time zone, text, text, text, text) to authenticated;
grant execute on function public.manage_event_ticket_type(text, uuid, text, text, integer, integer, boolean, integer) to authenticated;
grant execute on function public.claim_free_ticket(text, uuid, text, text, text, uuid, text) to authenticated;
grant execute on function public.cancel_ticket(uuid, uuid, text) to authenticated;
grant execute on function public.issue_ticket_pass(uuid, text, text, timestamp with time zone, timestamp with time zone, uuid, text) to authenticated;
grant execute on function public.reset_attendee_pass(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_ticket(uuid, text, uuid, text) to authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

commit;

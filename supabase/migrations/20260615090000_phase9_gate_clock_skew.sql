begin;

-- A newly provisioned gate can be slightly behind the database clock. The
-- signed key, bounded freshness window, nonce, and idempotency checks remain.
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
     or p_gate_timestamp > selected_event.ends_at + interval '24 hours' then
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

create or replace function public.get_gate_revocation_snapshot(
  p_gate_device_id uuid,
  p_event_id text,
  p_gate_timestamp timestamp with time zone,
  p_nonce text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_key_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  gate public.gate_devices;
  nonce_row public.gate_sync_nonces;
  snapshot jsonb;
  snapshot_count integer;
  snapshot_latest timestamp with time zone;
  replay boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;

  select * into gate from public.gate_devices
  where id = p_gate_device_id
    and event_id = p_event_id
    and key_version = p_key_version
  for update;
  if gate.id is null or gate.revoked_at is not null or gate.sync_public_key is null then
    raise exception using errcode = 'P0001', message = 'unknown_gate_key';
  end if;
  if p_gate_timestamp > now() + interval '5 minutes'
     or p_gate_timestamp < now() - interval '5 minutes' then
    raise exception using errcode = 'P0001', message = 'stale_gate_timestamp';
  end if;

  select * into nonce_row from public.gate_sync_nonces
  where gate_device_id = gate.id and nonce = p_nonce
  for update;
  if nonce_row.gate_device_id is not null then
    if nonce_row.request_hash <> p_request_hash
       or nonce_row.idempotency_key <> p_idempotency_key then
      raise exception using errcode = 'P0001', message = 'gate_nonce_replay';
    end if;
    replay := true;
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

  select
    coalesce(jsonb_agg(
      jsonb_build_object('pass_id', pass_id, 'revoked_at', revoked_at)
      order by revoked_at asc, pass_id asc
    ), '[]'::jsonb),
    count(*)::integer,
    max(revoked_at)
  into snapshot, snapshot_count, snapshot_latest
  from public.revocations
  where event_id = p_event_id;

  update public.gate_devices set last_seen_at = now() where id = gate.id;

  return jsonb_build_object(
    'idempotent_replay', replay,
    'key_version', gate.key_version,
    'revocations', snapshot,
    'server_time', now(),
    'version', gate.key_version::text || ':' || snapshot_count::text || ':' ||
      coalesce(snapshot_latest::text, 'empty')
  );
end;
$$;

revoke all on function public.get_gate_revocation_snapshot(uuid, text, timestamp with time zone, text, uuid, text, integer) from public;
grant execute on function public.get_gate_revocation_snapshot(uuid, text, timestamp with time zone, text, uuid, text, integer) to service_role;

commit;

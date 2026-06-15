begin;

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
     or p_gate_timestamp < now() - interval '5 minutes'
     or p_gate_timestamp < gate.provisioned_at then
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

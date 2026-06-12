begin;

create or replace function public.provision_event_gate(
  p_event_id text,
  p_device_name text,
  p_pk_gate_event text,
  p_sync_public_key text,
  p_queue_secret_ciphertext text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  selected_event public.events;
  gate public.gate_devices;
begin
  if actor is null or not public.owns_event(p_event_id, actor) then
    raise exception using errcode = '42501', message = 'event_not_owned';
  end if;

  select * into selected_event from public.events
  where event_id = p_event_id for update;
  if selected_event.event_id is null or selected_event.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;
  if now() >= selected_event.ends_at then
    raise exception using errcode = 'P0001', message = 'event_ended';
  end if;
  if selected_event.pk_gate_event is not null then
    raise exception using errcode = 'P0001', message = 'gate_already_provisioned';
  end if;

  update public.events set pk_gate_event = p_pk_gate_event
  where event_id = p_event_id;
  insert into public.gate_devices (
    event_id, device_name, pk_gate_event, sync_public_key
  ) values (
    p_event_id, nullif(btrim(p_device_name), ''), p_pk_gate_event, p_sync_public_key
  ) returning * into gate;
  update public.edge_event_secrets
  set k_code_event_ciphertext = p_queue_secret_ciphertext, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object(
    'event_id', selected_event.event_id,
    'event_salt', selected_event.event_salt,
    'pk_gate_event', p_pk_gate_event,
    'pk_sign_event', selected_event.pk_sign_event,
    'starts_at', selected_event.starts_at,
    'ends_at', selected_event.ends_at,
    'gate_device_id', gate.id,
    'sync_public_key', gate.sync_public_key,
    'key_version', gate.key_version
  );
end;
$$;

revoke all on function public.provision_event_gate(text, text, text, text, text) from public;
grant execute on function public.provision_event_gate(text, text, text, text, text) to authenticated;

commit;

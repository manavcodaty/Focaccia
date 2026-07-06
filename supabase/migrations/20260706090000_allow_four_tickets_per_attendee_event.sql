begin;

alter table public.event_tickets
  drop constraint if exists event_tickets_event_attendee_key;

create index if not exists event_tickets_attendee_event_idx
  on public.event_tickets (event_id, attendee_user_id, status, created_at desc);

create or replace function public.enforce_event_ticket_holder_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_ticket_count integer;
begin
  if new.status not in ('claimed', 'enrolled', 'checked_in') then
    return new;
  end if;

  select count(*) into active_ticket_count
  from public.event_tickets
  where event_id = new.event_id
    and attendee_user_id = new.attendee_user_id
    and status in ('claimed', 'enrolled', 'checked_in')
    and id is distinct from new.id;

  if active_ticket_count >= 4 then
    raise exception using errcode = 'P0001', message = 'ticket_limit_reached';
  end if;

  return new;
end;
$$;

drop trigger if exists event_tickets_holder_limit on public.event_tickets;
create trigger event_tickets_holder_limit
before insert or update of event_id, attendee_user_id, status on public.event_tickets
for each row execute function public.enforce_event_ticket_holder_limit();

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
  holder_ticket_count integer;
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

  select count(*) into holder_ticket_count
  from public.event_tickets
  where event_id = p_event_id
    and attendee_user_id = actor
    and status in ('claimed', 'enrolled', 'checked_in');
  if holder_ticket_count >= 4 then
    raise exception using errcode = 'P0001', message = 'ticket_limit_reached';
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

commit;

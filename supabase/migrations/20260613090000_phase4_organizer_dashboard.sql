begin;

create table public.organizer_activity_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (event_id) on delete restrict,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  activity_type text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint organizer_activity_log_type_check check (
    activity_type in (
      'event_created', 'event_updated', 'event_deleted',
      'ticket_type_created', 'ticket_type_updated',
      'ticket_reset', 'ticket_revoked',
      'gate_provisioned', 'tickets_exported'
    )
  ),
  constraint organizer_activity_log_resource_type_check check (
    resource_type in ('event', 'ticket_type', 'ticket', 'gate', 'export')
  ),
  constraint organizer_activity_log_resource_id_check check (btrim(resource_id) <> ''),
  constraint organizer_activity_log_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index organizer_activity_log_event_created_idx
  on public.organizer_activity_log (event_id, created_at desc);

revoke all on table public.organizer_activity_log from anon, authenticated;
grant select on table public.organizer_activity_log to authenticated;

alter table public.organizer_activity_log enable row level security;
alter table public.organizer_activity_log force row level security;

create policy organizer_activity_owner_select
  on public.organizer_activity_log for select to authenticated
  using (
    public.is_organizer()
    and exists (
      select 1
      from public.events
      where events.event_id = organizer_activity_log.event_id
        and events.created_by = (select auth.uid())
    )
  );

create or replace function public.capture_organizer_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  activity text;
  selected_event_id text;
  selected_resource_type text;
  selected_resource_id text;
  selected_metadata jsonb := '{}'::jsonb;
begin
  if actor is null or not public.is_organizer(actor) then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'events' then
    selected_event_id := coalesce(new.event_id, old.event_id);
    selected_resource_type := 'event';
    selected_resource_id := selected_event_id;
    if tg_op = 'INSERT' then
      activity := 'event_created';
    elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
      activity := 'event_deleted';
    elsif new.name is distinct from old.name
       or new.description is distinct from old.description
       or new.location is distinct from old.location
       or new.capacity is distinct from old.capacity
       or new.is_listed is distinct from old.is_listed
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at then
      activity := 'event_updated';
    else
      return new;
    end if;
    selected_metadata := jsonb_build_object(
      'capacity', new.capacity,
      'is_listed', new.is_listed,
      'name', new.name
    );
  elsif tg_table_name = 'event_ticket_types' then
    selected_event_id := coalesce(new.event_id, old.event_id);
    selected_resource_type := 'ticket_type';
    selected_resource_id := coalesce(new.id, old.id)::text;
    activity := case when tg_op = 'INSERT' then 'ticket_type_created' else 'ticket_type_updated' end;
    selected_metadata := jsonb_build_object(
      'capacity', new.capacity,
      'is_active', new.is_active,
      'name', new.name,
      'price_pence', new.price_pence
    );
  elsif tg_table_name = 'event_tickets' then
    selected_event_id := new.event_id;
    selected_resource_type := 'ticket';
    selected_resource_id := new.id::text;
    if old.status = 'enrolled' and new.status = 'claimed' and new.current_pass_id is null then
      activity := 'ticket_reset';
    elsif old.status in ('claimed', 'enrolled') and new.status = 'revoked' then
      activity := 'ticket_revoked';
    else
      return new;
    end if;
    selected_metadata := jsonb_build_object('from_status', old.status, 'to_status', new.status);
  elsif tg_table_name = 'gate_devices' then
    selected_event_id := new.event_id;
    selected_resource_type := 'gate';
    selected_resource_id := new.id::text;
    activity := 'gate_provisioned';
    selected_metadata := jsonb_build_object(
      'device_name', new.device_name,
      'key_version', new.key_version
    );
  else
    return coalesce(new, old);
  end if;

  insert into public.organizer_activity_log (
    event_id, actor_user_id, activity_type, resource_type, resource_id, metadata
  ) values (
    selected_event_id, actor, activity, selected_resource_type, selected_resource_id, selected_metadata
  );

  return coalesce(new, old);
end;
$$;

create trigger organizer_activity_events
after insert or update on public.events
for each row execute function public.capture_organizer_activity();

create trigger organizer_activity_ticket_types
after insert or update on public.event_ticket_types
for each row execute function public.capture_organizer_activity();

create trigger organizer_activity_tickets
after update on public.event_tickets
for each row execute function public.capture_organizer_activity();

create trigger organizer_activity_gates
after insert on public.gate_devices
for each row execute function public.capture_organizer_activity();

create or replace function public.update_event_catalogue(
  p_event_id text,
  p_name text,
  p_description text,
  p_location text,
  p_capacity integer,
  p_is_listed boolean,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  updated_event public.events;
begin
  if actor is null or not public.owns_event(p_event_id, actor) then
    raise exception using errcode = '42501', message = 'event_not_owned';
  end if;

  update public.events
  set name = btrim(p_name),
      description = btrim(coalesce(p_description, '')),
      location = btrim(coalesce(p_location, '')),
      capacity = p_capacity,
      is_listed = p_is_listed,
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where event_id = p_event_id and deleted_at is null
  returning * into updated_event;

  if updated_event.event_id is null then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;

  return to_jsonb(updated_event) - 'id' - 'deleted_at';
end;
$$;

revoke all on function public.update_event_catalogue(text, text, text, text, integer, boolean, timestamp with time zone, timestamp with time zone) from public;
grant execute on function public.update_event_catalogue(text, text, text, text, integer, boolean, timestamp with time zone, timestamp with time zone) to authenticated;

alter publication supabase_realtime add table public.organizer_activity_log;

commit;

begin;

create table public.organizer_profiles (
  user_id uuid primary key references auth.users (id) on delete restrict,
  email text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organizer_profiles_email_normalized_check check (
    email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create table public.attendee_profiles (
  user_id uuid primary key references auth.users (id) on delete restrict,
  email text not null,
  full_name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint attendee_profiles_email_normalized_check check (
    email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint attendee_profiles_full_name_check check (
    char_length(btrim(full_name)) between 1 and 120
  )
);

alter table public.events
  add column description text not null default '',
  add column location text not null default '',
  add column capacity integer not null default 100,
  add column is_listed boolean not null default false,
  add column updated_at timestamp with time zone not null default now(),
  add column deleted_at timestamp with time zone,
  add constraint events_capacity_positive_check check (capacity > 0),
  add constraint events_description_length_check check (char_length(description) <= 4000),
  add constraint events_location_length_check check (char_length(location) <= 300);

create table public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (event_id) on delete restrict,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  description text not null default '',
  price_pence integer not null default 0,
  currency text not null default 'GBP',
  capacity integer,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint event_ticket_types_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint event_ticket_types_description_check check (char_length(description) <= 1000),
  constraint event_ticket_types_price_check check (price_pence >= 0),
  constraint event_ticket_types_currency_check check (currency = 'GBP'),
  constraint event_ticket_types_capacity_check check (capacity is null or capacity > 0),
  constraint event_ticket_types_sort_order_check check (sort_order >= 0),
  constraint event_ticket_types_event_name_key unique (event_id, normalized_name)
);

create unique index event_ticket_types_one_default_idx
  on public.event_ticket_types (event_id)
  where is_default;

insert into public.event_ticket_types (
  event_id,
  name,
  price_pence,
  currency,
  capacity,
  is_active,
  is_default,
  sort_order
)
select event_id, 'General Admission', 0, 'GBP', capacity, true, true, 0
from public.events;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizer_profiles_set_updated_at
before update on public.organizer_profiles
for each row execute function public.set_updated_at();

create trigger attendee_profiles_set_updated_at
before update on public.attendee_profiles
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger event_ticket_types_set_updated_at
before update on public.event_ticket_types
for each row execute function public.set_updated_at();

create or replace function public.is_organizer(candidate uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate is not null and exists (
    select 1 from public.organizer_profiles where user_id = candidate
  );
$$;

create or replace function public.owns_event(candidate_event_id text, candidate uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_organizer(candidate) and exists (
    select 1
    from public.events
    where event_id = candidate_event_id
      and created_by = candidate
      and deleted_at is null
  );
$$;

revoke all on function public.is_organizer(uuid) from public;
revoke all on function public.owns_event(text, uuid) from public;
grant execute on function public.is_organizer(uuid) to authenticated, service_role;
grant execute on function public.owns_event(text, uuid) to authenticated, service_role;

revoke all on table public.organizer_profiles from anon, authenticated;
revoke all on table public.attendee_profiles from anon, authenticated;
revoke all on table public.event_ticket_types from anon, authenticated;
grant select on table public.organizer_profiles to authenticated;
grant select, update (full_name) on table public.attendee_profiles to authenticated;
grant select on table public.event_ticket_types to authenticated;

alter table public.organizer_profiles enable row level security;
alter table public.organizer_profiles force row level security;
alter table public.attendee_profiles enable row level security;
alter table public.attendee_profiles force row level security;
alter table public.event_ticket_types enable row level security;
alter table public.event_ticket_types force row level security;

create policy organizer_profiles_self_select
  on public.organizer_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy attendee_profiles_self_select
  on public.attendee_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy attendee_profiles_self_update
  on public.attendee_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy event_ticket_types_owner_select
  on public.event_ticket_types for select to authenticated
  using (public.owns_event(event_id));

drop policy events_owner_select on public.events;
drop policy events_owner_insert on public.events;
drop policy events_owner_update on public.events;
drop policy events_owner_delete on public.events;

create policy events_organizer_owner_select
  on public.events for select to authenticated
  using (public.is_organizer() and created_by = (select auth.uid()));

create policy events_organizer_owner_insert
  on public.events for insert to authenticated
  with check (public.is_organizer() and created_by = (select auth.uid()));

create policy events_organizer_owner_update
  on public.events for update to authenticated
  using (public.is_organizer() and created_by = (select auth.uid()))
  with check (public.is_organizer() and created_by = (select auth.uid()));

create policy events_organizer_owner_delete
  on public.events for delete to authenticated
  using (false);

commit;

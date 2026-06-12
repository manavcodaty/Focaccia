begin;

create table public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (event_id) on delete restrict,
  ticket_type_id uuid not null references public.event_ticket_types (id) on delete restrict,
  attendee_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'claimed',
  claim_code_digest text not null,
  claim_code_ciphertext text not null,
  claim_code_hint text not null,
  generation_count integer not null default 0,
  current_pass_id text,
  claimed_at timestamp with time zone not null default now(),
  enrolled_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint event_tickets_status_check check (
    status in ('claimed', 'enrolled', 'checked_in', 'cancelled', 'revoked')
  ),
  constraint event_tickets_claim_code_digest_check check (claim_code_digest ~ '^[a-f0-9]{64}$'),
  constraint event_tickets_claim_code_ciphertext_check check (btrim(claim_code_ciphertext) <> ''),
  constraint event_tickets_claim_code_hint_check check (claim_code_hint ~ '^[A-Z0-9]{4}$'),
  constraint event_tickets_generation_check check (generation_count between 0 and 3),
  constraint event_tickets_event_attendee_key unique (event_id, attendee_user_id),
  constraint event_tickets_claim_code_digest_key unique (claim_code_digest)
);

create table public.event_passes (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (event_id) on delete restrict,
  ticket_id uuid not null references public.event_tickets (id) on delete restrict,
  pass_id text not null,
  generation integer not null,
  status text not null default 'active',
  payload_hash text not null,
  issued_at timestamp with time zone not null default now(),
  valid_from timestamp with time zone not null,
  valid_until timestamp with time zone not null,
  revoked_at timestamp with time zone,
  used_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint event_passes_pass_id_check check (pass_id ~ '^[A-Za-z0-9_-]{22}$'),
  constraint event_passes_generation_check check (generation between 1 and 3),
  constraint event_passes_status_check check (status in ('active', 'revoked', 'used')),
  constraint event_passes_payload_hash_check check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint event_passes_valid_window_check check (valid_from < valid_until),
  constraint event_passes_event_pass_key unique (event_id, pass_id),
  constraint event_passes_ticket_generation_key unique (ticket_id, generation)
);

create unique index event_passes_one_active_per_ticket_idx
  on public.event_passes (ticket_id)
  where status = 'active';

alter table public.event_tickets
  add constraint event_tickets_current_pass_fkey
  foreign key (event_id, current_pass_id)
  references public.event_passes (event_id, pass_id)
  deferrable initially deferred;

create table public.ticket_activity_log (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.event_tickets (id) on delete restrict,
  event_id text not null references public.events (event_id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete restrict,
  actor_gate_device_id uuid references public.gate_devices (id) on delete restrict,
  activity_type text not null,
  from_status text,
  to_status text,
  pass_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint ticket_activity_log_type_check check (
    activity_type in (
      'claimed', 'cancelled', 'pass_issued', 'pass_regenerated',
      'pass_reset', 'ticket_revoked', 'checked_in'
    )
  ),
  constraint ticket_activity_log_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

alter table public.revocations
  add column ticket_id uuid references public.event_tickets (id) on delete restrict,
  add column reason text,
  add column revoked_by uuid references auth.users (id) on delete restrict;

create index event_tickets_attendee_idx on public.event_tickets (attendee_user_id, created_at desc);
create index event_tickets_event_status_idx on public.event_tickets (event_id, status);
create index event_tickets_type_status_idx on public.event_tickets (ticket_type_id, status);
create index event_passes_ticket_idx on public.event_passes (ticket_id, generation desc);
create index ticket_activity_log_event_idx on public.ticket_activity_log (event_id, created_at desc);
create index ticket_activity_log_ticket_idx on public.ticket_activity_log (ticket_id, created_at desc);

create trigger event_tickets_set_updated_at
before update on public.event_tickets
for each row execute function public.set_updated_at();

create or replace function public.enforce_ticket_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reset_allowed boolean := coalesce(current_setting('focaccia.allow_ticket_reset', true), '') = 'on';
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status = 'claimed' and new.status in ('enrolled', 'cancelled', 'revoked'))
     or (old.status = 'enrolled' and new.status in ('checked_in', 'cancelled', 'revoked'))
     or (old.status = 'enrolled' and new.status = 'claimed' and reset_allowed) then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'invalid_ticket_state_transition';
end;
$$;

create trigger event_tickets_state_transition
before update of status on public.event_tickets
for each row execute function public.enforce_ticket_state_transition();

revoke all on table public.event_tickets from anon, authenticated;
revoke all on table public.event_passes from anon, authenticated;
revoke all on table public.ticket_activity_log from anon, authenticated;
grant select on table public.event_tickets to authenticated;
grant select on table public.event_passes to authenticated;
grant select on table public.ticket_activity_log to authenticated;

alter table public.event_tickets enable row level security;
alter table public.event_tickets force row level security;
alter table public.event_passes enable row level security;
alter table public.event_passes force row level security;
alter table public.ticket_activity_log enable row level security;
alter table public.ticket_activity_log force row level security;

create policy event_tickets_attendee_or_owner_select
  on public.event_tickets for select to authenticated
  using (
    attendee_user_id = (select auth.uid())
    or public.owns_event(event_id)
  );

create policy event_passes_attendee_or_owner_select
  on public.event_passes for select to authenticated
  using (
    public.owns_event(event_id)
    or exists (
      select 1 from public.event_tickets
      where event_tickets.id = event_passes.ticket_id
        and event_tickets.attendee_user_id = (select auth.uid())
    )
  );

create policy ticket_activity_attendee_or_owner_select
  on public.ticket_activity_log for select to authenticated
  using (
    public.owns_event(event_id)
    or exists (
      select 1 from public.event_tickets
      where event_tickets.id = ticket_activity_log.ticket_id
        and event_tickets.attendee_user_id = (select auth.uid())
    )
  );

drop policy revocations_owner_select on public.revocations;
drop policy revocations_owner_insert on public.revocations;
drop policy revocations_owner_update on public.revocations;
drop policy revocations_owner_delete on public.revocations;

create policy revocations_organizer_owner_select
  on public.revocations for select to authenticated
  using (public.owns_event(event_id));

commit;

begin;

create extension if not exists pgcrypto with schema extensions;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  name text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  join_code text not null,
  event_salt text not null,
  pk_sign_event text not null,
  pk_gate_event text,
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint events_event_id_key unique (event_id),
  constraint events_join_code_key unique (join_code),
  constraint events_created_by_fkey
    foreign key (created_by)
    references auth.users (id)
    on delete restrict,
  constraint events_time_window_check check (starts_at < ends_at),
  constraint events_event_id_nonempty_check check (btrim(event_id) <> ''),
  constraint events_name_nonempty_check check (btrim(name) <> ''),
  constraint events_join_code_format_check check (join_code ~ '^[A-Z0-9]{8}$'),
  constraint events_event_salt_format_check check (event_salt ~ '^[A-Za-z0-9_-]{43}$'),
  constraint events_pk_sign_event_format_check check (pk_sign_event ~ '^[A-Za-z0-9_-]{43}$'),
  constraint events_pk_gate_event_format_check check (
    pk_gate_event is null
    or pk_gate_event ~ '^[A-Za-z0-9_-]{43}$'
  )
);

create table public.gate_devices (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  device_name text,
  pk_gate_event text not null,
  provisioned_at timestamp with time zone not null default now(),
  constraint gate_devices_event_id_key unique (event_id),
  constraint gate_devices_event_id_fkey
    foreign key (event_id)
    references public.events (event_id)
    on delete cascade,
  constraint gate_devices_event_id_nonempty_check check (btrim(event_id) <> ''),
  constraint gate_devices_device_name_nonempty_check check (
    device_name is null
    or btrim(device_name) <> ''
  ),
  constraint gate_devices_pk_gate_event_format_check check (
    pk_gate_event ~ '^[A-Za-z0-9_-]{43}$'
  )
);

create table public.revocations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  pass_id text not null,
  revoked_at timestamp with time zone not null default now(),
  constraint revocations_event_id_pass_id_key unique (event_id, pass_id),
  constraint revocations_event_id_fkey
    foreign key (event_id)
    references public.events (event_id)
    on delete cascade,
  constraint revocations_event_id_nonempty_check check (btrim(event_id) <> ''),
  constraint revocations_pass_id_nonempty_check check (btrim(pass_id) <> '')
);

create table public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  uploaded_at timestamp with time zone not null default now(),
  csv_url text not null,
  constraint gate_logs_event_id_fkey
    foreign key (event_id)
    references public.events (event_id)
    on delete cascade,
  constraint gate_logs_event_id_nonempty_check check (btrim(event_id) <> ''),
  constraint gate_logs_csv_url_nonempty_check check (btrim(csv_url) <> '')
);

create index revocations_event_id_idx on public.revocations (event_id);
create index gate_logs_event_id_idx on public.gate_logs (event_id);

revoke all on table public.events from anon, authenticated;
revoke all on table public.gate_devices from anon, authenticated;
revoke all on table public.revocations from anon, authenticated;
revoke all on table public.gate_logs from anon, authenticated;

grant select, insert, update, delete on table public.events to authenticated;
grant select on table public.gate_devices to authenticated;
grant select, insert, update, delete on table public.revocations to authenticated;
grant select on table public.gate_logs to authenticated;

alter table public.events enable row level security;
alter table public.events force row level security;

alter table public.gate_devices enable row level security;
alter table public.gate_devices force row level security;

alter table public.revocations enable row level security;
alter table public.revocations force row level security;

alter table public.gate_logs enable row level security;
alter table public.gate_logs force row level security;

create policy events_owner_select
  on public.events
  for select
  to authenticated
  using ((select auth.uid()) = created_by);

create policy events_owner_insert
  on public.events
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy events_owner_update
  on public.events
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy events_owner_delete
  on public.events
  for delete
  to authenticated
  using ((select auth.uid()) = created_by);

create policy gate_devices_owner_select
  on public.gate_devices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.event_id = gate_devices.event_id
        and events.created_by = (select auth.uid())
    )
  );

create policy revocations_owner_select
  on public.revocations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.event_id = revocations.event_id
        and events.created_by = (select auth.uid())
    )
  );

create policy revocations_owner_insert
  on public.revocations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events
      where events.event_id = revocations.event_id
        and events.created_by = (select auth.uid())
    )
  );

create policy revocations_owner_update
  on public.revocations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.event_id = revocations.event_id
        and events.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.events
      where events.event_id = revocations.event_id
        and events.created_by = (select auth.uid())
    )
  );

create policy revocations_owner_delete
  on public.revocations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.event_id = revocations.event_id
        and events.created_by = (select auth.uid())
    )
  );

create policy gate_logs_owner_select
  on public.gate_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.event_id = gate_logs.event_id
        and events.created_by = (select auth.uid())
    )
  );

commit;

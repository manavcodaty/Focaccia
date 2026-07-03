begin;

alter table public.edge_event_secrets enable row level security;
alter table public.edge_event_secrets force row level security;

revoke all on table public.edge_event_secrets from anon, authenticated;
revoke all on table public.edge_event_secrets from service_role;
grant select, insert, update, delete on table public.edge_event_secrets to service_role;

commit;

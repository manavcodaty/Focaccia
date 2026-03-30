begin;

create table public.edge_event_secrets (
  event_id text primary key,
  sk_sign_event_ciphertext text not null,
  k_code_event_ciphertext text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint edge_event_secrets_event_id_fkey
    foreign key (event_id)
    references public.events (event_id)
    on delete cascade,
  constraint edge_event_secrets_event_id_nonempty_check check (btrim(event_id) <> ''),
  constraint edge_event_secrets_sk_ciphertext_nonempty_check check (
    btrim(sk_sign_event_ciphertext) <> ''
  ),
  constraint edge_event_secrets_k_ciphertext_nonempty_check check (
    k_code_event_ciphertext is null
    or btrim(k_code_event_ciphertext) <> ''
  )
);

revoke all on table public.edge_event_secrets from anon, authenticated, service_role;
grant select, insert, update, delete on table public.edge_event_secrets to service_role;

commit;

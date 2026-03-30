#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

info() {
  printf '%s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command '$1' is not installed."
  fi
}

require_command docker
require_command jq
require_command rg
require_command supabase

if [[ ! -f "$ROOT_DIR/supabase/config.toml" ]]; then
  fail "Supabase project is not initialized. Run 'supabase init' from the repository root first."
fi

STATUS_JSON=""
if ! STATUS_JSON="$(supabase status -o json 2>/dev/null)"; then
  fail "Supabase local services are not running. Start them with 'supabase start'."
fi

if [[ -z "$STATUS_JSON" || "$STATUS_JSON" == "null" ]]; then
  fail "Supabase status returned no data."
fi

DB_CONTAINER="$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -n 1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  fail "Could not locate the running Supabase Postgres container."
fi

run_sql() {
  local sql="$1"
  docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At -F $'\t' -c "$sql"
}

assert_no_rows() {
  local description="$1"
  local sql="$2"
  local output

  output="$(run_sql "$sql")"
  if [[ -n "$output" ]]; then
    printf 'FAILED: %s\n%s\n' "$description" "$output" >&2
    exit 1
  fi

  info "PASS: $description"
}

assert_exact() {
  local description="$1"
  local sql="$2"
  local expected="$3"
  local output

  output="$(run_sql "$sql")"
  if [[ "$output" != "$expected" ]]; then
    printf 'FAILED: %s\nExpected: %s\nActual: %s\n' "$description" "$expected" "$output" >&2
    exit 1
  fi

  info "PASS: $description"
}

assert_no_rows "required public tables exist" "
with expected(table_name) as (
  values ('events'), ('gate_devices'), ('revocations'), ('gate_logs')
)
select e.table_name
from expected e
left join information_schema.tables t
  on t.table_schema = 'public'
 and t.table_name = e.table_name
where t.table_name is null;
"

assert_no_rows "required columns exist with the documented types and nullability" "
with expected(table_name, column_name, column_type, is_not_null) as (
  values
    ('events', 'id', 'uuid', true),
    ('events', 'event_id', 'text', true),
    ('events', 'name', 'text', true),
    ('events', 'starts_at', 'timestamp with time zone', true),
    ('events', 'ends_at', 'timestamp with time zone', true),
    ('events', 'join_code', 'text', true),
    ('events', 'event_salt', 'text', true),
    ('events', 'pk_sign_event', 'text', true),
    ('events', 'pk_gate_event', 'text', false),
    ('events', 'created_by', 'uuid', true),
    ('events', 'created_at', 'timestamp with time zone', true),
    ('gate_devices', 'id', 'uuid', true),
    ('gate_devices', 'event_id', 'text', true),
    ('gate_devices', 'device_name', 'text', false),
    ('gate_devices', 'pk_gate_event', 'text', true),
    ('gate_devices', 'provisioned_at', 'timestamp with time zone', true),
    ('revocations', 'id', 'uuid', true),
    ('revocations', 'event_id', 'text', true),
    ('revocations', 'pass_id', 'text', true),
    ('revocations', 'revoked_at', 'timestamp with time zone', true),
    ('gate_logs', 'id', 'uuid', true),
    ('gate_logs', 'event_id', 'text', true),
    ('gate_logs', 'uploaded_at', 'timestamp with time zone', true),
    ('gate_logs', 'csv_url', 'text', true)
)
select format(
  '%s.%s expected type=%s not_null=%s but found type=%s not_null=%s',
  e.table_name,
  e.column_name,
  e.column_type,
  e.is_not_null,
  coalesce(actual.column_type, '<missing>'),
  coalesce(actual.is_not_null::text, '<missing>')
)
from expected e
left join lateral (
  select
    format_type(a.atttypid, a.atttypmod) as column_type,
    a.attnotnull as is_not_null
  from pg_class c
  join pg_namespace n
    on n.oid = c.relnamespace
  join pg_attribute a
    on a.attrelid = c.oid
  where n.nspname = 'public'
    and c.relname = e.table_name
    and a.attname = e.column_name
    and a.attnum > 0
    and not a.attisdropped
) actual on true
where actual.column_type is distinct from e.column_type
   or actual.is_not_null is distinct from e.is_not_null;
"

assert_no_rows "required default expressions are present" "
with expected(table_name, column_name, default_expr) as (
  values
    ('events', 'id', 'gen_random_uuid()'),
    ('events', 'created_at', 'now()'),
    ('gate_devices', 'id', 'gen_random_uuid()'),
    ('gate_devices', 'provisioned_at', 'now()'),
    ('revocations', 'id', 'gen_random_uuid()'),
    ('revocations', 'revoked_at', 'now()'),
    ('gate_logs', 'id', 'gen_random_uuid()'),
    ('gate_logs', 'uploaded_at', 'now()')
)
select format(
  '%s.%s expected default=%s but found %s',
  e.table_name,
  e.column_name,
  e.default_expr,
  coalesce(actual.default_expr, '<missing>')
)
from expected e
left join lateral (
  select pg_get_expr(ad.adbin, ad.adrelid) as default_expr
  from pg_class c
  join pg_namespace n
    on n.oid = c.relnamespace
  join pg_attribute a
    on a.attrelid = c.oid
  left join pg_attrdef ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  where n.nspname = 'public'
    and c.relname = e.table_name
    and a.attname = e.column_name
    and a.attnum > 0
    and not a.attisdropped
) actual on true
where actual.default_expr is distinct from e.default_expr;
"

assert_no_rows "named constraints for integrity and one-gate enforcement exist" "
with expected(table_name, constraint_name, constraint_type) as (
  values
    ('events', 'events_pkey', 'PRIMARY KEY'),
    ('events', 'events_event_id_key', 'UNIQUE'),
    ('events', 'events_join_code_key', 'UNIQUE'),
    ('events', 'events_created_by_fkey', 'FOREIGN KEY'),
    ('events', 'events_time_window_check', 'CHECK'),
    ('events', 'events_event_id_nonempty_check', 'CHECK'),
    ('events', 'events_join_code_format_check', 'CHECK'),
    ('events', 'events_event_salt_format_check', 'CHECK'),
    ('events', 'events_pk_sign_event_format_check', 'CHECK'),
    ('gate_devices', 'gate_devices_pkey', 'PRIMARY KEY'),
    ('gate_devices', 'gate_devices_event_id_key', 'UNIQUE'),
    ('gate_devices', 'gate_devices_event_id_fkey', 'FOREIGN KEY'),
    ('gate_devices', 'gate_devices_event_id_nonempty_check', 'CHECK'),
    ('gate_devices', 'gate_devices_pk_gate_event_format_check', 'CHECK'),
    ('revocations', 'revocations_pkey', 'PRIMARY KEY'),
    ('revocations', 'revocations_event_id_pass_id_key', 'UNIQUE'),
    ('revocations', 'revocations_event_id_fkey', 'FOREIGN KEY'),
    ('revocations', 'revocations_event_id_nonempty_check', 'CHECK'),
    ('revocations', 'revocations_pass_id_nonempty_check', 'CHECK'),
    ('gate_logs', 'gate_logs_pkey', 'PRIMARY KEY'),
    ('gate_logs', 'gate_logs_event_id_fkey', 'FOREIGN KEY'),
    ('gate_logs', 'gate_logs_event_id_nonempty_check', 'CHECK'),
    ('gate_logs', 'gate_logs_csv_url_nonempty_check', 'CHECK')
)
select format(
  '%s missing constraint %s (%s)',
  e.table_name,
  e.constraint_name,
  e.constraint_type
)
from expected e
left join information_schema.table_constraints c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.constraint_name = e.constraint_name
 and c.constraint_type = e.constraint_type
where c.constraint_name is null;
"

assert_no_rows "row level security is enabled and forced on every table" "
with expected(table_name) as (
  values ('events'), ('gate_devices'), ('revocations'), ('gate_logs')
)
select format(
  '%s has relrowsecurity=%s relforcerowsecurity=%s',
  e.table_name,
  coalesce(c.relrowsecurity::text, '<missing>'),
  coalesce(c.relforcerowsecurity::text, '<missing>')
)
from expected e
left join pg_class c
  on c.relname = e.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname is distinct from 'public'
   or c.relrowsecurity is distinct from true
   or c.relforcerowsecurity is distinct from true;
"

assert_no_rows "expected authenticated policies are present" "
with expected(table_name, policy_name, command_name) as (
  values
    ('events', 'events_owner_select', 'SELECT'),
    ('events', 'events_owner_insert', 'INSERT'),
    ('events', 'events_owner_update', 'UPDATE'),
    ('events', 'events_owner_delete', 'DELETE'),
    ('gate_devices', 'gate_devices_owner_select', 'SELECT'),
    ('revocations', 'revocations_owner_select', 'SELECT'),
    ('revocations', 'revocations_owner_insert', 'INSERT'),
    ('revocations', 'revocations_owner_update', 'UPDATE'),
    ('revocations', 'revocations_owner_delete', 'DELETE'),
    ('gate_logs', 'gate_logs_owner_select', 'SELECT')
)
select format(
  '%s missing policy %s for %s',
  e.table_name,
  e.policy_name,
  e.command_name
)
from expected e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = e.table_name
 and p.policyname = e.policy_name
 and p.cmd = e.command_name
where p.policyname is null;
"

assert_no_rows "anon has no direct table privileges" "
with expected(table_name) as (
  values ('events'), ('gate_devices'), ('revocations'), ('gate_logs')
),
privileges(privilege_type) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select format('%s unexpectedly has %s on %s', 'anon', p.privilege_type, e.table_name)
from expected e
cross join privileges p
where has_table_privilege('anon', format('public.%I', e.table_name), p.privilege_type);
"

assert_no_rows "authenticated has only the intended least-privilege table grants" "
with expected(table_name, privilege_type, should_have) as (
  values
    ('events', 'SELECT', true),
    ('events', 'INSERT', true),
    ('events', 'UPDATE', true),
    ('events', 'DELETE', true),
    ('gate_devices', 'SELECT', true),
    ('gate_devices', 'INSERT', false),
    ('gate_devices', 'UPDATE', false),
    ('gate_devices', 'DELETE', false),
    ('revocations', 'SELECT', true),
    ('revocations', 'INSERT', true),
    ('revocations', 'UPDATE', true),
    ('revocations', 'DELETE', true),
    ('gate_logs', 'SELECT', true),
    ('gate_logs', 'INSERT', false),
    ('gate_logs', 'UPDATE', false),
    ('gate_logs', 'DELETE', false)
)
select format(
  'authenticated expected %s=%s on %s but found %s',
  e.privilege_type,
  e.should_have,
  e.table_name,
  has_table_privilege('authenticated', format('public.%I', e.table_name), e.privilege_type)
)
from expected e
where has_table_privilege('authenticated', format('public.%I', e.table_name), e.privilege_type) is distinct from e.should_have;
"

info "Running Supabase catalog lint..."
supabase db lint --local --schema public --fail-on error >/dev/null
info "PASS: supabase db lint"

info "Database schema verification completed successfully."

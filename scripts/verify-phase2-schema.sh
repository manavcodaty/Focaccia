#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_HOST_VALUE="${FOCACCIA_DOCKER_HOST:-${DOCKER_HOST:-}}"

export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
if [[ -n "$DOCKER_HOST_VALUE" ]]; then
  export DOCKER_HOST="$DOCKER_HOST_VALUE"
fi

DB_CONTAINER="$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')"
if [[ -z "$DB_CONTAINER" ]]; then
  printf 'ERROR: local Supabase database container is not running.\n' >&2
  exit 1
fi

run_sql() {
  docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At -F $'\t' -c "$1"
}

assert_empty() {
  local label="$1"
  local result
  result="$(run_sql "$2")"
  if [[ -n "$result" ]]; then
    printf 'FAIL: %s\n%s\n' "$label" "$result" >&2
    exit 1
  fi
  printf 'PASS: %s\n' "$label"
}

assert_empty "Phase 2 tables exist" "
with expected(name) as (
  values
    ('organizer_profiles'), ('attendee_profiles'), ('event_ticket_types'),
    ('event_tickets'), ('event_passes'), ('ticket_activity_log'),
    ('idempotency_records'), ('api_rate_limits'), ('gate_sync_nonces'),
    ('gate_checkins')
)
select expected.name
from expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.name
where actual.table_name is null;
"

assert_empty "Phase 2 event and gate columns exist" "
with expected(table_name, column_name) as (
  values
    ('events', 'description'), ('events', 'location'), ('events', 'capacity'),
    ('events', 'is_listed'), ('events', 'updated_at'), ('events', 'deleted_at'),
    ('gate_devices', 'sync_public_key'), ('gate_devices', 'key_version'),
    ('gate_devices', 'revoked_at')
)
select format('%s.%s', expected.table_name, expected.column_name)
from expected
left join information_schema.columns actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
 and actual.column_name = expected.column_name
where actual.column_name is null;
"

assert_empty "Phase 2 uniqueness constraints and indexes exist" "
with expected(name) as (
  values
    ('event_tickets_claim_code_digest_key'),
    ('event_passes_event_pass_key'),
    ('event_passes_ticket_generation_key'),
    ('gate_checkins_event_pass_key'),
    ('idempotency_records_scope_operation_key_key')
)
select expected.name
from expected
left join pg_constraint constraint_row on constraint_row.conname = expected.name
where constraint_row.oid is null;
"

assert_empty "Phase 2 ticket holder limit guard exists" "
with expected(kind, name) as (
  values
    ('index', 'event_tickets_attendee_event_idx'),
    ('trigger', 'event_tickets_holder_limit')
),
actual(kind, name) as (
  select 'index', relation.relname
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind = 'i'
    and relation.relname = 'event_tickets_attendee_event_idx'
  union all
  select 'trigger', trigger_row.tgname
  from pg_trigger trigger_row
  join pg_class table_row on table_row.oid = trigger_row.tgrelid
  join pg_namespace namespace on namespace.oid = table_row.relnamespace
  where namespace.nspname = 'public'
    and table_row.relname = 'event_tickets'
    and trigger_row.tgname = 'event_tickets_holder_limit'
    and not trigger_row.tgisinternal
)
select format('%s:%s', expected.kind, expected.name)
from expected
left join actual
  on actual.kind = expected.kind
 and actual.name = expected.name
where actual.name is null;
"

assert_empty "Phase 2 tables enforce RLS" "
with expected(name) as (
  values
    ('organizer_profiles'), ('attendee_profiles'), ('event_ticket_types'),
    ('event_tickets'), ('event_passes'), ('ticket_activity_log'),
    ('idempotency_records'), ('api_rate_limits'), ('gate_sync_nonces'),
    ('gate_checkins')
)
select format('%s rls=%s force=%s', expected.name, c.relrowsecurity, c.relforcerowsecurity)
from expected
left join pg_class c on c.relname = expected.name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where n.oid is null or c.relrowsecurity is distinct from true or c.relforcerowsecurity is distinct from true;
"

assert_empty "Transactional Phase 2 operations exist" "
with expected(name) as (
  values
    ('create_event_with_default_ticket_type'), ('claim_free_ticket'),
    ('cancel_ticket'), ('issue_ticket_pass'), ('reset_attendee_pass'),
    ('revoke_ticket'), ('record_gate_checkin'), ('consume_api_rate_limit'),
    ('provision_event_gate')
)
select expected.name
from expected
left join pg_proc p on p.proname = expected.name
left join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where n.oid is null;
"

assert_empty "No token or biometric persistence columns exist" "
select format('%s.%s', table_name, column_name)
from information_schema.columns
where table_schema = 'public'
  and table_name in ('event_tickets', 'event_passes', 'gate_checkins', 'ticket_activity_log')
  and column_name ~ '(face|image|video|embedding|template|pass_token|signed_token|biometric)';
"

printf 'Phase 2 schema verification passed.\n'

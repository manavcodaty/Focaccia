#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/20260613090000_phase4_organizer_dashboard.sql"

test -f "$MIGRATION"

grep -q "create table public.organizer_activity_log" "$MIGRATION"
grep -q "alter table public.organizer_activity_log enable row level security" "$MIGRATION"
grep -q "organizer_activity_owner_select" "$MIGRATION"
grep -q "create or replace function public.update_event_catalogue" "$MIGRATION"
grep -q "event_created" "$MIGRATION"
grep -q "event_updated" "$MIGRATION"
grep -q "ticket_type_created" "$MIGRATION"
grep -q "ticket_type_updated" "$MIGRATION"
grep -q "ticket_reset" "$MIGRATION"
grep -q "ticket_revoked" "$MIGRATION"
grep -q "gate_provisioned" "$MIGRATION"

echo "Phase 4 schema contract verified."

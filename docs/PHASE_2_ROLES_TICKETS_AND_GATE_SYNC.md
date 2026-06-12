# Phase 2: Roles, Tickets, RLS, and APIs

Phase 2 replaces the prototype join-code flow with authenticated, organizer-owned events and attendee-owned tickets. The migrations are additive and preserve the original migration history.

## Migration order

1. `20260612090000_phase2_roles_and_event_catalogue.sql`
2. `20260612090100_phase2_tickets_passes_and_audit.sql`
3. `20260612090200_phase2_transactional_operations.sql`
4. `20260612090300_phase2_gate_sync_and_capacity_guards.sql`
5. `20260612090400_phase2_atomic_gate_provisioning.sql`
6. `20260612090500_phase2_pass_generation_cycles.sql`

The sequence first introduces profiles and catalogue data, then tickets and passes, then transactional RPCs, gate sync, atomic provisioning, and generation-cycle compatibility. Rollback is recovery-oriented: restore a pre-migration database snapshot or apply a new forward migration. Existing migrations must not be rewritten.

## Ownership and roles

- Organizer access requires an authenticated email present in `FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST` and an `organizer_profiles` row created through `ensure-organizer`.
- Attendee identity is always derived from the bearer token. `ensure-attendee` creates or updates only that user's `attendee_profiles` row.
- Events are owned by `events.created_by`. Organizer reads and mutations are restricted to the owner by RLS and RPC checks.
- Tickets are owned by `event_tickets.attendee_user_id`. Attendees cannot read another attendee's tickets or passes.

## Ticket and pass states

Ticket transitions are constrained to:

- `claimed -> enrolled`
- `claimed -> cancelled`
- `claimed -> revoked`
- `enrolled -> claimed` during an organizer-authorized pass reset
- `enrolled -> checked_in`
- `enrolled -> cancelled`
- `enrolled -> revoked`
- `checked_in -> revoked`

Only one ticket may exist for an attendee and event. Free claims lock the ticket type and event rows before checking capacity, so concurrent requests cannot oversell the final seat. Paid ticket types are visible but blocked until a payment provider is implemented.

Pass issuance requires ticket ownership and an exact event match. A ticket may issue at most three generations in one cycle. Regeneration revokes the prior current pass. Reset revokes the current pass, returns the ticket to `claimed`, starts a new generation cycle, and resets the visible generation count to zero.

## Claim codes and idempotency

- Claim codes contain 60 bits of random entropy and use the format `XXXX-XXXX-XXXX` with an unambiguous uppercase alphabet.
- Only a peppered digest and a short display hint are stored in ticket rows. The encrypted claim code is retained only for an idempotent owner replay.
- Claim-code lookup returns the same error shape for unknown, foreign, cancelled, and revoked tickets.
- Mutation idempotency keys are lowercase UUID v4 values sent in `Idempotency-Key`.
- `idempotency_records` is unique on `(scope_user_id, operation, key)` and stores request hashes and non-secret result references.

## Edge Function envelope

Every function returns one of:

```json
{ "ok": true, "data": {}, "request_id": "uuid" }
```

```json
{ "ok": false, "error": { "code": "machine_code", "message": "safe message" }, "request_id": "uuid" }
```

Mutation bodies use strict Zod schemas. Unknown fields are rejected. User, organizer, event ownership, and ticket ownership are derived or verified server-side.

Implemented operations:

- `ensure-organizer`, `ensure-attendee`
- `get-public-events`, `get-public-event`
- `create-event`, `manage-ticket-type`, `delete-event`
- `claim-free-ticket`, `cancel-ticket`, `list-my-tickets`
- `get-enrollment-bundle`, `issue-pass`, `reset-attendee-pass`
- `revoke-ticket`, compatibility `revoke-pass`
- `organizer-ticket-summaries`
- `provision-gate`, `record-gate-checkin`

## Gate sync

Provisioning generates two independent device keypairs:

- X25519 encrypts enrollment templates for the gate.
- Ed25519 signs gate check-in sync payloads.

Both private keys are stored separately through Expo SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The server stores only public keys. A check-in signature covers the canonical JSON object containing `decision`, `event_id`, `gate_timestamp`, `idempotency_key`, `nonce`, and `pass_id`.

The server rejects invalid signatures, unknown or revoked keys, wrong events, stale timestamps, altered payloads, and reused nonces. Accepted check-ins are unique per event and pass. Ticket/pass tokens, encrypted templates, face images, embeddings, and biometric material are not persisted by Phase 2 ticket, pass, audit, or check-in tables.

## Verification

Run from the repository root with local Supabase active:

```bash
pnpm verify:phase2
pnpm --filter @face-pass/gate test:provisioning
node scripts/test-edge-functions.ts
```

`verify:phase2` checks the schema, RLS prerequisites, constraints, transactional functions, ticketing coverage, and the live auth/API/concurrency/signature flow. `scripts/test-edge-functions.ts` is retained as a compatibility entry point and launches the same authoritative integration suite.

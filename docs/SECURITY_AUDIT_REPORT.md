# Security Audit Report

## Focaccia Monorepo

Audit date: 2026-04-08

Scope reviewed:
- `apps/web`
- `apps/enrollment`
- `apps/gate`
- `packages/shared`
- `supabase/functions`
- `supabase/migrations`

## Executive Summary

The audit identified and remediated seven concrete issues:

1. Anonymous pass issuance was not bound to the attendee join code.
2. Edge functions could leak internal configuration and secret-store failure details.
3. Enrollment and gate mobile inference paths did not guarantee deletion of all temporary image files on exceptional paths.
4. Pass issuance left additional sensitive buffers in memory longer than necessary.
5. Gate replay persistence used `insert or replace` with a single-column primary key, which was weaker than the single-use requirement.
6. Offline token parsing did not explicitly reject oversized payloads before decode.
7. Web sign-out did not explicitly clear Supabase browser storage and SSR cookies.

The database/RLS review did not find an overly permissive organizer/attendee policy. Existing Supabase RLS remained appropriately owner-scoped, so no new SQL migration was required.

## Findings And Fixes

### 1. Anonymous pass issuance was not bound to the join code

- Severity: High
- Category: OWASP A01 Broken Access Control
- Affected area: `supabase/functions/issue-pass`
- Risk:
  The anonymous `issue-pass` function accepted a valid `payload.event_id` and returned a server signature without requiring the event join code again. An attacker who learned an `event_id` and constructed a valid payload could ask the backend to sign a pass outside the intended enrollment capability boundary.
- Fix implemented:
  - `IssuePassRequest` now requires `join_code`.
  - `issue-pass` normalizes and validates `join_code`.
  - Event lookup now requires both `event_id` and `join_code`.
  - Enrollment callers now send `join_code` when requesting the signature.
  - Edge-function integration tests now assert that omitting `join_code` fails.
- Files changed:
  - `supabase/functions/_shared/types.ts`
  - `supabase/functions/issue-pass/index.ts`
  - `apps/enrollment/src/lib/api.ts`
  - `apps/enrollment/app/capture.tsx`
  - `apps/enrollment/scripts/verify-enrollment-flow.ts`
  - `scripts/test-edge-functions.ts`

### 2. Enrollment bundle lookup leaked join codes through query strings

- Severity: Medium
- Category: OWASP A02 Cryptographic Failures, OWASP A05 Security Misconfiguration
- Affected area: `supabase/functions/get-enrollment-bundle`
- Risk:
  `get-enrollment-bundle` accepted `GET` and allowed `join_code` in the URL query string, which is easier to leak via browser history, reverse proxies, logs, screenshots, and copied links.
- Fix implemented:
  - `get-enrollment-bundle` is now POST-only.
  - `join_code` is read only from the JSON body.
  - Integration tests now assert that the legacy `GET` path is rejected.
- Files changed:
  - `supabase/functions/get-enrollment-bundle/index.ts`
  - `scripts/test-edge-functions.ts`

### 3. Edge functions exposed internal config and secret-store details

- Severity: Medium
- Category: OWASP A05 Security Misconfiguration
- Affected area: `supabase/functions/_shared/*`, `create-event`, `provision-gate`, `revoke-pass`, `delete-event`
- Risk:
  Missing env vars, malformed secret envelopes, and secret persistence failures could surface raw internal error text to callers. Those responses exposed implementation details that are useful during service fingerprinting and incident escalation.
- Fix implemented:
  - Added shared `ApiError` helpers with hidden vs exposed error handling.
  - Runtime config validation now throws hidden internal errors with generic client messages.
  - Secret-store failures now return generic client errors while preserving server-side logs.
  - Auth failures now use structured 401 errors.
  - Direct database error leaks in `provision-gate` and `revoke-pass` were replaced with generic responses.
  - `create-event` duplicate `event_id` errors were normalized to a safe 409 message.
- Files changed:
  - `supabase/functions/_shared/api.ts`
  - `supabase/functions/_shared/env.ts`
  - `supabase/functions/_shared/secret-store.ts`
  - `supabase/functions/_shared/supabase.ts`
  - `supabase/functions/create-event/index.ts`
  - `supabase/functions/provision-gate/index.ts`
  - `supabase/functions/revoke-pass/index.ts`
  - `supabase/functions/delete-event/index.ts`

### 4. Temporary image files and raw output tensors were not guaranteed to be cleared on every mobile inference path

- Severity: High
- Category: OWASP A02 Cryptographic Failures
- Category: ISO/IEC 24745 biometric reference protection, secure lifecycle handling
- Affected area:
  - `apps/enrollment/src/lib/embedding-model.ts`
  - `apps/gate/src/lib/embedding-model.ts`
- Risk:
  The aligned crop file created for TFLite inference was deleted only on the happy path. If an exception occurred between image manipulation and model output handling, the aligned crop could remain on disk. The raw model output buffer also remained uncleared after being copied into a safe return value.
- Fix implemented:
  - Added best-effort file deletion helpers.
  - Guaranteed aligned crop deletion in `finally`.
  - Guaranteed source photo deletion in `finally`.
  - Zeroed aligned image bytes after use.
  - Zeroed raw model output buffers after copying.
- Files changed:
  - `apps/enrollment/src/lib/embedding-model.ts`
  - `apps/gate/src/lib/embedding-model.ts`

### 5. Pass issuance retained more biometric-adjacent memory than necessary

- Severity: Medium
- Category: OWASP A02 Cryptographic Failures
- Category: ISO/IEC 24745 irreversibility, unlinkability, lifecycle minimization
- Affected area: `apps/enrollment/src/lib/pass-flow.ts`
- Risk:
  Event salt bytes, gate public key bytes, random pass-id/nonce buffers, encrypted template bytes, and canonical payload bytes all remained live longer than necessary during local pass assembly.
- Fix implemented:
  - Added explicit zeroization for event salt, gate public key, pass-id bytes, nonce bytes, encrypted template bytes, and canonical payload bytes in `finally`.
  - Confirmed that `cancelableTemplateV1` already salts the template derivation with `event_salt` and clears its own working buffers.
  - Confirmed that X25519 sealing uses libsodium sealed boxes, which rely on fresh ephemeral randomness internally and do not expose caller-managed nonces.
- Files changed:
  - `apps/enrollment/src/lib/pass-flow.ts`
  - Review-only confirmation in `packages/shared/src/template.ts`
  - Review-only confirmation in `packages/shared/src/crypto.ts`

### 6. Gate replay persistence was weaker than the single-use requirement

- Severity: Medium
- Category: OWASP A04 Insecure Design
- Affected area:
  - `apps/gate/src/lib/gate-db.ts`
  - `apps/gate/src/state/gate-context.tsx`
  - `apps/gate/src/lib/sqlite-port.ts`
  - `apps/gate/src/lib/expo-db.ts`
  - `apps/gate/scripts/verify-offline-flow.ts`
- Risk:
  The local `used_passes` table previously used `pass_id` as the only primary key and `markPassUsed()` used `insert or replace`. That design did not provide a definitive duplicate-insert signal and was weaker than an event-scoped single-use ledger.
- Fix implemented:
  - Migrated the local SQLite schema to an `(event_id, pass_id)` primary key.
  - Replaced `insert or replace` with `insert or ignore`.
  - `markPassUsed()` now returns whether the insert actually succeeded.
  - Gate state now converts a duplicate acceptance attempt into `REPLAY_USED` if the insert is rejected.
  - Offline gate verification script passed after the schema change.
- Files changed:
  - `apps/gate/src/lib/gate-db.ts`
  - `apps/gate/src/state/gate-context.tsx`
  - `apps/gate/src/lib/sqlite-port.ts`
  - `apps/gate/src/lib/expo-db.ts`
  - `apps/gate/scripts/verify-offline-flow.ts`

### 7. Offline token parsing lacked an explicit size guard

- Severity: Low
- Category: OWASP A04 Insecure Design
- Affected area: `apps/gate/src/lib/offline-verifier.ts`
- Risk:
  Malformed base64url, invalid JSON, and bad signatures were already rejected safely, but there was no explicit upper bound on token size before decode.
- Fix implemented:
  - Added a hard maximum token length before base64url decode.
  - Removed dead parsing code.
  - Added unit tests for malformed and oversized token rejection.
- Files changed:
  - `apps/gate/src/lib/offline-verifier.ts`
  - `apps/gate/test/offline-verifier.test.ts`

### 8. Web sign-out did not explicitly clear client storage and SSR auth cookies

- Severity: Medium
- Category: OWASP A07 Identification and Authentication Failures
- Affected area: `apps/web`
- Risk:
  The organizer sign-out UI only called `supabase.auth.signOut()` and redirected. That did not explicitly clear browser storage keys or SSR cookies created by the Supabase SSR client, which is weaker than a strict sign-out boundary.
- Fix implemented:
  - Added a client-side sign-out helper that:
    - signs out locally,
    - clears matching `localStorage` and `sessionStorage` keys,
    - clears matching document cookies,
    - POSTs to a new route handler that expires matching SSR cookies.
  - Updated both organizer sign-out entry points to use the hardened helper.
  - Added a unit test for storage cleanup.
- Files changed:
  - `apps/web/lib/sign-out.ts`
  - `apps/web/app/auth/sign-out/route.ts`
  - `apps/web/components/layout/nav-user.tsx`
  - `apps/web/components/layout/user-menu.tsx`
  - `apps/web/test/sign-out-storage.test.ts`

### 9. Vulnerable transitive dependencies

- Severity: High/Medium
- Category: OWASP A06 Vulnerable and Outdated Components
- Affected packages:
  - `@xmldom/xmldom@0.8.11`
  - `brace-expansion@1.1.12`
  - `brace-expansion@2.0.2`
- Fix implemented:
  - Updated Expo patch versions in mobile apps.
  - Updated `@types/node` in `packages/shared`.
  - Added root `pnpm.overrides` to force patched transitive versions:
    - `@xmldom/xmldom@0.8.12`
    - `brace-expansion@1.1.13`
    - `brace-expansion@2.0.3`
  - Re-ran `pnpm audit --json` until the advisory list was empty.
- Files changed:
  - `package.json`
  - `apps/enrollment/package.json`
  - `apps/gate/package.json`
  - `packages/shared/package.json`
  - `pnpm-lock.yaml`

## Database And RLS Review

Reviewed files:
- `supabase/migrations/20260325074043_layer1_infrastructure.sql`
- `supabase/migrations/20260325124500_edge_function_secrets.sql`

Result:
- RLS is enabled and forced on `events`, `gate_devices`, `revocations`, and `gate_logs`.
- Authenticated access is owner-scoped through `created_by`.
- `anon` has no direct table privileges.
- `edge_event_secrets` remains service-role only.
- No attendee query path was found for protected tables.
- No organizer cross-event data exposure was found in the SQL policies.

Because no permissive RLS defect was found, no new timestamped SQL migration was added.

## Verification Performed

Commands executed successfully after remediation:

- `pnpm audit --json`
- `pnpm --filter @face-pass/shared test`
- `pnpm --filter @face-pass/enrollment typecheck`
- `pnpm --filter @face-pass/gate typecheck`
- `pnpm --filter @face-pass/gate test:offline`
- `pnpm --filter @face-pass/gate test:provisioning`
- `node --experimental-strip-types apps/enrollment/scripts/verify-enrollment-flow.ts`
- `node scripts/test-edge-functions.ts`
- `pnpm run db:verify`
- `node --test apps/gate/test/offline-verifier.test.ts apps/web/test/sign-out-source.test.ts apps/web/test/sign-out-storage.test.ts`
- `pnpm --filter web build`

Observed results:
- `pnpm audit --json` returned zero known vulnerabilities.
- The edge-function integration suite passed with the new `join_code` requirement and POST-only enrollment bundle lookup.
- Enrollment end-to-end issuance produced a valid signed token and decrypted template.
- Offline gate verification passed, including replay rejection.
- Database schema verification confirmed forced RLS and least-privilege grants.

## Residual Risks

Residual risks that remain by design:

- A fully compromised attendee or gate device can still inspect transient in-memory state at runtime.
- The active liveness flow remains a pragmatic prototype control, not a high-assurance PAD system.
- The architecture remains intentionally single-gate per event; distributed replay prevention is out of scope.

## Recommended Next Steps

1. Add explicit rate limiting for anonymous enrollment functions.
2. Add a mobile regression test that asserts temporary photo files are removed even when TFLite inference throws.
3. Consider telemetry or alerting for repeated `invalid_join_code`, `BAD_TOKEN`, and `REPLAY_USED` spikes.

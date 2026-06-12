# Phase 0: Discovery And Decision Lock

Date: 2026-06-11

Status: decision-complete; implementation has not started.

## 1. Scope And Evidence

This document is the implementation contract for Phases 1-9. It was produced from the current repository, not from the older documents alone. Phase 0 changes documentation only.

Evidence reviewed:

- `README.md`, `PRD.md`, `ARCHITECTURE.md`, and every required document named by the Global Contract.
- All three existing applications, `packages/shared`, all current migrations, all current Edge Functions, Expo/iOS configuration, verification scripts, and tests.
- Current git state and available local tooling.

Current verification on 2026-06-11:

| Check | Result |
|---|---|
| Git baseline | Clean `main`, matching `origin/main` before this document was added |
| Shared tests | PASS, 9/9 |
| Web source/unit tests | PASS, 35/35 |
| Web production build | PASS |
| Enrollment typecheck | PASS |
| Enrollment pass-flow test | PASS |
| Enrollment full discovered test set | FAIL, 15/16; stale font test expects IBM Plex names while `src/theme.ts` uses system fonts |
| Gate typecheck | PASS |
| Gate offline flow | PASS, including accept, replay, revocation, and CSV generation |
| Gate full discovered test set | FAIL, 13/14; same stale font expectation |
| Supabase env-preparation tests | PASS, 2/2 |
| Database, RLS, live Edge Function, LAN-device, tunnel, simulator, and physical-device checks | BLOCKED in this Phase 0 shell: Supabase CLI/services and device/tunnel sessions are unavailable |

The two font-test failures are baseline contradictions. They are not fixed in Phase 0 because production code and tests are outside this phase's edit scope.

## 2. Current-State Audit

### 2.1 Authentication And Roles

- Supabase email/password auth exists and local email confirmation is disabled.
- `apps/web` exposes organizer signup directly. Any authenticated user is treated as an organizer by middleware and `requireOrganizer()`.
- There is no `organizer_profiles`, `attendee_profiles`, organizer allowlist, or protected organizer-grant operation.
- Event ownership is currently `events.created_by = auth.uid()`. RLS isolates event rows by creator, but does not establish an organizer role.
- The enrollment app has no attendee authentication or session persistence.
- The gate app signs in as an organizer and keeps the access token only in React state. Revocation refresh depends on that organizer session.

### 2.2 Events, Tickets, Claims, And Passes

- Event creation generates an 8-character event join code, event salt, and Ed25519 signing keypair.
- The signing private key and queue-code key are encrypted with a project wrapping key and stored in service-role-only `edge_event_secrets`.
- There is no public event catalogue, `apps/tickets`, event listing flag, location, description, global capacity, ticket type, attendee ticket, ticket activity log, or checkout.
- The event join code is an event-wide enrollment capability. It is not a ticket-scoped claim code and has about 40 bits before modulo bias, below the new 50-bit claim-code requirement.
- `get-enrollment-bundle` is public and accepts only the join code. It does not authenticate or prove ticket ownership.
- `issue-pass` is public and accepts join code plus a caller-created payload. It creates no ticket/pass row, has no idempotency, no generation limit, and can sign unlimited passes for anyone possessing the event join code.
- Current pass tokens use the required canonical JSON, Ed25519 signature, X25519 sealed template, event binding, validity window, and single-use field.

### 2.3 Gate Provisioning, Offline Verification, Revocations, And Dashboard Data

- Provisioning creates one X25519 encryption keypair. The private key uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; only its public key is stored server-side.
- There is no separate Ed25519 synchronization keypair or gate synchronization authentication.
- Offline gate verification currently checks token shape/size, canonical encoding, signature, event, time, replay, cached revocation, decryption, liveness, and face match.
- Successful acceptance is inserted atomically into the local `used_passes` primary key before the result is committed to local logs.
- Revocations are manually refreshed from the table using an organizer bearer token. There is no automatic refresh, cache-age policy, mandatory pre-door check, or stale warning threshold.
- Gate attempts remain local. There is no durable sync queue, `record-gate-checkin`, nonce ledger, signed check-in, retry policy, or automatic dashboard update.
- `gate_logs` is designed for manually uploaded CSV links, but no upload function exists. The dashboard therefore cannot update from current gate activity.
- Dashboard realtime listens only for event provisioning changes. Dashboard counts cover events, revocations, and uploaded log rows, not tickets or check-ins.

### 2.4 Networking, Supabase, Expo, And Distribution

- Current clients read one Supabase URL and infer/rewrite local hosts from the browser request or Expo host. This directly conflicts with explicit `local|tunnel` selection and the prohibition on silent fallback/rewrite.
- Web and mobile examples default to loopback. This cannot work from a physical phone without rewriting or manual replacement.
- CORS is `Access-Control-Allow-Origin: *`.
- Supabase Auth redirects are loopback-only and include an incorrect HTTPS loopback entry.
- No repository-owned LAN reverse proxy, network-mode diagnostics, zrok configuration, Vercel ticket deployment, EAS profiles, or `eas.json` exists.
- iOS enables local networking without globally disabling ATS. The local-network usage text currently describes Expo discovery, not Focaccia's LAN Supabase requirement.
- No Apple/EAS project metadata or distribution evidence exists. TestFlight status is locked as **not configured**.

### 2.5 Existing Test Coverage Shape

- Strongest current coverage: shared cryptography, pass construction, offline verification, local replay/revocation behavior, URL rewriting helpers, web build, and source-level UI assertions.
- Missing: role/allowlist tests, ticket/RLS tests, capacity concurrency, idempotency, claim ownership, pass generations, signed gate sync, dashboard check-in updates, tickets app tests, coverage enforcement, tunnel tests, simulator automation, and physical-device acceptance.
- Several tests assert source text rather than behavior. The later phases must prefer behavioral unit, integration, browser, simulator, and device evidence.

## 3. Complete Loopback And Environment-Read Map

### 3.1 Runtime/configuration loopback assumptions

| Location | Current assumption | Required disposition |
|---|---|---|
| `supabase/config.toml` | API 54321, DB 54322, Studio API `127.0.0.1`, Auth site/redirect loopback | Keep DB and Studio host-only; replace Auth URLs from validated selected-mode origins; never expose 54322/Studio |
| `packages/shared/src/local-network.ts` | Hardcoded 54321; infers URL from Expo host; rewrites loopback/private hosts | Replace with explicit typed selected-mode configuration; no inference or rewriting |
| `apps/web/lib/browser-local-network.ts` | Rewrites configured local Supabase host to browser hostname | Remove from runtime path after typed config cutover |
| `apps/web/lib/server-local-network.ts` | Rewrites URL using request/server interface | Remove from runtime path after typed config cutover |
| `apps/web/lib/supabase/middleware.ts` | Rewrites local host inside auth middleware | Remove rewrite; consume validated mode URL |
| `apps/web/scripts/local-network.mjs` | Mirrors host-rewrite behavior | Replace with mode validation and diagnostics |
| `apps/web/scripts/verify-auth.mjs` | Hardcodes `http://localhost:3000` | Parameterize from selected web URL |
| `apps/web/scripts/verify-dashboard.mjs` | Hardcodes `http://localhost:3000` | Parameterize from selected web URL |
| `scripts/test-edge-functions.ts` | Uses localhost Origin and expects wildcard CORS | Parameterize and assert allowlist behavior |
| `scripts/prepare-supabase-functions-env.test.mjs` | Uses loopback Supabase fixtures | Keep as explicit host-only fixture or replace with mode-labelled fixtures |
| `apps/web/test/browser-local-network.test.ts` | Requires automatic loopback/private-host replacement | Replace with explicit mode and no-rewrite assertions |
| `apps/web/test/server-local-network.test.ts` | Requires request/server host rewriting and loopback preservation | Replace with explicit mode and selected URL assertions |
| `apps/enrollment/test/function-network.test.ts` | Requires Expo-host replacement of loopback/private URLs | Replace with local/tunnel validation and no-rewrite assertions |
| `apps/gate/test/network.test.ts` | Requires Expo-host replacement of loopback/private URLs | Replace with local/tunnel validation and no-rewrite assertions |
| `README.md`, `docs/EPQ_OPERATIONS_MANUAL.md` | Loopback browser/mobile instructions | Replace with explicit host-only, LAN, and tunnel instructions |
| `apps/web/.env.local.example`, `apps/enrollment/.env.example` | Loopback Supabase defaults | Replace with complete mode-specific examples and physical-device validation |
| `packages/shared/dist/local-network.js` | Generated copy of hardcoded port and rewrite behavior | Rebuild from the corrected source; never hand-edit |

Generated `packages/shared/dist/local-network.js` mirrors the source helper and must be rebuilt, not hand-edited.

### 3.2 Direct environment reads

| Location | Direct reads today | Locked replacement |
|---|---|---|
| `apps/web/lib/env.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | One web typed-config module reads all public/server variables once; all consumers receive parsed config |
| `apps/enrollment/src/lib/env.ts` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | One enrollment typed-config module reads selected mode and mode URLs once |
| `apps/gate/src/lib/env.ts` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | One gate typed-config module reads selected mode and mode URLs once |
| `supabase/functions/_shared/env.ts` | `SUPABASE_URL`, `FACE_PASS_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FACE_PASS_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FACE_PASS_SUPABASE_SERVICE_ROLE_KEY`, `FACE_PASS_SECRET_WRAPPING_KEY_B64URL`, `FACE_PASS_MATCH_THRESHOLD`, `FACE_PASS_LIVENESS_TIMEOUT_MS`, `FACE_PASS_QUEUE_CODE_DIGITS` through generic `Deno.env.get` | Expand this single server-only parser; no function reads `Deno.env` directly |
| `supabase/config.toml` | Active `OPENAI_API_KEY`, `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`, `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`, `S3_HOST`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`; commented examples `SECRET_VALUE` and `SENDGRID_API_KEY` | Keep Supabase-managed secrets server-side; disable unused integrations or validate only when enabled; document separately from application config |

Scripts that parse `.env` files are tooling, not runtime reads, but must migrate to the same variable names and redact values in diagnostics.

## 4. Locked Product And Security Decisions

### 4.1 Organizer Role And Allowlist

1. `FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST` is a server-only comma-separated list of normalized exact email addresses. Empty, duplicate, malformed, wildcard, or non-email entries fail startup.
2. `ensure-organizer` requires a valid Supabase user token, derives the email from `auth.users`, normalizes it with trim plus lowercase, and compares it in constant-shape application logic. The request body contains no email or user ID.
3. An allowlisted user receives an idempotent upsert into `organizer_profiles`. A non-allowlisted user receives `403 organizer_not_allowed`; the response never reveals the list.
4. Authenticated status alone never grants organizer access. Dashboard middleware performs only session routing; every organizer page/data mutation also checks `organizer_profiles` and event ownership server-side.
5. Existing event rows remain owned by `created_by`. Existing owners regain organizer access only after successfully running `ensure-organizer`; non-allowlisted historical users retain data but lose organizer operations.
6. Organizer signup UI becomes ordinary account signup plus protected organizer onboarding. No UI calls an account an organizer before the profile exists.

### 4.2 Profile Ownership

- `organizer_profiles.user_id` and `attendee_profiles.user_id` are primary keys referencing `auth.users(id)` with `on delete restrict` because tickets/audit evidence are retained.
- A user may hold both profiles; the roles are independent.
- Profile email is server-copied from Supabase Auth and never accepted from request bodies. It is not user-editable through table APIs.
- Attendees may select/update only their own non-authoritative profile fields. Organizers may select their own profile. Service operations may read the minimum profile data needed for owned events/tickets.
- `attendee_profiles.full_name` is required before checkout. Email comes from Auth; checkout confirmation displays but does not trust client-supplied identity.

### 4.3 Event And Ticket-Type Model

- Add event `description`, `location`, `capacity`, `is_listed`, `updated_at`, and lifecycle metadata. Capacity is a positive integer and cannot be reduced below already consuming tickets.
- Every event creation transaction inserts exactly one active `General Admission` ticket type with GBP currency, zero price, and type capacity equal to event capacity.
- Additional ticket types use integer `price_pence >= 0`, currency fixed to `GBP`, optional positive capacity, active/sort fields, and unique normalized name per event.
- A type with `price_pence > 0` is publicly visible as unavailable and is rejected by checkout with `paid_ticket_unavailable`.
- Public queries return only listed, non-deleted events and active ticket types. Unlisting does not invalidate existing tickets or passes.

### 4.4 Ticket And Pass State Machines

Ticket state is stored as a database enum/check and may change only through transactional server operations:

```text
claimed -> enrolled -> checked_in
claimed -> cancelled | revoked
enrolled -> cancelled | revoked
checked_in -> terminal
cancelled -> terminal
revoked -> terminal
```

- `claimed`, `enrolled`, and `checked_in` consume event/type capacity. `cancelled` and `revoked` release capacity. Historical rows remain indefinitely.
- Each attendee has at most one ticket per event through `unique(event_id, attendee_user_id)`.
- Initial issuance changes `claimed -> enrolled`, creates generation 1, and sets `current_pass_id`.
- Regeneration is allowed only from `enrolled`, revokes the previous active pass in the same transaction, creates the next generation, and preserves `enrolled`.
- Maximum lifetime generation is 3. `generation_count` is monotonic except organizer reset, which explicitly revokes the active pass, clears `current_pass_id`, sets ticket to `claimed`, and resets `generation_count` to 0 as required by the Global Contract. Historical pass rows remain.
- Cancelling or revoking an enrolled ticket revokes its active pass in the same transaction.
- A valid signed gate acceptance changes `enrolled -> checked_in` and `active -> used`. Duplicate receipt is idempotent. Any non-enrolled ticket is rejected for new check-in except an identical previously recorded check-in.
- Pass state is `active | revoked | used`; `revoked` and `used` are terminal. Revocation records reference both ticket and pass while preserving the current `(event_id, pass_id)` gate feed.

### 4.5 Capacity Transaction Strategy

- Checkout is one PostgreSQL transaction exposed through a narrowly granted `security definer` database function called only by the Edge Function.
- It locks the event row and selected ticket-type row with `FOR UPDATE` in that order, validates listing/free/active state, checks the attendee/event unique constraint, counts capacity-consuming tickets, inserts the ticket/activity/idempotency result, and commits.
- The unique attendee/event constraint handles duplicate concurrent checkout. Row locks serialize final-seat requests. No read-then-insert capacity decision occurs in application code.
- Capacity checks use `claimed`, `enrolled`, and `checked_in`. Database constraints and integration tests are authoritative; UI remaining counts are advisory.

### 4.6 Claim Codes

- Ticket claim code format is 12 Crockford Base32 characters grouped `XXXX-XXXX-XXXX`, using an unambiguous 32-character alphabet. Entropy is 60 bits from rejection-sampled random bytes.
- The canonical input is uppercase without hyphens. Display always includes hyphens.
- Store only `HMAC-SHA-256(FOCACCIA_CLAIM_CODE_PEPPER, canonical_code)` for lookup plus an encrypted recovery value when needed for cross-device display. The pepper and encryption key are server-only and validated at startup.
- Claim-code lookup requires an authenticated attendee and matches both digest and `attendee_user_id`. Possession never transfers ownership.
- Invalid, foreign, cancelled, revoked, and missing codes return the same `404 ticket_not_found` envelope. Apply per-user and per-IP rate limits with a default of 10 attempts per 10 minutes and an auditable cooldown.
- Event join codes remain temporarily for migration compatibility, then are removed from enrollment authorization. They are not ticket claim codes.

### 4.7 Idempotency

- Mutating APIs listed by the Global Contract require an `Idempotency-Key` header containing a lowercase RFC 4122 UUID v4.
- Scope is `(authenticated_actor_or_gate_id, operation, key)`. Store request SHA-256 over canonical method/path/body, status, resource ID, completion state, timestamps, and an encrypted minimal response snapshot when exact replay is required.
- Reuse with a different request hash returns `409 idempotency_conflict`. A completed identical request returns the stored semantic result and creates no duplicate ticket, pass, activity, revocation, audit entry, or check-in.
- In-progress records expire after 2 minutes and can be recovered transactionally; completed records are retained with audit evidence. No password, access token, claim-code plaintext, full pass token, biometric value, or gate private key is stored.
- Required operations: checkout, cancellation, initial issuance/regeneration, organizer reset, organizer revocation, and gate check-in.

## 5. Locked API Contract

### 5.1 Common Envelope

Success:

```json
{"ok":true,"data":{},"request_id":"uuid","meta":{}}
```

Failure:

```json
{"ok":false,"error":{"code":"stable_code","message":"Plain English message","field_errors":{}},"request_id":"uuid"}
```

- JSON only; schema validation at every boundary; unknown fields rejected for mutations.
- Pagination uses opaque cursor plus `meta.next_cursor`; no total count unless the query already computes it safely.
- `401` means missing/invalid auth, `403` role/ownership denial, `404` non-enumerating absence, `409` state/idempotency/capacity conflict, `422` validation, `429` rate limit, and `503` selected-mode dependency unavailable.
- Server logs include `request_id`, operation, actor ID, and safe error code only. Sensitive bodies and credentials are never logged.

### 5.2 Operations

| Operation | Auth and input | Locked output/effect |
|---|---|---|
| `ensure-organizer` | User bearer token; no body | Organizer profile summary or `organizer_not_allowed` |
| `ensure-attendee` | User bearer token; `{full_name}` | Own attendee profile with Auth-derived email |
| `get-public-events` | Public; filters/cursor | Listed event cards and active types |
| `get-public-event` | Public; `{event_id}` | Listed event detail, types, advisory availability |
| `create-event` | Organizer; event fields + initial capacity | Event plus default GA, atomically |
| `update-event` / `delete-event` | Owning organizer | Updated/soft-deleted event; destructive rules audited |
| `manage-ticket-type` | Owning organizer | Create/update/deactivate type; cannot invalidate issued tickets |
| `claim-free-ticket` | Attendee; `{event_id,ticket_type_id}` + idempotency | Claimed ticket and claim code; paid/sold-out conflicts are stable codes |
| `cancel-ticket` | Owning attendee; `{ticket_id}` + idempotency | Cancelled ticket and pass revocation when applicable |
| `list-my-tickets` | Attendee; cursor | Own tickets only |
| `get-my-ticket` | Attendee; `{ticket_id}` or `{claim_code}` | Own ticket only; non-enumerating code errors |
| `get-enrollment-bundle` | Attendee; owned ticket selector | Ticket-bound event crypto/public policy; no secret or foreign ticket data |
| `issue-pass` | Attendee; `{ticket_id,payload}` + idempotency | Signature, queue code if retained, generation, pass metadata; never full token |
| `reset-attendee-pass` | Owning organizer; `{ticket_id}` + idempotency | Claimed ticket, old pass revoked, count reset |
| `revoke-ticket` | Owning organizer; `{ticket_id,reason}` + idempotency | Revoked ticket/pass and audit activity |
| `organizer-event-summary` | Owning organizer | Counts, ticket rows, activity, gate/revocation/check-in state |
| `provision-gate` | Owning organizer session from gate | Gate bundle after both public keys are registered |
| `get-gate-revocations` | Gate-signed request | Versioned revocation snapshot/delta and server time |
| `record-gate-checkin` | Gate-signed canonical payload | Idempotent check-in receipt and ticket transition |

## 6. Gate Provisioning And Synchronization Contract

### 6.1 Key Material

- Provisioning generates two independent keypairs on the gate:
  - X25519 encryption keypair for template decryption.
  - Ed25519 synchronization keypair for server authentication.
- Both private keys use iOS SecureStore with this-device-only accessibility. Only public keys are sent to `gate_devices`.
- `gate_devices` stores `pk_gate_event`, `sync_public_key`, key version, provisioned/revoked timestamps, and event ownership. One active gate remains enforced per event.

### 6.2 Canonical Check-In Payload

The gate signs UTF-8 bytes from the shared canonical JSON helper over exactly these fields, excluding `signature`:

```json
{
  "decision":"ACCEPT",
  "event_id":"event-id",
  "gate_timestamp":"2026-06-11T12:34:56.789Z",
  "idempotency_key":"uuid-v4",
  "nonce":"base64url-16-random-bytes",
  "pass_id":"base64url-pass-id"
}
```

Transport adds only `signature` as base64url Ed25519 bytes. No organizer/attendee token, ticket ID, biometric data, full pass token, private key, Hamming distance, or face-derived value is sent.

Server verification order:

1. Strict schema and canonical field validation.
2. Resolve the one active gate by `event_id`; reject unknown/revoked key.
3. Verify Ed25519 signature over the exact canonical payload.
4. Require UUID v4 idempotency key and 128-bit nonce; atomically reject a previously used nonce with a different request.
5. Timestamp: reject more than 5 minutes in the future, older than 72 hours, outside the event window by more than 24 hours, or before gate provisioning. This permits bounded offline queueing while still enforcing freshness.
6. Resolve ticket/pass server-side from `(event_id, pass_id)` and apply the state transition transactionally.

Duplicate identical receipt returns success. Wrong event, tampering, unknown key, nonce replay, stale timestamp, revoked pass, and invalid ticket state use stable non-sensitive error codes.

### 6.3 Durable Queue

- On ACCEPT, local replay marking and local decision/log commit happen before UI acceptance. A sync queue row is committed in the same SQLite transaction as the used-pass row.
- Queue fields are only the canonical payload, signature, attempt count, next-attempt time, and safe status/error code.
- Retry is bounded exponential backoff with jitter: 5 seconds, 15 seconds, 1 minute, 5 minutes, then 15 minutes capped; pause while offline/backgrounded and retry on foreground/network restoration.
- A server duplicate is treated as synchronized. Sync failure never reverses entry.

## 7. Revocation Refresh And Staleness

- Provisioning must complete one successful initial revocation snapshot before scanning is enabled.
- While online, refresh on app foreground, network restoration, manual pre-door action, and every 60 seconds during an active gate session.
- Cache age is always visible. `fresh` is at most 5 minutes, `stale` is over 5 minutes, and `critical` is over 30 minutes or never synchronized.
- The pre-door-opening workflow passes only with a successful refresh less than 5 minutes old and a matching event/gate key version.
- Once an initial snapshot exists, stale/critical status warns prominently but does not disable offline verification. Decisions use the latest cached revocations.
- UI and docs state that revocations created after disconnection apply only after a later refresh. No instant-offline-revocation claim is permitted.

## 8. Network And Build Decisions

### 8.1 Typed Configuration

- `FOCACCIA_NETWORK_MODE` is mandatory and exactly `local` or `tunnel`; it is never inferred.
- Server variables are the seven Global Contract variables plus server-only allowlist, claim-code, idempotency, signing-wrapping, and rate-limit secrets.
- Browser/mobile bundles receive only selected, correctly prefixed public mode, public URLs, and anon key. A typed helper validates both the selected URL set and cross-origin consistency, strips trailing slashes, rejects placeholders, and returns `Local network` or `Tunnel` diagnostics.
- Local physical-device builds reject loopback. Tunnel mode requires HTTPS. No helper rewrites a configured tunnel URL or silently falls back.

### 8.2 Local Topology

```text
physical/browser devices
  -> http://<FOCACCIA_LOCAL_HOST>:3000 apps/web
  -> http://<FOCACCIA_LOCAL_HOST>:3001 apps/tickets
  -> http://<FOCACCIA_LOCAL_HOST>:54321 Supabase gateway, when LAN-reachable
  -> http://<FOCACCIA_LOCAL_HOST>:54331 repository LAN proxy, only when 54321 is loopback-only
host Mac
  -> 127.0.0.1:54321 Supabase upstream
  -> 127.0.0.1:54322 PostgreSQL, never LAN-exposed
  -> 127.0.0.1:54323 Studio, never LAN-exposed
```

- Web apps bind `0.0.0.0`; Expo uses LAN mode.
- A second physical device test decides direct 54321 versus fallback proxy. Same-host curl is insufficient evidence.
- Fallback is a repository-owned Node reverse proxy bound only to `FOCACCIA_LOCAL_HOST:54331`, with a fixed upstream `127.0.0.1:54321`, HTTP and WebSocket upgrade support, path allowlist for `/auth/v1`, `/rest/v1`, `/functions/v1`, `/realtime/v1`, and required `/storage/v1`, request-size/time limits, no forward-proxy behavior, and no secret logging.
- Local verification requires every tunnel process stopped and no configured tunnel URL.

### 8.3 Tunnel Topology

- zrok v2 exposes only `127.0.0.1:54321` through the reserved HTTPS Supabase share.
- The reserved account/share must be verified to remove the interstitial. Raw browser, Auth, REST, Functions, and Realtime probes must return unmodified responses.
- `apps/tickets` is deployed separately to Vercel by default. `apps/web` may use a separate configured HTTPS URL. Application code remains provider-neutral.
- Tunnel failure never affects an already provisioned gate's offline decision.

### 8.4 CORS And Auth

- Browser Origins are an exact validated set from selected web/tickets URLs. Wildcard CORS is removed.
- Native requests without `Origin` are allowed only when they carry the expected API authentication/signature for that endpoint. Unknown browser Origins are rejected.
- Auth Site URL is the selected tickets URL. Redirect allowlists include exact selected web/tickets auth routes for local and tunnel profiles; no wildcard or loopback is used in physical-device acceptance.

### 8.5 Expo, ATS, And EAS

- Both mobile apps receive `development-local`, `development-tunnel`, `preview-local`, `preview-tunnel`, and `production-tunnel` profiles. Environment values come from named EAS environments; committed files contain no secrets or machine-specific LAN IP.
- Local profiles embed `EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=local` and validated LAN URLs. Tunnel profiles embed `tunnel` and HTTPS URLs.
- Changing any Expo public variable requires Metro restart; changing a distributed build's mode/URL requires rebuild.
- `NSLocalNetworkUsageDescription` explicitly explains connection to the organizer's Mac-hosted Focaccia services.
- Keep `NSAllowsArbitraryLoads=false`. Permit local HTTP only through the narrow local-network mechanism/domain exception required by the final tested iOS build; tunnel mode must pass HTTPS validation.
- TestFlight status remains **not configured** until Apple Developer team access, EAS project linkage, signing credentials, App Store Connect apps, internal install, and any external beta review are evidenced.

## 9. Migration And Compatibility Sequence

All schema work uses new timestamped migrations; existing migrations are immutable.

1. **Preflight and backup:** dump schema/data, count existing event owners/revocations, verify no duplicate IDs, record current function/app versions.
2. **Roles and helpers:** add profile tables, role predicates, audit table, rate-limit/idempotency foundations. Existing event data remains readable only after allowlisted owners onboard.
3. **Event catalogue:** add nullable/defaulted event fields, ticket types, and atomically backfill General Admission for every current event. Keep current event identifiers and crypto columns.
4. **Tickets and passes:** add tickets, encrypted/digested claim material, passes, activity, generation constraints, and ticket-linked revocations. Preserve legacy revocation rows and backfill links where resolvable.
5. **Transactional operations:** add capacity/checkout/issuance/reset/revoke/check-in database functions and tests before exposing new APIs.
6. **Gate sync:** add sync public keys, key version, nonce ledger, check-ins, revocation feed version, and dashboard realtime publication.
7. **API/client bridge:** deploy new functions while old clients still read additive columns. Deploy tickets/web/enrollment/gate in dependency order. New enrollment authorization is ticket-only.
8. **Security cutover:** disable anonymous join-code issuance and organizer-by-auth behavior, tighten RLS/grants/CORS, and remove legacy URL inference.
9. **Cleanup:** remove obsolete join-code enrollment paths and manual log-upload surfaces only after local and tunnel acceptance proves no active dependency.

No migration deletes retained ticket/audit evidence. Destructive cleanup is delayed to a separate migration after verified backups and client cutover.

## 10. Rollback And Recovery

- Before every migration phase: `supabase db dump` schema/data, export migration list, tag/commit app versions, and record secret/key versions without values.
- Rollback is forward-fix by default. Additive columns/tables stay in place; traffic is returned to the prior app/function version only while compatibility remains.
- If a migration transaction fails, it rolls back wholly. If post-migration verification fails, stop writes, restore the preflight dump into a fresh local project, and compare row counts/checksums before resuming.
- Never roll back by deleting audit, ticket, pass, revocation, nonce, or check-in evidence.
- Compromised organizer credentials: revoke sessions, rotate password, review audit log.
- Compromised server secret: rotate wrapping/claim/idempotency keys with versioned re-encryption; revoke affected passes if signing integrity is uncertain.
- Lost/compromised gate: revoke gate key version, provision a replacement, revoke/reissue active passes encrypted to the old gate key, refresh revocations, and retain old check-in evidence.
- Corrupt gate SQLite: stop entry, export diagnostics if possible, reprovision from the server, complete a fresh revocation snapshot, and do not claim prior replay state is recoverable unless synchronized check-ins prove it.

## 11. Exact Current Files Likely To Change

Existing files:

```text
package.json
pnpm-workspace.yaml
README.md
ARCHITECTURE.md
docs/ARCHITECTURE.md
docs/ASSUMPTIONS.md
docs/EPQ_OPERATIONS_MANUAL.md
docs/EVALUATION_PLAN.md
docs/PRIVACY_BY_DESIGN.md
docs/THREAT_MODEL.md
docs/Focaccia-threat-model.md
docs/TRUTH_BASE.md
supabase/config.toml
supabase/functions/_shared/api.ts
supabase/functions/_shared/cors.ts
supabase/functions/_shared/env.ts
supabase/functions/_shared/supabase.ts
supabase/functions/_shared/types.ts
supabase/functions/create-event/index.ts
supabase/functions/delete-event/index.ts
supabase/functions/get-enrollment-bundle/index.ts
supabase/functions/issue-pass/index.ts
supabase/functions/provision-gate/index.ts
supabase/functions/revoke-pass/index.ts
scripts/test-edge-functions.ts
scripts/verify-db-schema.sh
scripts/prepare-supabase-functions-env.mjs
scripts/prepare-supabase-functions-env.test.mjs
packages/shared/src/index.ts
packages/shared/src/index.deno.ts
packages/shared/src/types.ts
packages/shared/src/canonical-json.ts
packages/shared/src/local-network.ts
packages/shared/package.json
packages/shared/test/crypto.test.ts
apps/web/package.json
apps/web/next.config.ts
apps/web/proxy.ts
apps/web/lib/env.ts
apps/web/lib/functions.ts
apps/web/lib/data.ts
apps/web/lib/types.ts
apps/web/lib/browser-local-network.ts
apps/web/lib/server-local-network.ts
apps/web/lib/supabase/browser.ts
apps/web/lib/supabase/server.ts
apps/web/lib/supabase/middleware.ts
apps/web/app/login/page.tsx
apps/web/app/(secure)/layout.tsx
apps/web/app/(secure)/dashboard/page.tsx
apps/web/app/(secure)/events/new/page.tsx
apps/web/app/(secure)/events/[eventId]/page.tsx
apps/web/app/(secure)/events/[eventId]/logs/page.tsx
apps/web/app/(secure)/events/[eventId]/provisioning/page.tsx
apps/web/app/(secure)/events/[eventId]/revocations/page.tsx
apps/web/components/auth/auth-card.tsx
apps/web/components/providers/auth-provider.tsx
apps/web/components/dashboard/create-event-form.tsx
apps/web/components/dashboard/event-creation-form.tsx
apps/web/components/dashboard/event-table.tsx
apps/web/components/dashboard/gate-logs-panel.tsx
apps/web/components/dashboard/gate-provisioning-listener.tsx
apps/web/components/dashboard/gate-provisioning-view.tsx
apps/web/scripts/local-network.mjs
apps/web/scripts/verify-auth.mjs
apps/web/scripts/verify-dashboard.mjs
apps/web/.env.local.example
apps/web/test/auth-card-source.test.ts
apps/web/test/auth-feedback.test.ts
apps/web/test/brand-config.test.ts
apps/web/test/browser-local-network.test.ts
apps/web/test/dashboard-adapters.test.ts
apps/web/test/edge-function-response.test.ts
apps/web/test/event-lifecycle.test.ts
apps/web/test/event-table-source.test.ts
apps/web/test/functions.test.ts
apps/web/test/logo-source.test.ts
apps/web/test/server-local-network.test.ts
apps/web/test/sign-out-source.test.ts
apps/web/test/sign-out-storage.test.ts
apps/enrollment/package.json
apps/enrollment/app.json
apps/enrollment/app/_layout.tsx
apps/enrollment/app/index.tsx
apps/enrollment/app/consent.tsx
apps/enrollment/app/capture.tsx
apps/enrollment/app/pass.tsx
apps/enrollment/app/help.tsx
apps/enrollment/src/lib/env.ts
apps/enrollment/src/lib/api.ts
apps/enrollment/src/lib/types.ts
apps/enrollment/src/lib/pass-flow.ts
apps/enrollment/src/lib/function-network.ts
apps/enrollment/src/state/enrollment-context.tsx
apps/enrollment/ios/FacePassEnrollment/Info.plist
apps/enrollment/scripts/verify-enrollment-flow.ts
apps/enrollment/.env.example
apps/enrollment/test/face-crop.test.ts
apps/enrollment/test/font-consistency.test.ts
apps/enrollment/test/function-api.test.ts
apps/enrollment/test/function-network.test.ts
apps/enrollment/test/logo-consistency.test.ts
apps/enrollment/test/pass-flow.test.ts
apps/enrollment/test/responsive-metrics.test.ts
apps/gate/package.json
apps/gate/app.json
apps/gate/app/_layout.tsx
apps/gate/app/index.tsx
apps/gate/app/provision.tsx
apps/gate/app/scan.tsx
apps/gate/app/liveness.tsx
apps/gate/app/result.tsx
apps/gate/app/settings.tsx
apps/gate/src/lib/env.ts
apps/gate/src/lib/api.ts
apps/gate/src/lib/network.ts
apps/gate/src/lib/provisioning.ts
apps/gate/src/lib/types.ts
apps/gate/src/lib/gate-db.ts
apps/gate/src/lib/offline-verifier.ts
apps/gate/src/lib/expo-secure-store.ts
apps/gate/src/lib/secure-value-store.ts
apps/gate/src/state/gate-context.tsx
apps/gate/ios/FacePassGate/Info.plist
apps/gate/scripts/verify-offline-flow.ts
apps/gate/scripts/verify-provisioning-flow.ts
apps/gate/test/face-crop.test.ts
apps/gate/test/font-consistency.test.ts
apps/gate/test/logo-consistency.test.ts
apps/gate/test/network.test.ts
apps/gate/test/offline-verifier.test.ts
apps/gate/test/responsive-metrics.test.ts
```

Expected new surfaces:

```text
apps/tickets/**
apps/enrollment/eas.json
apps/gate/eas.json
scripts/demo-*.mjs
scripts/verify-network-*.mjs
scripts/lan-supabase-proxy.mjs
supabase/migrations/<new timestamps>_*.sql
supabase/functions/ensure-organizer/index.ts
supabase/functions/ensure-attendee/index.ts
supabase/functions/get-public-events/index.ts
supabase/functions/get-public-event/index.ts
supabase/functions/claim-free-ticket/index.ts
supabase/functions/cancel-ticket/index.ts
supabase/functions/list-my-tickets/index.ts
supabase/functions/get-my-ticket/index.ts
supabase/functions/manage-ticket-type/index.ts
supabase/functions/reset-attendee-pass/index.ts
supabase/functions/revoke-ticket/index.ts
supabase/functions/organizer-event-summary/index.ts
supabase/functions/get-gate-revocations/index.ts
supabase/functions/record-gate-checkin/index.ts
```

Generated `packages/shared/dist/**`, Next output, native generated files, and lockfiles change only through their normal build/install processes.

## 12. Contradictions That Must Be Resolved

1. Global Contract requires four product surfaces; repository has three and no ticketing app.
2. Current docs describe a three-component prototype and sometimes claim `gate-sync`/log upload exist; code has neither.
3. Current auth calls every account an organizer; required model uses a server-only allowlist and explicit role.
4. Current enrollment/pass issuance trusts an event-wide join code; required model requires attendee auth, owned ticket, and ticket-scoped claim code.
5. Current schema has no capacity or ticket state, so oversell and generation limits cannot be enforced.
6. Current URL helpers infer and rewrite hosts; required mode must be explicit and never fall back.
7. Current wildcard CORS and loopback Auth URLs violate the completed deployment contract.
8. Current gate revocation sync uses organizer credentials; required autonomous sync uses a separate gate key.
9. Current dashboard expects manual CSV links; required dashboard updates automatically from signed check-ins.
10. Existing architecture/truth documents lock Expo Dev Builds and older three-app scope, while the new Global Contract adds tickets, dual networking, TestFlight conditionality, and production authorization.
11. Current operations documentation presents localhost as the primary workflow and cannot prove physical-device LAN operation.
12. The committed font consistency tests conflict with the current mobile theme implementation.

## 13. Objective Evidence For Later Phase Gates

| Phase | Pass evidence; any missing item is FAIL |
|---|---|
| 1 Network | Config unit coverage >=80% line/branch; invalid-mode matrix; exact CORS/Auth assertions; `lsof` proves no DB/Studio LAN listener; second physical device reaches Auth/REST/Functions/Realtime with all tunnels stopped; zrok raw HTTP/API probes show HTTPS and no interstitial; EAS profile/config inspection passes |
| 2 Roles/schema/APIs | Clean local reset; schema/RLS assertions; allowlist denial/grant; cross-owner denial; concurrent final-seat test with exactly one success; idempotency conflict/replay tests; all state/generation tests; signed gate payload tamper/replay/staleness tests; database scan proves no token/biometric columns or values |
| 3 Tickets | Tickets build/typecheck/unit/integration/E2E coverage; desktop/mobile Browser evidence; local physical phone signup and real GBP 0 checkout with tunnel processes absent; paid/sold-out/idempotent cases; remote tunnel checkout without interstitial |
| 4 Dashboard | Role-gated E2E; full event/type creation transaction; listing visibility; ownership isolation; revoke/reset audit rows; signed check-in changes dashboard counts automatically; CSV sensitive-field denylist test |
| 5 Enrollment | Typecheck/tests/coverage; simulator run; physical local attendee login, owned ticket selection/claim, consent/capture, generation 1-3, generation 4 rejection, reset recovery; foreign claim denial; no sensitive logs/files; tunnel build proof; distribution status exactly one allowed value |
| 6 Gate | Networking disabled before scan; valid ACCEPT then REPLAY_USED; SQLite transaction test proves used-pass plus queue row; restart preserves queue; local and tunnel signed sync; dashboard receipt; retry/idempotency; cache-age thresholds and mandatory pre-door workflow; queue schema contains no sensitive fields |
| 7 UI | Browser desktop/mobile screenshots, keyboard/focus/label/contrast automation, reduced-motion and overflow checks, supported iOS simulator sizes, physical safe-area/touch check, zero actionable UI-review findings, zero TODO/placeholder/dead controls |
| 8 Docs | Every variable/command mechanically checked against source; local runbook executed without tunnel; tunnel runbook executed; no join-code-only/instant-revocation claim found by repository search; EPQ checklist links to real evidence |
| 9 Final | Clean reset/build/test/audit report; complete local physical-device flow with all tunnels stopped; complete tunnel flow and offline-tunnel-failure gate proof; simulator and prepared-device evidence; TestFlight result exactly `verified`, `blocked by credentials/review`, or `not configured`; no mocked required path |

## 14. Phase 0 Pass Gate

- Production code changed: **No**.
- Requested decisions locked: **Yes**, in Sections 4-10.
- High-impact product/security ambiguity: **None remaining**. Numeric operational defaults are explicit and may change only through a documented decision update before implementation.
- Local and tunnel physical-device requirements testable: **Yes**, with distinct objective evidence in Sections 8 and 13.
- Current end-to-end product working: **No claim made**. The repository is a smaller baseline and cannot satisfy the future product acceptance until Phases 1-9 are implemented.

Phase 0 stops here.

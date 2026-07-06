# Focaccia End-to-End EPQ Build Prompt Pack

> Historical implementation prompt pack. It records requested phases and pass gates, not current deployment status or operating instructions. Use `TRUTH_BASE.md`, `NETWORK_MODES.md`, and `EPQ_OPERATIONS_MANUAL.md` for implemented behavior.

Execute these prompts in order. The Global Contract applies to every phase. Do not begin a later phase until the current phase's pass gate has been met and evidenced.

## Global Contract

```text
You are working in /Users/manavcodaty/repos/Focaccia.

MISSION

Build a complete, production-quality AQA EPQ artifact that lets real attendees:

1. Browse listed events from any phone browser.
2. Create an attendee account.
3. complete a real free-ticket checkout.
4. Receive a ticket confirmation and ticket-scoped claim code.
5. Sign into the iOS enrollment app with the same account.
6. Select the owned ticket or enter its claim code.
7. Complete consent and on-device face enrollment.
8. Receive a signed event pass.
9. Present that pass to the iOS gate app.
10. Be accepted only after offline signature, replay, revocation, liveness, and face-match checks.
11. Have the organizer dashboard update automatically when the gate can synchronize.

This is not a mock. Do not leave TODOs, placeholder controls, fake data paths, dead links, unimplemented states, security bypasses, or manual operational steps where automation is required.

REPOSITORY ARCHITECTURE

- apps/web: organizer dashboard
- apps/tickets: new public ticketing application
- apps/enrollment: attendee iOS app
- apps/gate: offline gate iOS app
- packages/shared: cross-runtime types and deterministic helpers
- supabase/migrations: PostgreSQL schema and RLS
- supabase/functions: privileged business logic
- docs: architecture, privacy, threat model, operations, and EPQ evidence

READ BEFORE IMPLEMENTING

Read AGENTS.md, README.md, PRD.md, ARCHITECTURE.md, docs/ARCHITECTURE.md, docs/TRUTH_BASE.md, docs/DESIGN.md, docs/UI_UX_SPEC.md, docs/EPQ_OPERATIONS_MANUAL.md, docs/THREAT_MODEL.md, docs/Focaccia-threat-model.md, docs/PRIVACY_BY_DESIGN.md, docs/ASSUMPTIONS.md, docs/EVALUATION_PLAN.md, every current migration and Edge Function, relevant source/tests in all three existing apps, and packages/shared.

Treat current code as evidence. Resolve stale documentation instead of copying it blindly.

IDENTITY AND AUTHORIZATION

Use Supabase email/password authentication with email confirmation disabled for this controlled EPQ deployment.

Create organizer_profiles and attendee_profiles. An authenticated user is not automatically an organizer.

Use a server-only FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST. Implement a protected ensure-organizer operation that grants organizer status only when the authenticated email is allowlisted. Never expose the allowlist through NEXT_PUBLIC_*, EXPO_PUBLIC_*, browser bundles, logs, or API responses.

Require organizer role and event ownership for:

- organizer dashboard access
- event creation/update/deletion
- ticket-type management
- attendee/ticket inspection
- CSV export
- gate provisioning
- revocation
- pass reset
- event activity inspection

Attendee email must come from the verified Supabase Auth user. Do not trust email or user ID supplied in a request body.

NETWORK MODES

Support exactly two first-class modes:

FOCACCIA_NETWORK_MODE=local|tunnel

Never infer the mode from whichever URL is available. Never silently fall back between modes.

Local mode:

- No tunnel process is required or allowed for verification.
- Supabase, Edge Functions, apps/web, and apps/tickets run on the host Mac.
- Audience devices use the same LAN/Wi-Fi.
- Physical devices use the Mac's stable LAN IPv4 address, never localhost or 127.0.0.1.
- apps/web and apps/tickets bind to 0.0.0.0.
- Metro/Expo uses LAN mode where applicable.
- Gate decisions work with networking disabled.
- Core operation requires no internet after dependencies and apps are installed.

Tunnel mode:

- Local Supabase remains on the host Mac.
- The Supabase gateway at 127.0.0.1:54321 is exposed through a stable HTTPS tunnel.
- Use zrok v2 as the documented default free service.
- Reserve a chosen *.share.zrok.io name.
- Require account verification that removes the browser interstitial before declaring tunnel mode usable.
- Verify raw browser and API requests reach Supabase without an interstitial or modified response.
- Deploy apps/tickets separately to Vercel or expose it through HTTPS.
- Application code remains provider-neutral and reads only configured URLs.
- Gate verification remains offline-capable if the tunnel fails.

Use explicit variables equivalent to:

FOCACCIA_NETWORK_MODE
FOCACCIA_LOCAL_HOST
FOCACCIA_LOCAL_SUPABASE_URL
FOCACCIA_LOCAL_WEB_URL
FOCACCIA_LOCAL_TICKETS_URL
FOCACCIA_TUNNEL_SUPABASE_URL
FOCACCIA_TUNNEL_WEB_URL
FOCACCIA_TUNNEL_TICKETS_URL

Add correctly prefixed NEXT_PUBLIC_* and EXPO_PUBLIC_* variables only where required. Never expose service-role keys, signing secrets, database credentials, organizer allowlists, tunnel credentials, or gate private keys.

Implement typed configuration helpers per runtime. They must:

- accept only local or tunnel
- validate selected-mode URLs
- normalize trailing slashes
- reject placeholders and malformed values
- reject localhost/127.0.0.1 for physical-device local mode
- require HTTPS for tunnel mode
- prevent mixed local/tunnel origins
- fail fast with actionable messages
- expose a safe Local network or Tunnel diagnostic label
- never silently rewrite a configured tunnel URL into a LAN URL

Expo public variables are embedded at bundle/build time. Changing network mode requires restarting Metro and may require a rebuild. Add separate local and tunnel EAS profiles and document this behavior.

LOCAL SUPABASE REACHABILITY

Do not assume Supabase CLI port 54321 is reachable from the LAN. Verify it from a second device.

If the Supabase gateway is loopback-only, implement a repository-owned LAN reverse proxy supporting required HTTP and WebSocket traffic. Bind the proxy to the chosen LAN interface, restrict it to the necessary upstream, and do not expose PostgreSQL port 54322 or Supabase Studio publicly.

Configure CORS from validated local/tunnel origins. Remove wildcard CORS for the completed deployment while permitting native app requests that legitimately omit Origin. Configure Supabase Auth Site URL and redirect allowlists for both modes.

IOS NETWORKING

- Add a clear local-network permission description.
- Use the narrowest viable App Transport Security exception for HTTP LAN mode.
- Do not globally disable ATS.
- Require HTTPS validation in tunnel mode.
- Distinguish wrong mode, host unreachable, local-network permission denied, timeout, auth failure, and Edge Function unavailable.
- Never log passwords, access tokens, claim codes, pass tokens, or biometric values.

TICKET MODEL

- Every event receives General Admission by default.
- Organizers can add ticket types and prices.
- Currency is GBP.
- A ticket type with price > 0 is visible as unavailable but cannot be checked out.
- One attendee can hold at most four active tickets per event, enforced by the ticket claim transaction and a database trigger.
- Every event has global capacity.
- Ticket types may have optional capacity; enforce both event and type capacities transactionally.
- General Admission defaults to the event capacity.
- Checkout must not oversell under concurrent final-seat requests.
- Sold-out events show Sold out and reject checkout.
- Tickets and audit logs are retained indefinitely for EPQ evidence.

Lock the state machine:

- claimed -> enrolled -> checked_in
- claimed|enrolled -> cancelled
- claimed|enrolled -> revoked
- checked_in is terminal

Cancelling or revoking an enrolled ticket must create a pass revocation. Resetting an enrolled ticket must revoke the old pass, clear pass_id, set status to claimed, and reset generation_count to 0. Regeneration must revoke the previous pass before issuing the replacement.

The initial pass issuance is generation 1. The maximum is 3 total generations per ticket. Enforce this server-side.

CLAIM CODES AND IDEMPOTENCY

- Generate a human-readable ticket claim code with at least 50 bits of entropy.
- Store an appropriate protected representation if feasible; never rely on obscurity.
- Possession is insufficient: authenticated ticket ownership is mandatory.
- Rate-limit claim-code lookup and return non-enumerating errors.
- Add idempotency keys to checkout, cancellation, pass issuance/regeneration, organizer reset, and gate check-in.
- Repeated identical requests must not create duplicate tickets, passes, audit entries, or check-ins.

PRIVACY AND CRYPTOGRAPHY

Never store centrally:

- raw face images or video
- reusable face embeddings
- cancelable biometric templates
- decrypted templates
- full signed pass tokens
- gate private keys
- ordinary-row event signing private keys
- attendee passwords

The backend must not perform biometric comparison. Preserve event-scoped templates, encryption to the gate public key, offline signature verification, local liveness, local matching, replay protection, and revocation checks.

GATE CHECK-IN AUTHENTICATION

Create a separate Ed25519 synchronization keypair during provisioning. This is distinct from the X25519 template-encryption keypair.

- Store the sync private key in iOS SecureStore with this-device-only protection.
- Store only the sync public key in gate_devices.
- Canonically sign each check-in payload.
- Server verifies signature, event binding, timestamp freshness, nonce, and idempotency key.
- Send only event_id, pass_id, decision, gate_timestamp, nonce, idempotency_key, and signature.
- Resolve ticket_id server-side from event_id + pass_id.
- Never embed the service-role key or rely on an attendee/organizer access token for autonomous gate sync.

Gate acceptance order:

1. Complete all offline verification.
2. Atomically mark the pass used locally.
3. Display/enforce ACCEPT.
4. Persist the signed non-biometric sync item.
5. Attempt synchronization asynchronously.

Sync failure must never reverse or block an entry decision.

REVOCATION LIMITATION

An offline gate cannot know about a cancellation or revocation made after its last revocation refresh. Do not claim instant revocation while disconnected.

Implement:

- automatic refresh while online
- visible cache age
- mandatory pre-door-opening refresh check
- warning when the cache is stale
- continued offline decision capability using the latest cached data

IOS DISTRIBUTION

Prepared, provisioned organizer-owned devices are the guaranteed fallback.

Audience-owned iPhones are supported only after Apple Developer/TestFlight credentials and distribution are verified. External TestFlight may require beta review. Report distribution as exactly one of:

- verified
- blocked by credentials/review
- not configured

Do not claim arbitrary audience-owned iPhone support merely because simulator or development builds pass.

UI CONTRACT

Before UI work, read docs/DESIGN.md and use all user-required frontend/mobile skills. Preserve Focaccia tokens and identity. When skills conflict, prioritize repository design, usability, accessibility, performance, and transaction speed. Do not force dark mode, giant radii, glass effects, excessive animation, a new icon system, or marketing layouts.

User-facing language must be plain English. Implement loading, empty, error, offline, sold-out, paid-unavailable, claimed, enrolled, checked-in, cancelled, revoked, generation-limit, reset, sync-pending, sync-failed, and sync-complete states.

TEST STANDARD

- Use TDD where practical.
- Minimum 80% line and branch coverage for all new or materially modified business-logic modules.
- Unit, integration, database/RLS, browser E2E, iOS simulator, and physical-device tests are required according to risk.
- Do not lower or delete valid tests to pass.
- Run dependency/security audits and classify findings.
- Review all security-sensitive changes before phase completion.

Every phase ends at its pass gate. Do not implement later phases early.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 0: Discovery And Decision Lock

```text
Apply the Global Contract. Do not edit production code.

Audit the repository and produce a decision-complete plan covering current auth, event creation, join codes, pass issuance, gate provisioning, revocations, local networking, Supabase reachability, Expo build configuration, dashboard data, and tests.

Explicitly map every localhost/127.0.0.1 assumption and every direct environment-variable read.

Lock before implementation:

- organizer role and allowlist flow
- attendee and organizer profile ownership
- ticket and pass state transitions
- event/type capacity transaction strategy
- claim-code format and ownership validation
- idempotency-key format and storage
- API request/response contracts
- gate sync canonical payload and signature verification
- revocation refresh/staleness policy
- local Supabase LAN topology and reverse-proxy fallback
- local/tunnel EAS profiles
- TestFlight prerequisite status
- migration sequence and compatibility
- tests and rollback/recovery strategy

List exact current files likely to change, contradictions found, and objective pass/fail evidence for each later phase.

PASS GATE

- No production code changed.
- Every decision above is locked.
- No unresolved high-impact product or security ambiguity remains.
- Both network modes and physical-device requirements are testable.

Stop after Phase 0.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 1: Dual-Mode Network Foundation

```text
Apply the Global Contract.

Implement typed local/tunnel configuration, example env files, local/tunnel EAS profiles, URL selection, CORS allowlisting, Auth redirects, iOS local-network/ATS configuration, and startup diagnostics.

Add root commands equivalent to:

- pnpm demo:local
- pnpm demo:tunnel
- pnpm demo:status
- pnpm verify:network-config
- pnpm verify:local-network
- pnpm verify:tunnel-network

The scripts must validate mode, host IP, URLs, ports, Supabase health, Auth, Edge Functions, web app, ticket app when present, and safe origin configuration without printing secrets.

Test Supabase port 54321 from a second device. If unavailable, implement and verify the constrained LAN reverse proxy. Do not expose PostgreSQL or Studio.

TESTS

- valid local and tunnel modes
- invalid/absent mode
- missing selected URL
- malformed or placeholder URL
- loopback rejection for physical-device local mode
- non-HTTPS tunnel rejection
- no mixed origins
- trailing-slash normalization
- public/server secret separation
- native no-Origin CORS request
- rejected unauthorized browser origin
- EAS profile selection
- iOS local-network configuration

PASS GATE

- Local mode works from a second physical device with every tunnel stopped.
- Tunnel mode reaches Supabase through zrok with no interstitial.
- Mode changes require and document Metro restart/rebuild behavior.
- Existing tests pass and new logic meets coverage threshold.

Stop after Phase 1.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 2: Roles, Ticket Schema, RLS, And APIs

```text
Apply the Global Contract.

Add new timestamped migrations without rewriting history.

Implement organizer_profiles, attendee_profiles, event fields, event_ticket_types, event_tickets, ticket_activity_log, gate sync public keys/nonces, idempotency records, and gate check-ins.

Implement database constraints and transactional operations for roles, ownership, four active tickets per attendee/event, capacities, statuses, generation limits, unique pass/check-in identities, and paid-ticket blocking.

Implement Edge Functions or equivalent operations:

- ensure-organizer
- get-public-events
- get-public-event
- claim-free-ticket
- cancel-ticket
- list-my-tickets
- get-enrollment-bundle
- issue-pass
- reset-attendee-pass
- revoke-ticket/pass integration
- organizer ticket summaries
- record-gate-checkin

Apply schema-based validation, server-derived identities, consistent response envelopes, rate limits, non-enumerating claim-code errors, and idempotency.

TESTS

- attendee cannot become organizer unless allowlisted
- attendee cannot access organizer operations
- organizer cannot access another organizer's events
- free checkout succeeds
- paid checkout fails
- duplicate and idempotent checkout behavior
- concurrent final-seat requests cannot oversell
- private event exclusion
- attendee data isolation
- cancellation/revocation state transitions
- issuance ownership and event match
- three-generation limit
- regeneration revokes old pass
- reset revokes old pass and returns ticket to claimed
- signed gate sync accepts valid payload and rejects tampering, replay, stale timestamp, wrong event, and unknown key
- no token/biometric persistence

PASS GATE

- Clean database reset applies all migrations.
- RLS and integration tests pass.
- Concurrency and idempotency tests pass.
- Existing crypto/pass tests pass.
- New/modified business logic meets coverage threshold.

Stop after Phase 2.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 3: Public Ticket Application

```text
Apply the Global Contract.

Create apps/tickets as a separate workspace Next.js app using existing repository versions and Focaccia design tokens.

Implement event listing, event detail, attendee signup/login, free checkout, confirmation, My tickets, ticket detail, cancellation, privacy information, and branded error/404 routes.

Show event name, organizer, date/time, location, description, active ticket types, GBP price, remaining capacity, privacy notice, listed status, and Sold out state.

Checkout must require authentication, confirm full name/email from trusted auth/profile data, show a real GBP 0 total, use an idempotency key, prevent repeated submission, and handle capacity races. Paid types remain visible but unavailable.

Confirmation and My tickets must show claim code, status, next enrollment step, and cross-device recovery through login.

Local mode binds to 0.0.0.0 and works over LAN with no Vercel or tunnel. Tunnel mode deploys separately to Vercel and uses only configured HTTPS Supabase URL.

TESTS AND VERIFICATION

- public/unlisted event behavior
- auth and session persistence
- successful, duplicate, idempotent, sold-out, paid-blocked, and network-failed checkout
- cancellation and terminal-state rules
- endpoint-mode selection and no secret leakage
- Browser/IAB desktop and mobile E2E
- keyboard, focus, labels, contrast, responsive overflow
- real physical-phone local checkout
- zrok/Vercel tunnel checkout where configured

PASS GATE

- Build, typecheck, tests, and coverage pass.
- Local physical phone creates a real ticket with all tunnels stopped.
- Tunnel browser receives no zrok interstitial.
- No placeholder UI remains.

Stop after Phase 3.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 4: Organizer Dashboard

```text
Apply the Global Contract.

Protect apps/web with organizer role checks in addition to authentication.

Implement organizer onboarding through the allowlist, event creation/editing, description, location, dates, capacity, listed toggle, default General Admission, additional ticket types, prices, and optional type capacities.

Show the correct mode-specific public ticket URL, gate state, lifecycle, capacity, claimed/enrolled/checked-in/cancelled/revoked totals, ticket table, generation status, activity history, revocation cache/sync context, and check-in updates.

Implement organizer revoke, reset, ticket-type management, search/filter, and CSV export. Confirm destructive actions, enforce ownership server-side, and audit every operation.

CSV must exclude biometric data, tokens, auth credentials, and private keys.

TESTS

- role-protected onboarding/dashboard
- complete event creation transaction
- listed/unlisted public behavior
- default and additional ticket types
- paid warning/blocking contract
- local/tunnel public-link selection
- ownership isolation
- revoke/reset consequences and audit
- dashboard count/check-in update
- idempotent duplicate sync
- CSV content and sensitive-field exclusion

PASS GATE

- Build, E2E, role, ownership, and coverage tests pass.
- Event appears publicly only when listed.
- Dashboard requires no manual log upload.
- UI review findings are fixed.

Stop after Phase 4.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 5: Enrollment App

```text
Apply the Global Contract.

Implement Supabase attendee signup/login, secure session persistence, logout/account switching, ticket list, ticket states, owned claim-code lookup, ticket-bound enrollment bundle, consent, capture, local processing, encrypted template, pass issuance, secure pass display/storage, and regeneration.

Use FlatList for ticket lists and iOS-appropriate touch/navigation patterns. Support attendee-owned and prepared devices.

Enforce authenticated ownership even when a claim code is supplied. Show remaining generation allowance. Prevent accidental duplicate issuance. Reflect organizer reset after refresh.

Local builds use LAN configuration and narrow ATS/local-network permissions. Tunnel builds use HTTPS. Add local and tunnel EAS profiles. Do not log sensitive values.

Prepared devices are guaranteed. TestFlight support is claimed only if credentials/distribution are verified; report status explicitly.

TESTS

- local/tunnel endpoint builds
- signup/login/session restore/logout hygiene
- ticket list and all statuses
- foreign/invalid/revoked/cancelled claim codes
- enrollment ownership
- issuance idempotency
- generation 1-3 and fourth rejection
- old-pass revocation on regeneration
- organizer reset recovery
- network/permission errors
- biometric non-persistence
- existing pass-flow regression

PASS GATE

- Typecheck, tests, coverage, and iOS simulator pass.
- Physical iPhone completes local enrollment without a tunnel.
- Tunnel build can enroll remotely when configured.
- TestFlight status is reported honestly.

Stop after Phase 5.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 6: Offline Gate And Signed Synchronization

```text
Apply the Global Contract.

Preserve all current offline verification behavior. Add the separate Ed25519 sync keypair during provisioning, secure storage, gate_devices public key, canonical signed check-in payload, durable SQLite sync queue, retries, idempotency, sync status, and automatic revocation refresh.

The queue must survive restart, use bounded exponential backoff, avoid battery-draining retries, preserve original gate time, and treat duplicate server receipt as success. Manual Retry is allowed; manual file upload is not required.

Add visible revocation cache age and mandatory pre-door-opening refresh workflow. Clearly state that new remote revocations cannot affect a disconnected gate until refresh.

TESTS

- valid offline acceptance with all networking disabled
- atomic replay marking before sync
- queue creation and restart persistence
- valid signed local/tunnel sync
- tampered payload/signature rejection
- nonce/idempotency replay rejection
- stale timestamp and wrong event rejection
- retry/backoff and duplicate receipt
- dashboard update
- revocation refresh/cache age/stale warning
- no sensitive queue fields
- existing offline/provisioning regression

PASS GATE

- Gate accepts valid pass offline.
- Replay remains blocked.
- Local sync works after LAN returns.
- Tunnel sync works when configured.
- Dashboard updates automatically.
- All gate tests and coverage pass.

Stop after Phase 6.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 7: UI, Accessibility, And Design QA

```text
Apply the Global Contract and every mandated UI/mobile skill.

Audit and polish apps/tickets, apps/web, apps/enrollment, and operational gate states against docs/DESIGN.md.

Verify every required loading, empty, error, network, lifecycle, ticket, pass, and sync state. Ensure plain English, WCAG-quality contrast/focus/labels, minimum mobile targets, reduced motion, safe areas, no overflow, and no task-blocking decoration.

Use Browser/IAB for web desktop/mobile screenshots and interaction tests. Use iOS simulators for supported sizes. Use physical devices for LAN permission and touch workflows. Run ui-review and resolve all actionable findings.

PASS GATE

- All required states exist and function.
- Screenshot and simulator reviews have no material unresolved issue.
- Accessibility tests pass.
- No TODO, placeholder, debug, dead control, or inconsistent Focaccia styling remains.

Stop after Phase 7.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 8: Documentation And EPQ Evidence

```text
Apply the Global Contract.

Update README.md and existing architecture, privacy, threat-model, assumptions, evaluation, and operations documents to match implemented behavior.

Document exact local mode, zrok tunnel mode, Vercel, Auth redirects, CORS, EAS profiles, ATS/local-network permissions, TestFlight status, organizer allowlist, startup commands, health checks, classroom workflow, fallback devices, recovery, revocation cache limitation, CSV evidence, and data retention.

State explicitly:

- Local mode needs no tunnel.
- Physical devices use the Mac LAN IP.
- At-home setup needs the active zrok tunnel and host Mac.
- Gate decisions remain offline.
- Revocations made while the gate is disconnected apply after refresh.
- Audience-owned iPhone installation is conditional on verified Apple distribution.

Add an EPQ evidence checklist for event creation, public listing, checkout, auth, enrollment, pass issuance, offline acceptance, replay rejection, queued sync, dashboard update, reset/revocation, CSV, local verification, tunnel verification, tests, privacy, and limitations.

PASS GATE

- Every command and variable matches real implementation.
- Every documented step maps to a tested screen/function.
- No stale join-code-only or instant-offline-revocation claim remains.

Stop after Phase 8.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

## Phase 9: Final Dual-Mode Acceptance

```text
Apply the Global Contract.

Run a clean end-to-end acceptance. Do not rely only on mocks, localhost, unit tests, or simulators.

BASELINE

- Review git status without reverting user work.
- Install dependencies.
- Cleanly reset/apply local migrations.
- Build shared packages.
- Run schema, RLS, unit, integration, browser, mobile, coverage, and security checks.
- Confirm no committed secrets or required-flow TODOs.

LOCAL ACCEPTANCE

1. Set local mode.
2. Stop every tunnel process.
3. Prove no configured application URL uses a tunnel.
4. Start Supabase, explicit Edge Functions, LAN proxy if required, apps/web, and apps/tickets.
5. Run network/config health checks.
6. From a second physical phone, load the LAN ticket site.
7. Verify attendee cannot access organizer functions.
8. Verify an allowlisted organizer can create a listed event with capacity and ticket types.
9. Complete real attendee signup and free checkout.
10. Prove duplicate/idempotent checkout and paid blocking.
11. Prove concurrent sold-out enforcement.
12. Log into enrollment on an iPhone, load the ticket, enroll, and issue generation 1.
13. Regenerate and prove the old pass is revoked; prove generation 4 is rejected.
14. Provision the gate and refresh revocations.
15. Disable gate networking and accept the current valid pass offline.
16. Prove replay rejection.
17. Prove check-in is queued.
18. Restore LAN; prove signed automatic sync and dashboard update.
19. Prove cancellation, revocation, and reset effects.
20. Export and inspect CSV.

Local acceptance fails if any tunnel is required.

TUNNEL ACCEPTANCE

1. Set tunnel mode and use the tunnel EAS/web configuration.
2. Start the reserved zrok v2 share.
3. Prove HTTPS and no browser/API interstitial.
4. Verify Vercel ticket app and Supabase Auth redirects.
5. From outside the LAN where practical, complete signup, free checkout, enrollment, and pass issuance.
6. Stop the tunnel and prove the issued pass still verifies offline.
7. Restore tunnel and prove signed queued sync.

DISTRIBUTION ACCEPTANCE

- Run enrollment and gate on iOS simulators.
- Run local mode on physical prepared devices.
- Verify TestFlight/internal/external distribution if credentials permit.
- Report Apple distribution as verified, blocked by credentials/review, or not configured.

REQUIRED COMMAND CLASSES

- database/schema verification
- network-config/local/tunnel verification
- shared build/tests
- web and tickets build/typecheck/tests
- enrollment typecheck/tests/simulator
- gate typecheck/offline/provisioning/simulator
- real Edge Function integration tests
- coverage reports for new/modified logic
- dependency/security audits

FINAL REPORT

Report exact commands and results, migrations, files changed, coverage, local proof with no tunnel, tunnel proof, zrok interstitial proof, browser evidence, simulator evidence, physical-device evidence, TestFlight status, security/privacy review, limitations, classroom runbook, and recovery procedure.

Do not claim completion if any required flow is mocked, LAN mode uses a tunnel, organizer roles are open, capacity can oversell, gate sync is unsigned, old regenerated passes remain valid, gate requires network, dashboard requires manual upload, physical-device local mode is untested, or biometric data is stored centrally.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

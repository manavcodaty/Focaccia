# Phase 9 Final Dual-Mode Acceptance

Date: 2026-06-15  
Environment: macOS, Node 26.3.0, pnpm 10.33.0, Supabase CLI 2.105.0, Colima  
Overall status: **ESCALATED - NOT ACCEPTED**

The automated, browser, local-network, iOS simulator, and physical-device launch checks passed. Final acceptance cannot be claimed because the required physical touch/camera/offline-radio workflow was not completed, tunnel/Vercel configuration was absent, and TestFlight distribution was not configured. These are required Phase 9 acceptance criteria, not optional evidence.

## Baseline And Database

- Existing dirty worktree was reviewed and preserved. No user work was reverted.
- `pnpm install --frozen-lockfile`: PASS.
- `DOCKER_HOST=ssh://colima supabase db reset --workdir .focaccia/runtime --local --no-seed`: PASS from a clean database.
- `pnpm db:verify`: PASS for tables, columns, defaults, constraints, forced RLS, expected policies, least-privilege grants, and Supabase lint.
- `pnpm verify:phase2-schema`: PASS.
- `pnpm verify:phase2`: PASS with real local Edge Functions, RLS, capacity, idempotency, pass generation, reset/revocation, and signed gate-sync integration.

The clean reset applied these migrations in order:

1. `20260325074043_layer1_infrastructure.sql`
2. `20260325124500_edge_function_secrets.sql`
3. `20260325124600_enable_events_realtime.sql`
4. `20260612090000_phase2_roles_and_event_catalogue.sql`
5. `20260612090100_phase2_tickets_passes_and_audit.sql`
6. `20260612090200_phase2_transactional_operations.sql`
7. `20260612090300_phase2_gate_sync_and_capacity_guards.sql`
8. `20260612090400_phase2_atomic_gate_provisioning.sql`
9. `20260612090500_phase2_pass_generation_cycles.sql`
10. `20260613090000_phase4_organizer_dashboard.sql`
11. `20260614090000_phase6_gate_revocation_sync.sql`
12. `20260615090000_phase9_gate_clock_skew.sql`

The Phase 9 migration fixes a real integration failure: a newly provisioned gate could be rejected when the application clock was a few milliseconds behind PostgreSQL. The functions still require a registered signing key, valid Ed25519 signature, event binding, nonce/idempotency protection, a five-minute freshness window for revocation refreshes, and the existing 72-hour/event window for queued check-ins; only the contradictory strict `timestamp >= provisioned_at` condition was removed. Tests now prove bounded clock skew is accepted.

## Verification Results

| Command | Result |
| --- | --- |
| `pnpm verify:network-config` | PASS, 42 tests across shared config, foundation, and CORS |
| `pnpm verify:local-network` | PASS, LAN Auth/web/tickets/CORS reachable; PostgreSQL and Studio not exposed |
| `pnpm verify:phase3` | PASS, tickets tests, typecheck, and production build |
| `pnpm verify:phase4` | PASS, organizer integration, web tests, CSV tests, and production build |
| `pnpm verify:phase5` | PASS, enrollment tests, typecheck, integration, and iOS export |
| `pnpm verify:phase6` | PASS, gate tests, typecheck, offline/provisioning checks, and iOS export |
| `pnpm audit --prod --audit-level high` | PASS, no known production dependency vulnerabilities |
| tracked-file secret scan | PASS, no high-confidence committed credentials |
| production `TODO/FIXME/HACK` scan | PASS, no required-flow placeholder found |
| `git diff --check` | PASS |

Coverage for the modified or new business logic:

| Area | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| Network configuration | 89.39% | 87.69% | 100% |
| Public ticketing | 100% | 95.24% | 90% |
| Organizer web | 89.04% | 82.89% | 84% |
| Enrollment | 93.05% | 81.76% | 94.44% |
| Gate | 98.97% | 87.16% | 97.92% |

## Local Acceptance

The running configuration selected `local` mode for every application. All configured public URLs used `192.168.0.141`; no URL selected zrok or another tunnel. Process inspection confirmed no `zrok`, `zrok2`, `cloudflared`, or `ngrok` executable was running.

`pnpm demo:local` started the constrained LAN proxy, explicit Edge Functions, organizer web app, and ticket app. `pnpm verify:local-network` proved:

- Supabase proxy `http://192.168.0.141:54331`: reachable.
- Organizer app `http://192.168.0.141:3000`: HTTP 200.
- Ticket app `http://192.168.0.141:3001`: HTTP 200.
- Auth health: HTTP 200.
- Allowed browser origin: HTTP 204.
- Unauthorized browser origin: HTTP 403.
- LAN PostgreSQL and Studio exposure: blocked.

Real Chromium acceptance over the LAN IP, rather than `localhost`, proved:

- Public listed and sold-out event rendering.
- Unauthenticated organizer dashboard redirect to login and allowlist messaging.
- Real attendee signup and free GBP 0 checkout through Supabase Auth and Edge Functions.
- Confirmation and My Tickets rendering.
- Duplicate checkout rejection in the UI.
- Exactly one database ticket for the browser attendee.
- Zero axe accessibility violations on the tested ticket, privacy, and organizer-login routes after fixing the login heading order.

The integration suite additionally proved same-key idempotent replay, paid-ticket blocking, concurrent final-seat enforcement without overselling, organizer allowlist/ownership isolation, three-generation enforcement, old-pass revocation on regeneration, reset behavior, signed sync, replay rejection, and dashboard updates.

Browser evidence:

- [Ticket app desktop](./evidence/phase9/tickets-desktop.png)
- [Ticket detail mobile viewport](./evidence/phase9/ticket-mobile.png)
- [Organizer login](./evidence/phase9/organizer-login-desktop.png)

**Physical-device result: PARTIAL, NOT ACCEPTED.** The paired iPhone became available during the run. `devicectl` opened `http://192.168.0.141:3001` in physical Safari, and the ticket server recorded the matching LAN homepage request. The enrollment and gate apps were development-signed, installed, launched on the iPhone, and fetched their Metro bundles successfully. The gate required `xcodebuild ... -allowProvisioningUpdates` to create its development profile; subsequent install and launch succeeded.

Physical commands and results:

- `xcrun devicectl device process launch --device 00008101-001D495036FA001E --payload-url http://192.168.0.141:3001 com.apple.mobilesafari`: PASS, followed by the LAN server `GET / 200`.
- `pnpm --dir apps/enrollment exec expo run:ios --device 00008101-001D495036FA001E --no-bundler`: build and install PASS; first launch was blocked until the development profile became trusted, then `devicectl` launch PASS and Metro bundle load PASS.
- `xcodebuild -workspace apps/gate/ios/FacePassGate.xcworkspace -configuration Debug -scheme FacePassGate -destination id=00008101-001D495036FA001E -allowProvisioningUpdates`: PASS and created the local development profile.
- `xcrun devicectl device install app --device 00008101-001D495036FA001E /Users/manavcodaty/Library/Developer/Xcode/DerivedData/FacePassGate-gavasccyflwrndfhuzbnmpyeogic/Build/Products/Debug-iphoneos/FacePassGate.app`: PASS.
- `xcrun devicectl device process launch --terminate-existing --device 00008101-001D495036FA001E com.facepass.gate`: PASS; the running process and Metro bundle load were confirmed.

Physical signup/checkout, camera enrollment, pass issuance, gate scan, replay attempt, actual radio disable/restore, queue persistence/sync, touch workflow, and explicit observation of the iOS local-network prompt were not performed. Host-side device control cannot attest those user interactions. Local acceptance consequently does not pass the Phase 9 gate despite verified physical LAN reachability and native app launch.

## Simulator Acceptance

- Enrollment: `pnpm --dir apps/enrollment exec expo run:ios --device 7940B27C-CB48-4413-879A-87886E35E427 --no-bundler` built with zero errors and launched against the LAN Metro URL. [Evidence](./evidence/phase9/enrollment-simulator.png).
- Gate: `pnpm --dir apps/gate exec expo run:ios --device 7940B27C-CB48-4413-879A-87886E35E427 --no-bundler` built with zero errors and launched the offline entry-control state. [Evidence](./evidence/phase9/gate-simulator.png).

Simulator evidence does not substitute for the required physical-device acceptance.

## Tunnel And Distribution Acceptance

Tunnel status: **NOT CONFIGURED**.

- `pnpm verify:tunnel-network`: expected failure because `.env.tunnel.local` is absent.
- `zrok2`/`zrok`: not installed or configured, so reserved-share HTTPS and no-interstitial behavior could not be tested.
- Vercel CLI/linkage: absent, so the deployed ticket app and live Auth redirects could not be tested.
- Outside-LAN signup, checkout, enrollment, issuance, offline verification, and queued-sync recovery: not tested.

Apple distribution status: **LOCAL DEVELOPMENT VERIFIED; TESTFLIGHT NOT CONFIGURED**.

- EAS reported no authenticated account.
- No EAS project IDs or configured App Store Connect/TestFlight credentials were available.
- Internal/external TestFlight installation and review status were not verified.
- Xcode automatic provisioning created a local development profile for the gate.
- Both enrollment and gate were installed and launched on the paired physical iPhone, and both loaded their LAN Metro bundles.

## Security And Privacy

- Organizer access remains allowlist-gated and server-authorized.
- Capacity and one-ticket rules are enforced transactionally in PostgreSQL.
- Gate sync requires Ed25519 signatures, registered public keys, bounded timestamps, event binding, nonce replay protection, and idempotency records.
- Offline decisions remain local; queued records preserve original gate time and sync automatically after connectivity returns.
- A disconnected gate cannot learn new remote revocations until its revocation snapshot refreshes.
- CSV tests exclude biometric data, tokens, credentials, and private keys.
- The public database schema contains zero column names matching biometric, face, or template storage.
- No central biometric payload was observed or introduced.

## Phase 9 Changes

- `supabase/migrations/20260615090000_phase9_gate_clock_skew.sql`: forward-only clock-skew compatibility fix.
- `scripts/test-phase2.mjs`: regression coverage for bounded gate clock skew.
- `scripts/verify-db-schema.sh`: aligned the verifier with the current organizer-aware RLS policy names and intentionally absent direct revocation mutation policies.
- `apps/web/components/auth/auth-card.tsx`: corrected heading hierarchy found by the accessibility audit.
- `docs/evidence/phase9/*`: browser and simulator screenshots.
- `docs/PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md`: this acceptance record.

Other dirty files predated or belong to prior phases and were not reverted.

## Classroom Runbook

1. Connect the host Mac and prepared iPhones to the same trusted Wi-Fi network.
2. Set the current Mac LAN IP in `.env.local`, then run `pnpm demo:local`.
3. Run `pnpm demo:status`, `pnpm verify:network-config`, and `pnpm verify:local-network` before admitting attendees.
4. Open the ticket URL shown by `demo:status`; do not substitute `localhost` on a phone.
5. Allowlist the organizer before sign-in, create the event, set ticket capacities, and list it.
6. Complete attendee checkout and enrollment on prepared devices.
7. Provision the gate, refresh revocations before doors open, and confirm the cache age is acceptable.
8. Disable gate networking only after refresh. Offline verification and replay prevention continue locally.
9. Restore LAN connectivity and confirm the signed queue drains and the dashboard updates automatically.
10. Keep a second prepared gate/enrollment device available; manual log-file upload is not part of the normal workflow.

## Recovery

- LAN address changed: stop services, update the local host value, regenerate app env files through the demo command, and restart Metro. Native embedded configuration may require a rebuild.
- Supabase unavailable: keep the gate offline, do not clear local state, restore the host stack, run the local network verifier, then allow the queue to retry.
- Stale revocation cache: reconnect and complete a successful refresh before opening doors. Revocations made while disconnected apply only after refresh.
- Lost attendee device: sign in on another prepared enrollment device and recover owned tickets; issuance generation limits and old-pass revocation still apply.
- Organizer reset: refresh enrollment state, complete enrollment again, and issue the next allowed generation.
- Tunnel outage: already-issued passes continue to verify offline. Remote checkout, enrollment, refresh, and sync remain unavailable until the host Mac and reserved tunnel return.

## Required Evidence Before Acceptance

Phase 9 can move from escalated to accepted only after all of the following are captured:

1. The connected physical phone completes the full local checkout and enrollment flow with every tunnel stopped; LAN site and native launch are already verified.
2. A physical gate accepts the current pass offline, rejects replay, persists the queue across restart, and automatically syncs after LAN restoration.
3. The reserved zrok v2 share passes HTTPS and no-interstitial checks, including outside-LAN checkout/enrollment and queued-sync recovery.
4. Vercel deployment and Supabase Auth redirects are verified against the configured tunnel URLs.
5. Apple distribution is explicitly classified using real credentials as verified, blocked by review/credentials, or intentionally not configured.

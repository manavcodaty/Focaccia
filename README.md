# Focaccia

Focaccia is a privacy-preserving event-entry EPQ artifact. Attendees browse listed events, create an account, claim a real free ticket, enroll on iOS, receive a signed event pass, and present it to an iOS gate that makes the entry decision offline.

The system has four applications:

- `apps/tickets`: public Next.js event catalogue, attendee authentication, free checkout, My tickets, cancellation, and recovery
- `apps/web`: organizer-only Next.js dashboard for events, ticket types, tickets, gate provisioning, reset/revocation, activity, and CSV export
- `apps/enrollment`: Expo iOS attendee app for owned-ticket selection, consent, local face processing, pass issuance, regeneration, and secure pass storage
- `apps/gate`: Expo iOS gate app for provisioning, revocation refresh, offline signature/replay/revocation/liveness/face checks, and durable signed synchronization

`packages/shared` contains deterministic crypto, template, type, and network helpers. Supabase supplies email/password Auth, PostgreSQL/RLS, Realtime, and Edge Functions.

## End-To-End Flow

1. An allowlisted organizer signs in and creates an event. General Admission is created by default.
2. The organizer lists the event and provisions one gate. Provisioning creates separate X25519 template-encryption and Ed25519 synchronization keys; private keys stay on the gate device.
3. An attendee browses `apps/tickets`, creates an account, and claims one free ticket for the event.
4. Checkout returns a ticket-scoped claim code. The code can select a ticket, but authenticated ownership is always required.
5. The attendee signs into `apps/enrollment` with the same account, selects the owned ticket, consents, and captures locally.
6. The app derives an event-scoped cancelable template, encrypts it to the gate public key, and requests a server-signed pass. Raw images, embeddings, and decrypted templates are not sent to Supabase.
7. The gate refreshes revocations before doors open, then can disconnect completely. It verifies the pass, blocks replay, runs liveness and local matching, and records `ACCEPT` or `REJECT` locally.
8. An accepted check-in is atomically queued with its original gate time. When connectivity returns, the gate signs and synchronizes it; the organizer dashboard updates automatically.

Gate decisions remain offline. A cancellation or revocation made while the gate is disconnected takes effect only after the next successful revocation refresh.

## Requirements

- Node.js `>=24`
- pnpm `10.33.0`
- Docker or Colima
- Supabase CLI
- Xcode for iOS builds and simulators
- Expo development builds, not Expo Go
- `zrok2` only for tunnel mode

Current principal versions are Next.js `16.2.6`, React `19.2.x`, Expo `55.0.12`, React Native `0.83.4`, and Supabase JS `2.100.0`.

## Local Mode

Local mode needs no tunnel. The Mac and every physical device must use the same LAN/Wi-Fi, and physical devices use the Mac's private IPv4 address rather than `localhost` or `127.0.0.1`.

```bash
pnpm install
cp .env.local.example .env.local
pnpm demo:local
```

Set these root values in `.env.local`:

```text
FOCACCIA_NETWORK_MODE=local
FOCACCIA_LOCAL_HOST=LAN_IP
FOCACCIA_LOCAL_SUPABASE_URL=http://LAN_IP:54331
FOCACCIA_LOCAL_WEB_URL=http://LAN_IP:3000
FOCACCIA_LOCAL_TICKETS_URL=http://LAN_IP:3001
FOCACCIA_DOCKER_HOST=ssh://colima
FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST=organizer@example.com
FOCACCIA_CLAIM_CODE_PEPPER=<base64url 32-byte secret or generated runtime value>
```

`demo:local` rejects a running zrok process, starts Supabase without Studio, starts Edge Functions, exposes only the constrained Supabase proxy on `LAN_IP:54331`, and binds both web apps to `0.0.0.0`. PostgreSQL `54322` and Studio `54323` must not be reachable from the LAN.

```bash
pnpm demo:status
pnpm verify:network-config
pnpm verify:local-network
```

## Tunnel Mode

At-home or remote setup needs the host Mac to remain powered, online, and running the local Supabase stack plus active zrok shares.

```bash
cp .env.tunnel.example .env.tunnel.local
pnpm demo:tunnel
pnpm verify:tunnel-network
```

Tunnel URLs must be HTTPS. `demo:tunnel` uses reserved zrok v2 shares for the constrained Supabase proxy, organizer app, and ticket app. The reserved account must be verified so raw browser/API requests do not receive an interstitial.

`apps/tickets` can instead be deployed separately to Vercel by supplying the same selected `NEXT_PUBLIC_*` values. No Vercel project is linked in this checkout, so a Vercel deployment is not currently verified.

## Mobile Builds

```bash
pnpm --dir apps/enrollment ios
pnpm --dir apps/gate ios
```

Both apps provide `development-local`, `development-tunnel`, `preview-local`, `preview-tunnel`, and `production-tunnel` EAS profiles. EAS supplies only the mode; the selected URLs and Supabase anon key must also exist in the matching EAS environment.

Changing `FOCACCIA_NETWORK_MODE` or any `EXPO_PUBLIC_*` value requires stopping Metro and restarting with `--clear`. Changes to `app.json`, ATS, local-network permissions, entitlements, or native dependencies require a rebuilt development client.

Prepared organizer-owned iPhones are the guaranteed fallback. Audience-owned iPhone installation is conditional on verified Apple distribution. EAS is not logged in, no EAS project/App Store Connect/TestFlight build is linked, and TestFlight status is **not configured**.

## Verification

```bash
pnpm db:verify
pnpm verify:network-config
pnpm verify:local-network
pnpm verify:tunnel-network
pnpm verify:phase2
pnpm verify:phase3
pnpm verify:phase4
pnpm verify:phase5
pnpm verify:phase6
```

Run `verify:tunnel-network` only after tunnel configuration is active. It fails closed when the HTTPS URLs, services, CORS, or zrok response are wrong.

## Evidence And Operations

- [Operations manual](./docs/EPQ_OPERATIONS_MANUAL.md)
- [Network modes](./docs/NETWORK_MODES.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Privacy by design](./docs/PRIVACY_BY_DESIGN.md)
- [Threat model](./docs/THREAT_MODEL.md)
- [Assumptions and current status](./docs/ASSUMPTIONS.md)
- [Evaluation and evidence checklist](./docs/EVALUATION_PLAN.md)
- [Phase 9 final dual-mode acceptance](./docs/PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md)
- [Artifact report](./docs/EPQ_ARTIFACT_REPORT.md)
- [Phase 8 verification record](./docs/PHASE_8_DOCUMENTATION_AND_EPQ_EVIDENCE.md)

The root `Auth-Card`, `Dashboard`, `Landing Page`, and `other/` folders are prototypes or supporting material and are not required to run the product workspaces.

Made by Manav Codaty

# Focaccia

Focaccia is a privacy-preserving event access prototype built around a simple claim: biometric entry does not need a central face database.

The repository implements a three-part system:

- a Next.js public ticket application for real attendee accounts and free checkout
- a Next.js organizer dashboard for event setup and operations
- an Expo iOS enrollment app that issues attendee passes from on-device face capture
- an Expo iOS gate app that verifies passes offline with local liveness, local replay checks, and local template matching

Raw face images, reusable embeddings, and cancelable templates are not stored in Supabase. The backend handles event administration and pass signing. The gate device handles the sensitive offline verification path.

## How it works

1. An organizer creates an event in the dashboard.
2. The backend generates an event-scoped join code, event salt, and signing keypair.
3. A gate device provisions itself from a QR payload and uploads only its public key.
4. An attendee uses the enrollment app to derive an event-scoped template on-device and request a signed pass.
5. The gate app verifies the signed token offline, decrypts the protected template locally, runs liveness, compares the live template, and blocks replay with local SQLite state.

## Repository layout

```text
.
├── apps/
│   ├── web/            # Next.js 16 organizer dashboard
│   ├── tickets/        # Next.js 16 public event and attendee ticket application
│   ├── enrollment/     # Expo iOS enrollment app
│   └── gate/           # Expo iOS gate verifier
├── packages/
│   └── shared/         # shared crypto, template, network, and type utilities
├── supabase/
│   ├── functions/      # Edge Functions for event creation, provisioning, issuance, revocation
│   └── migrations/     # schema, constraints, and RLS policies
├── docs/               # architecture, threat model, privacy, evaluation, operations manual
├── Auth-Card/          # standalone UI prototype, not part of the pnpm workspace
├── Dashboard/          # standalone UI prototype, not part of the pnpm workspace
└── Landing Page/       # standalone marketing prototype, not part of the pnpm workspace
```

## Tech stack

- Node.js 24+
- pnpm 10.33+
- Next.js 16 + React 19
- Expo 55 + React Native 0.83
- Supabase local development + Edge Functions
- libsodium for crypto primitives
- TFLite face embedding model on mobile

## Prerequisites

Before you run the stack locally, install:

- Node.js `>=24`
- `pnpm >=10.33`
- Docker
- Supabase CLI
- Xcode and an iOS simulator if you want to run the mobile apps

## Getting started

Install dependencies from the repository root:

```bash
pnpm install
```

Configure the explicit local profile:

```bash
cp .env.local.example .env.local
```

Set the Mac's stable private IPv4 in `.env.local`. On macOS, the recommended topology is Colima with automatic port forwarding disabled:

```bash
colima stop
colima start --port-forwarder none --save-config
```

Start the local demo stack:

```bash
pnpm demo:local
```

The command generates ignored selected env files for web, enrollment, and gate; starts Supabase without Studio; starts Edge Functions; binds the constrained Supabase proxy to `LAN_IP:54331`; and starts the web app on port `3000`. It never prints credentials.

For tunnel mode:

```bash
cp .env.tunnel.example .env.tunnel.local
pnpm demo:tunnel
```

See [Dual-mode network runbook](./docs/NETWORK_MODES.md) for zrok reserved names, physical-device checks, EAS profiles, Metro restart rules, and recovery.

## Running the apps

Organizer dashboard:

```bash
pnpm --dir apps/web dev
```

Public ticket application:

```bash
pnpm --dir apps/tickets dev
```

Enrollment app:

```bash
pnpm --dir apps/enrollment start
```

Gate app:

```bash
pnpm --dir apps/gate start
```

Useful mobile commands:

```bash
pnpm --dir apps/enrollment ios
pnpm --dir apps/gate ios
```

In local physical-device mode the web dashboard runs at `http://LAN_IP:3000`; loopback is intentionally rejected from selected mobile configuration.

## Verification commands

From the repository root:

```bash
pnpm run db:verify
pnpm verify:network-config
pnpm verify:local-network
pnpm verify:tunnel-network
pnpm verify:phase2
pnpm verify:phase3
pnpm --filter @face-pass/shared test
pnpm --filter @face-pass/enrollment typecheck
pnpm --filter @face-pass/enrollment test:flow
pnpm --filter @face-pass/gate typecheck
pnpm --filter @face-pass/gate test:offline
pnpm --filter @face-pass/gate test:provisioning
```

To run the end-to-end Edge Function integration script, build the shared package first and keep the local Supabase stack running:

```bash
pnpm --filter @face-pass/shared build
node scripts/test-edge-functions.ts
```

## Key documents

- [Operations manual](./docs/EPQ_OPERATIONS_MANUAL.md)
- [Dual-mode network runbook](./docs/NETWORK_MODES.md)
- [Phase 2 roles, tickets, and gate sync](./docs/PHASE_2_ROLES_TICKETS_AND_GATE_SYNC.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Threat model](./docs/THREAT_MODEL.md)
- [Privacy by design](./docs/PRIVACY_BY_DESIGN.md)
- [Assumptions](./docs/ASSUMPTIONS.md)
- [Evaluation plan](./docs/EVALUATION_PLAN.md)

## Notes

- The workspace package name is `face-pass`, but the product branding across the apps is `Focaccia`.
- `apps/*` and `packages/*` are the only directories included in the pnpm workspace.
- The top-level `Auth-Card`, `Dashboard`, and `Landing Page` folders are separate prototypes and are not required to boot the main system.

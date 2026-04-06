# Focaccia

Focaccia is a privacy-preserving event access prototype built around a simple claim: biometric entry does not need a central face database.

The repository implements a three-part system:

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

Create the local env files:

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/enrollment/.env.example apps/enrollment/.env.local
cp supabase/functions/.env.example supabase/functions/.env.local
```

Create `apps/gate/.env.local` manually with the same keys used by the enrollment app:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Start Supabase from the repo root:

```bash
pnpm run db:start
```

Then start the Edge Functions server in a separate terminal:

```bash
pnpm run db:functions:serve
```

This extra step matters in this repo. The local workflow assumes an explicit `supabase functions serve --no-verify-jwt` process because the default local Supabase runtime can remain stopped.

Read the local Supabase values:

```bash
supabase status -o env
```

Copy the local `ANON_KEY` into:

- `apps/web/.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `apps/enrollment/.env.local` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `apps/gate/.env.local` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The default local URL is `http://127.0.0.1:54321` unless your environment differs.

## Running the apps

Organizer dashboard:

```bash
pnpm --dir apps/web dev
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

The web dashboard runs at [http://localhost:3000](http://localhost:3000).

## Verification commands

From the repository root:

```bash
pnpm run db:verify
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
- [Architecture](./docs/ARCHITECTURE.md)
- [Threat model](./docs/THREAT_MODEL.md)
- [Privacy by design](./docs/PRIVACY_BY_DESIGN.md)
- [Assumptions](./docs/ASSUMPTIONS.md)
- [Evaluation plan](./docs/EVALUATION_PLAN.md)

## Notes

- The workspace package name is `face-pass`, but the product branding across the apps is `Focaccia`.
- `apps/*` and `packages/*` are the only directories included in the pnpm workspace.
- The top-level `Auth-Card`, `Dashboard`, and `Landing Page` folders are separate prototypes and are not required to boot the main system.

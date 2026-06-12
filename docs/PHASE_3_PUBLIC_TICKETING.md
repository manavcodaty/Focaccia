# Phase 3 Public Ticketing

## Surface

`apps/tickets` is a separate Next.js 16 workspace application. Local mode binds to `0.0.0.0:3001`; tunnel mode uses the configured HTTPS ticket origin. It reads only `NEXT_PUBLIC_*` network values validated by `@face-pass/shared` and never receives service-role credentials, organizer allowlists, claim-code peppers, or gate secrets.

The attendee flow is:

1. browse only listed, future events;
2. inspect organizer, time, location, capacity, ticket types, GBP prices, and privacy details;
3. create or sign into a Supabase email/password account;
4. confirm the server-owned attendee profile name and auth email;
5. claim one free ticket with a persisted UUID v4 idempotency key;
6. recover the ticket and full claim code from My tickets on another signed-in device;
7. cancel only a claimed or enrolled ticket;
8. continue to the separate iOS enrollment app.

Paid ticket types remain visible but disabled. Capacity races refresh the event and explain that no place was reserved. Checked-in, cancelled, and revoked states are terminal in the public application.

## Commands

```bash
pnpm demo:local
pnpm demo:tunnel
pnpm verify:local-network
pnpm verify:tunnel-network
pnpm verify:phase3
```

Changing mode or any selected public URL requires restarting the Next.js development process. Expo apps additionally require a Metro restart and may require a native rebuild as documented in `docs/NETWORK_MODES.md`.

## Deployment

For tunnel demonstrations, deploy `apps/tickets` as its own Vercel project with root directory `apps/tickets`. Set the selected tunnel-mode `NEXT_PUBLIC_FOCACCIA_*` values and the Supabase anon key in that project. The Supabase URL must be HTTPS and must return raw Auth and Edge Function responses without a zrok interstitial.

## Verification Boundary

Automated verification covers configuration selection, public event mapping, idempotency behavior, ticket state copy, type checking, production build, and browser workflows. A physical-phone local checkout requires the phone to be online on the same LAN. Tunnel checkout requires configured zrok and Vercel deployments; neither condition is inferred from a simulator or local browser result.

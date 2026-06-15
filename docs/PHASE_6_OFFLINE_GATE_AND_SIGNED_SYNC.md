# Phase 6: Offline Gate And Signed Synchronization

## Implemented Contract

- Provisioning creates independent X25519 template-decryption and Ed25519 synchronization keypairs. Both private keys use iOS SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; only public keys reach Supabase.
- A successful offline decision commits the used-pass marker, ACCEPT log, and signed queue item in one exclusive SQLite transaction before the UI reports acceptance.
- Queue rows contain only `event_id`, `pass_id`, `decision`, original `gate_timestamp`, nonce, idempotency key, signature, retry metadata, and safe status/error fields. They contain no token, template, embedding, biometric, auth credential, or private key.
- `record-gate-checkin` verifies the canonical Ed25519 signature and resolves the ticket server-side. Exact duplicate receipt is success. Nonce reuse, tampering, wrong event/key, stale timestamps, revoked passes, and invalid ticket state are rejected.
- `get-gate-revocations` is authenticated by the same gate sync key and returns a full versioned snapshot, server time, and key version without requiring organizer authentication.
- Pending check-ins survive restart. Retry delays are 5 seconds, 15 seconds, 1 minute, 5 minutes, then 15 minutes capped, with bounded jitter. Work pauses in the background and resumes on foreground, network restoration, manual retry, and the active 60-second timer.
- Check-in sync failure never reverses an offline ACCEPT.

## Door-Opening Workflow

1. Provision the prepared gate device and complete the first signed revocation refresh.
2. In Gate Settings, press **Refresh revocation cache** shortly before doors open.
3. Confirm **Door-opening status: Ready** and a cache age no greater than five minutes.
4. Confirm pending and blocked check-in counts are zero, or use **Retry check-in synchronization** while online.
5. The gate can then be disconnected and continue verifying passes offline.

Cache states are `fresh` through five minutes, `stale` after five minutes, and `critical` after thirty minutes or when no snapshot exists. A first snapshot is mandatory before scanning. Later stale or critical status warns but does not disable an already prepared offline gate.

New cancellations or revocations made remotely cannot affect a disconnected gate. They become effective on that gate only after a later successful refresh.

## Verification

```bash
pnpm db:reset
pnpm verify:phase2
pnpm --dir apps/gate test:coverage
pnpm --dir apps/gate typecheck
pnpm --dir apps/gate test:offline
pnpm --dir apps/gate test:provisioning
pnpm --dir apps/gate export:ios
```

`pnpm verify:phase6` runs the same Phase 6 software verification sequence. A clean reset needs the documented temporary loopback-only PostgreSQL SSH forward when Colima automatic forwarding is disabled. PostgreSQL and Studio must never be exposed on the LAN.

Physical-device local and tunnel acceptance still require the corresponding prepared iPhone and configured remote tunnel. Do not replace either check with simulator or mocked evidence.

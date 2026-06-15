# EPQ Operations Manual

## Operating Claims

- Local mode needs no tunnel.
- Physical devices use the Mac LAN IP.
- At-home setup needs the active zrok tunnel and host Mac.
- Gate decisions remain offline.
- Revocations made while the gate is disconnected apply after refresh.
- Audience-owned iPhone installation is conditional on verified Apple distribution.

## 1. Preflight

Required on the host Mac:

- Node.js 24+, pnpm 10.33.0
- Docker/Colima and Supabase CLI
- Xcode and prepared iOS development builds
- same Wi-Fi as classroom devices for local mode
- no VPN/Private Relay route that prevents LAN access

Install once:

```bash
pnpm install
```

For the recommended Colima topology:

```bash
colima stop
colima start --port-forwarder none --save-config
```

## 2. Local Classroom Startup

1. Copy and edit local configuration:

```bash
cp .env.local.example .env.local
```

2. Put the Mac's current private IPv4 in all local URLs. Do not use `localhost` or `127.0.0.1` on a physical device.

3. Stop every zrok process. Local verification intentionally fails if one is running.

4. Start the stack:

```bash
pnpm demo:local
```

Expected services:

```text
http://LAN_IP:3000   organizer dashboard
http://LAN_IP:3001   public ticket app
http://LAN_IP:54331  constrained Supabase/Auth/Functions proxy
```

5. Verify configuration and services:

```bash
pnpm demo:status
pnpm verify:network-config
pnpm verify:local-network
```

The local verifier must report Auth health, allowed CORS, rejected attacker origin, both web apps, and non-exposure of PostgreSQL/Studio.

6. Start local mobile Metro servers as needed:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=LAN_IP pnpm --dir apps/enrollment exec expo start --dev-client --host lan --clear
REACT_NATIVE_PACKAGER_HOSTNAME=LAN_IP pnpm --dir apps/gate exec expo start --dev-client --host lan --clear
```

Use different Metro ports if both run simultaneously. Grant iOS Local Network and Camera permissions.

## 3. Tunnel / At-Home Startup

The host Mac must remain powered and online because Supabase stays on it.

1. Install/enable zrok v2 and reserve three stable public names.
2. Copy `.env.tunnel.example` to `.env.tunnel.local` and set exact HTTPS origins/name selections.
3. Start and verify:

```bash
pnpm demo:tunnel
pnpm verify:tunnel-network
```

The verifier must reach Auth, Edge Functions, organizer web, and tickets without an interstitial.

### Vercel Ticket Deployment

`apps/tickets` may be deployed separately to Vercel. Set its selected tunnel `NEXT_PUBLIC_*` variables, set `FOCACCIA_TUNNEL_TICKETS_URL` to the deployment origin, restart the demo so Auth/CORS use that exact origin, and rerun tunnel verification.

Current checkout status: zrok, Vercel, and tunnel env are not configured, so do not claim a live remote deployment.

## 4. Organizer Workflow

### Sign In And Role Check

1. Open `http://LAN_IP:3000/login` or the selected tunnel organizer URL.
2. Sign in with an email present in `FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST`.
3. `apps/web/app/(secure)/layout.tsx` invokes `ensure-organizer`; non-allowlisted users are denied.

### Create And List Event

1. Dashboard -> **Create event** -> `/events/new`.
2. Enter name, description, location, start/end, global capacity, and listed state.
3. Keep General Admission or add ticket types. Price is in GBP; prices above zero display a warning and cannot be checked out.
4. Submit. `create-event` performs the event/default-ticket transaction.
5. Confirm the event appears on `apps/tickets` only when listed.

### Provision Gate

1. Event workspace -> **Gate provisioning**.
2. On the prepared gate app, choose **Provision gate** and sign in as the owning organizer.
3. Select/enter the event and device name.
4. The gate generates X25519 encryption and Ed25519 sync keypairs. Only public keys are sent to `provision-gate`.
5. Confirm the dashboard shows **Provisioned**.

## 5. Attendee Ticket Workflow

1. Open `http://LAN_IP:3001` or the selected HTTPS ticket URL.
2. Open a listed event and review organizer, time, location, description, active types, GBP price, remaining capacity, privacy notice, and sold-out state.
3. Create an attendee account or sign in. Email confirmation is disabled in this controlled deployment.
4. Confirm trusted full name/email and a real `GBP 0` total.
5. Submit checkout once. The app supplies a UUID-v4 idempotency key and disables repeat submission.
6. `claim-free-ticket` creates the ticket transactionally or returns the existing idempotent/duplicate result.
7. Capture evidence from Confirmation and My tickets: claim code, status, and enrollment next step.

Paid types are visible but unavailable. A capacity race may return sold out; it must never oversell.

## 6. Enrollment Workflow

Prepared-device fallback is guaranteed; audience-owned installation is not.

1. Open the enrollment development build.
2. Sign in with the same attendee account.
3. **My tickets** lists account-owned tickets using a `FlatList`.
4. Select a claimed ticket, or enter its claim code. The backend still verifies account ownership.
5. Review remaining generation allowance.
6. Read and accept consent.
7. Capture locally. Temporary image/crop files are deleted after inference; no image/embedding/template is uploaded.
8. `get-enrollment-bundle` returns ticket-bound event/gate data.
9. `issue-pass` validates ownership/event/generation/idempotency, revokes an old pass during regeneration, and returns the signed token.
10. The pass is stored account-scoped in SecureStore and displayed as a QR.

If an organizer reset occurs, refresh My tickets. The old local pass is removed and the ticket returns to `claimed` with generation 0.

### Shared Prepared Enrollment Device

Use **Switch** and choose the clear-local-data option. It deletes only the current attendee's local passes/pending issuance before local sign-out. Then sign in as the next attendee.

## 7. Gate Door-Opening Workflow

### Mandatory Refresh

1. Connect the gate to the selected local/tunnel service.
2. Open gate Settings/status.
3. Run revocation refresh successfully.
4. Confirm cache age. Fresh is <=5 minutes; stale is >5 and <=30; critical is >30 or never refreshed.
5. The scanner refuses to open if no successful refresh exists.

### Offline Verification

1. Disable Wi-Fi/mobile networking after refresh.
2. Open scanner and scan the attendee QR.
3. Complete active liveness.
4. Observe `ACCEPT` or a plain-English rejection reason.
5. Scan the same pass again and capture replay rejection.

The decision uses only provisioned keys, cached revocations, local liveness/matching, and SQLite replay state. Network failure cannot change the result.

### Optical Fallback

If QR scanning fails, use the gate's typed/paste token fallback. This is the same signed pass token and runs the same offline verification. It is not a bypass and is not a manual server log-upload path.

## 8. Synchronization And Dashboard Evidence

1. After an offline acceptance, verify the gate shows a pending queue count.
2. Restore LAN/tunnel connectivity.
3. The gate automatically flushes due signed items and refreshes revocations. Manual **Retry** may unblock operator-reviewable failures.
4. Duplicate server receipt is treated as success.
5. The event dashboard refreshes from `gate_checkins`/activity Realtime changes and a five-second polling fallback.
6. Confirm checked-in totals and ticket status update without uploading a file.

The queue preserves the original gate time and survives restart.

## 9. Revocation And Reset

- **Cancel**: attendee can cancel only a claimed/enrolled ticket. An enrolled pass is revoked.
- **Revoke**: organizer can revoke an owned event ticket in claimed/enrolled state. An enrolled pass is revoked.
- **Reset**: organizer resets an enrolled ticket; old pass is revoked, ticket becomes claimed, generation becomes zero.
- **Regenerate**: attendee issues a replacement while under the three-generation cap; old pass is revoked first.

If the gate is disconnected, these changes do not affect its current cache. Reconnect and refresh before expecting enforcement.

## 10. CSV Evidence

### Organizer CSV

Event workspace -> export tickets. The audited `export-organizer-tickets` function returns:

```text
Attendee name, Attendee email, Ticket type, Status,
Generation, Checked in at, Ticket ID
```

It excludes biometrics, claim/pass tokens, credentials, and private keys.

### Gate CSV

Gate -> Export. The local CSV contains non-biometric decision outcome, reason, timings, pass references, and Hamming distance for evaluation. Treat pass references and attendee CSV data as restricted EPQ evidence.

## 11. Recovery

- Wrong IP: update `.env.local`, restart demo and Metro with `--clear`.
- Local Network denied: enable it in iOS Settings, then relaunch.
- Developer profile blocked: trust the Apple Development profile in device Settings; this is a physical owner action.
- Auth failure: verify selected Supabase URL and account; never bypass Auth.
- Edge Function unavailable: verify `demo:status`, then restart `demo:*`.
- Tunnel outage: restore host Mac/zrok shares, or switch explicitly to local mode with all tunnels stopped.
- Stale gate cache: reconnect and refresh; do not claim the remote revocation already applies.
- Blocked queue item: inspect the non-sensitive error, correct configuration/key state, and use Retry.
- Lost/corrupt gate device: use the prepared fallback gate, reprovision, refresh revocations, and do not reuse deleted replay evidence as if continuous.

## 12. Distribution Status

TestFlight is **not configured**. EAS is not logged in and no App Store Connect/TestFlight artifact is verified. Prepared development devices are the operational fallback. Audience-owned iPhone support may be stated only after Apple distribution is verified.

## 13. Shutdown

Stop demo and Metro processes with `Ctrl+C`. Supabase containers may remain for a faster restart. Do not clear gate app data until replay, queue, and CSV evidence has been exported.

# Dual-Mode Network Runbook

Focaccia supports exactly `FOCACCIA_NETWORK_MODE=local|tunnel`. The mode is explicit; clients never infer a mode from an available URL and never fall back to another origin.

## Root Variables

Local root configuration:

```text
FOCACCIA_NETWORK_MODE=local
FOCACCIA_LOCAL_HOST=LAN_IP
FOCACCIA_LOCAL_SUPABASE_URL=http://LAN_IP:54331
FOCACCIA_LOCAL_WEB_URL=http://LAN_IP:3000
FOCACCIA_LOCAL_TICKETS_URL=http://LAN_IP:3001
FOCACCIA_DOCKER_HOST=ssh://colima
FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST=<comma-separated exact emails>
FOCACCIA_CLAIM_CODE_PEPPER=<base64url 32-byte secret>
```

Tunnel root configuration:

```text
FOCACCIA_NETWORK_MODE=tunnel
FOCACCIA_TUNNEL_SUPABASE_URL=https://<api>.share.zrok.io
FOCACCIA_TUNNEL_WEB_URL=https://<web>.share.zrok.io
FOCACCIA_TUNNEL_TICKETS_URL=https://<tickets>.share.zrok.io
FOCACCIA_ZROK_SUPABASE_NAME_SELECTION=public:<api-name>
FOCACCIA_ZROK_WEB_NAME_SELECTION=public:<web-name>
FOCACCIA_ZROK_TICKETS_NAME_SELECTION=public:<tickets-name>
FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST=<comma-separated exact emails>
FOCACCIA_CLAIM_CODE_PEPPER=<base64url 32-byte secret>
```

The launcher writes ignored selected values for each runtime:

- browser: `NEXT_PUBLIC_FOCACCIA_NETWORK_MODE`, `NEXT_PUBLIC_FOCACCIA_LOCAL_HOST`, `NEXT_PUBLIC_FOCACCIA_SUPABASE_URL`, `NEXT_PUBLIC_FOCACCIA_WEB_URL`, `NEXT_PUBLIC_FOCACCIA_TICKETS_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Expo: `EXPO_PUBLIC_FOCACCIA_NETWORK_MODE`, `EXPO_PUBLIC_FOCACCIA_LOCAL_HOST`, `EXPO_PUBLIC_FOCACCIA_SUPABASE_URL`, `EXPO_PUBLIC_FOCACCIA_WEB_URL`, `EXPO_PUBLIC_FOCACCIA_TICKETS_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Edge Functions: selected root values plus server-only service-role, wrapping-key, allowlist, and claim-code-pepper values

Only the selected URLs and Supabase anon key enter public bundles. Never place service-role keys, database credentials, organizer allowlists, signing secrets, tunnel credentials, claim-code peppers, or gate private keys in public variables.

## Local Mode

Local mode needs no tunnel. `pnpm demo:local` fails if a zrok process is running.

```text
phone/browser/enrollment/gate
  -> http://LAN_IP:3000   organizer dashboard
  -> http://LAN_IP:3001   public tickets
  -> http://LAN_IP:54331  constrained Supabase proxy
proxy
  -> http://127.0.0.1:54321 host-only Supabase API
```

Physical devices use the Mac LAN IP. Loopback is valid only for host-internal upstreams and is rejected as a selected physical-device URL.

The proxy permits `/auth/v1`, `/rest/v1`, `/functions/v1`, `/realtime/v1`, and `/storage/v1`, supports Realtime WebSockets, applies a 10 MiB request limit, reflects only exact browser origins, and accepts native requests with no `Origin`. It cannot forward to arbitrary destinations.

Recommended macOS topology:

```bash
colima stop
colima start --port-forwarder none --save-config
cp .env.local.example .env.local
pnpm demo:local
pnpm verify:local-network
```

The launcher creates loopback-only SSH forwards for Supabase API/database access. It checks that PostgreSQL `54322` and Studio `54323` are not reachable at `LAN_IP`. Studio, Logflare, and Vector are not started by the demo.

Physical acceptance requires the Mac and phone on the same Wi-Fi, all tunnels stopped, VPN/Private Relay behavior accounted for, and the local-network permission granted to each iOS app. A second device can first open `http://LAN_IP:54331/auth/v1/health`.

## Tunnel Mode

At-home setup needs both the active zrok tunnel and the host Mac. Supabase remains local to the Mac; zrok exposes only HTTPS fronts for the constrained proxy and web apps.

```bash
cp .env.tunnel.example .env.tunnel.local
zrok2 enable
pnpm demo:tunnel
pnpm verify:tunnel-network
```

`demo:tunnel` starts three reserved public shares:

- selected Supabase HTTPS URL -> `http://127.0.0.1:54331`
- selected organizer HTTPS URL -> `http://127.0.0.1:3000`
- selected tickets HTTPS URL -> `http://127.0.0.1:3001`

The zrok account/name selections must be verified and stable. The verifier rejects non-HTTPS URLs and any response containing a zrok interstitial.

### Vercel

The ticket application may be deployed separately to Vercel instead of using the ticket zrok share. Configure the Vercel project with the selected tunnel-mode `NEXT_PUBLIC_*` variables and point `FOCACCIA_TUNNEL_TICKETS_URL` at that exact deployment origin. Supabase Auth and CORS must then be regenerated with the same origin.

Current status on this workstation: the Vercel CLI/project link, `zrok2`, and `.env.tunnel.local` are absent. Tunnel and Vercel operation are implemented but not currently configured or pass-verified.

## Auth Redirects And CORS

`demo:*` generates `.focaccia/runtime/supabase/config.toml` for the selected mode:

- Auth `site_url` is the exact selected ticket-app origin.
- `additional_redirect_urls` contains the exact organizer and ticket origins.
- email/password signup is enabled; email confirmation is disabled for the controlled EPQ deployment.
- Edge Function browser CORS accepts only the exact selected organizer and ticket origins.
- native app requests may omit `Origin`; wildcard browser CORS is not emitted.

Changing an origin requires restarting the demo so the generated Auth/CORS configuration changes with it.

## EAS And iOS Networking

Both mobile apps define:

- `development-local`
- `development-tunnel`
- `preview-local`
- `preview-tunnel`
- `production-tunnel`

Local profiles select `local`; tunnel profiles select `tunnel`. EAS environment configuration must provide the remaining selected `EXPO_PUBLIC_*` URLs and anon key.

The iOS apps use a narrow ATS exception that permits local networking without globally allowing arbitrary insecure HTTP. Both include `NSLocalNetworkUsageDescription`. Tunnel configuration still requires HTTPS.

Mode or `EXPO_PUBLIC_*` changes require a Metro restart with `--clear`; native configuration changes require a rebuild.

## Status And Health Commands

```bash
pnpm demo:local
pnpm demo:tunnel
pnpm demo:status
pnpm verify:network-config
pnpm verify:local-network
pnpm verify:tunnel-network
```

Verification covers selected mode/host/URLs, TCP reachability, Auth health, Edge Function CORS, unauthorized-origin rejection, organizer web, ticket health, hidden database/Studio ports, and zrok interstitial detection without printing credentials.

## Recovery

- Wrong mode or mixed origins: fix the selected root env; there is no automatic fallback.
- Mac IP changed: update every local URL, stop the demo and Metro, restart the demo, restart Metro with `--clear`, and rebuild only if native configuration changed.
- Port conflict: stop the conflicting process; do not weaken the proxy or expose PostgreSQL/Studio.
- Tunnel failure: keep the host Mac running, restore all three shares or the Vercel ticket deployment, then rerun `verify:tunnel-network`.
- Local fallback: stop every zrok process, select local env, and run `demo:local`; local mode is independent of Vercel and zrok.
- Gate outage: entry decisions still work offline from provisioned keys and cached revocations. Check-ins remain queued until connectivity returns.

# Dual-Mode Network Runbook

Phase 1 supports exactly two explicit modes. No client infers, rewrites, or falls back to another host.

## Commands

```bash
pnpm demo:local
pnpm demo:tunnel
pnpm demo:status
pnpm verify:network-config
pnpm verify:local-network
pnpm verify:tunnel-network
```

`demo:*` builds the shared package, generates `.focaccia/runtime`, writes ignored selected public env files, starts Supabase without Studio, starts Edge Functions, starts the constrained proxy, and starts the organizer web app. `apps/tickets` is checked only when that later-phase app exists.

## Local Mode

Copy `.env.local.example` to `.env.local` and replace the example address with the Mac's stable private IPv4. The selected Supabase URL should use proxy port `54331`.

```text
physical device -> http://LAN_IP:3000  organizer web
physical device -> http://LAN_IP:54331 constrained Supabase proxy
proxy           -> http://127.0.0.1:54321 Supabase API
```

The proxy permits only `/auth/v1`, `/rest/v1`, `/functions/v1`, `/realtime/v1`, and `/storage/v1`. It rejects unknown browser origins, strips upstream wildcard CORS headers, limits requests to 10 MiB, supports Realtime WebSocket upgrades, and cannot forward arbitrary destinations.

On macOS, use Colima with automatic port forwarding disabled and Docker over SSH:

```bash
colima stop
colima start --port-forwarder none --save-config
```

Set `FOCACCIA_DOCKER_HOST=ssh://colima`. The demo launcher creates one managed SSH forward at `127.0.0.1:54321`. PostgreSQL `54322`, Studio `54323`, and Mailpit `54324` must have no host listener. Docker Desktop's default all-interface published ports fail this requirement.

For a database reset, create a temporary loopback-only `54322` SSH forward, run the reset, and close the forward immediately. Never bind it to the LAN address.

Physical-device acceptance requires the phone and Mac on the same Wi-Fi, every zrok process stopped, and Private Relay/VPN behavior accounted for. From the second device, open `http://LAN_IP:54331/auth/v1/health`, then exercise organizer Auth, an Edge Function, enrollment, and gate provisioning. `pnpm verify:local-network` independently verifies the host-side contract.

## Tunnel Mode

Copy `.env.tunnel.example` to `.env.tunnel.local`. Every selected URL must be HTTPS and externally routable. Install and enable zrok v2, then configure reserved `public:<name>` selections matching the selected `*.share.zrok.io` URLs.

`demo:tunnel` shares only the constrained Supabase proxy and web app. It never shares PostgreSQL or Studio. `verify:tunnel-network` checks HTTPS, Auth, Edge Functions, exact CORS, web reachability, and rejects a raw response containing a zrok interstitial.

## Public And Server Values

Browser and Expo bundles receive only selected `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` network values plus the Supabase anon key. Service-role keys and the wrapping key exist only in `.focaccia/runtime/functions.env` with mode `0600`; diagnostics never print them.

Supabase Auth is generated per mode. Site URL is the selected tickets origin and redirect allowlisting contains only the exact selected web and tickets origins. Edge Functions derive the same exact browser-origin set from typed server configuration.

### Direct environment reads

- `apps/web/lib/env.ts`, `apps/enrollment/src/lib/env.ts`, and `apps/gate/src/lib/env.ts` are the only client adapters. They read the selected mode, local host, three selected URLs, and anon key, then pass them to the shared parser. They never read server secrets.
- `scripts/lib/network-environment.mjs` is the root CLI adapter. `demo.mjs` additionally reads `PATH`; `demo-status.mjs` accepts `FOCACCIA_NETWORK_MODE` only to select the env file.
- `scripts/lan-supabase-proxy.mjs` reads only its bind host, bind port, and exact browser-origin allowlist from launcher-provided values.
- `supabase/functions/_shared/network-runtime.ts` and `env.ts` are the only Edge adapters. They parse the selected network contract and server-only secrets; individual functions do not read `Deno.env`.

### Intentional loopback endpoints

- `127.0.0.1:54321` is the host-only Supabase API upstream, reached through the managed Colima SSH forward.
- `127.0.0.1:54331`, `:3000`, and `:3001` are zrok share targets in tunnel mode only.
- Generated Supabase function configuration uses `127.0.0.1:54321` for server-to-server calls inside the local runtime.
- Static `supabase/config.toml` loopback values are source defaults only. `demo:*` generates the selected Auth site and redirect origins before startup.
- Loopback values in tests are fixtures used to prove rejection or no-rewrite behavior; physical-device local configuration rejects them.

## EAS And iOS

Both mobile apps define:

- `development-local`
- `development-tunnel`
- `preview-local`
- `preview-tunnel`
- `production-tunnel`

Local profiles set mode `local`; tunnel profiles set mode `tunnel`. EAS environment values must supply the remaining selected public URLs and anon key. iOS keeps global ATS disabled, permits local networking, and includes a purpose-specific local-network usage description.

Changing mode or any `EXPO_PUBLIC_*` value requires stopping Metro and restarting with `--clear`. Changes to `app.json`, `Info.plist`, ATS, entitlements, or native dependencies require a new dev-client/EAS build. A Metro restart alone cannot apply native configuration.

TestFlight status: **not configured**. Neither app contains committed EAS project linkage or verified Apple signing/App Store Connect credentials, so TestFlight cannot be claimed as available in Phase 1.

## Recovery

- Invalid or mixed URLs: fix the selected root env; the validator intentionally provides no fallback.
- Stale Supabase containers: `demo:*` backs up and restarts an unhealthy generated runtime.
- Port `54331` unavailable: stop the conflicting process; do not change the allowlisted proxy to a forward proxy.
- Mode switch: stop the demo, stop both Metro servers, change the selected env, restart the demo, restart Metro with `--clear`, and rebuild native clients when native configuration changed.
- Tunnel failure: local mode remains independent and must be tested with all tunnel processes stopped.

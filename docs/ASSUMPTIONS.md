# Assumptions

## Layer 1 Scope

- This repository now contains the Layer 1 infrastructure skeleton only.
- Application workspaces are initialized as monorepo packages, but application code is intentionally deferred to later layers.
- The original locked stack constraints from `TRUTH_BASE.md` have been intentionally overridden to adopt Node 24 and the latest stable package releases across the monorepo.
- This override increases the risk of breaking changes, peer dependency drift, and Expo/iOS native build instability compared with the original pinned stack.
- The current Expo 55 dependency tree installs successfully on Node 24, but one transitive Expo package still declares a TypeScript 5 peer while the workspace is intentionally pinned to TypeScript 6.0.2 as part of the latest-stable override.
- Layer 5 keeps the mobile workspaces on Expo 55 instead of downgrading the enrollment app to Expo SDK 54. The user request referenced SDK 54, but the repository had already been moved to a monorepo-wide Expo 55 stack, and splitting one app onto a different Expo native baseline would create a higher-risk mismatch in React Native, config plugin, and dev-build behavior.
- For `cancelableTemplateV1`, the unspecified `uint16(i)` and `uint16(j)` encodings are treated as big-endian, `BLAKE2b(...)` is taken as a 64-byte digest, and `first_bit(h)` is interpreted as the most significant bit of the first digest byte.
- Supabase local development on this machine exposes `pgsodium` but not the `vault` extension, and Edge Functions cannot mint new per-event environment secrets at runtime. For Layer 3, `SK_SIGN_EVENT` and the optional `K_CODE_EVENT` are therefore stored via a secure KV pattern: each secret is encrypted in the Edge Function with a project-level 32-byte wrapping key from `supabase/functions/.env.local`, then persisted as ciphertext in a service-role-only `public.edge_event_secrets` table that has no grants for `anon` or `authenticated`.
- Local verification on this machine still needs two Supabase steps: `supabase start` for the core stack and a separate `supabase functions serve --no-verify-jwt` process for Edge Functions. The current CLI starts the rest of the stack successfully, but `supabase status` continues to report `supabase_edge_runtime_*` as stopped, and local JWT verification at the gateway rejects requests before they reach the handlers. The repository therefore prepares `supabase/functions/.env` from `supabase/functions/.env.local` before both commands so the explicit function server can load the Face Pass secrets consistently.
- The Gate App provisioning QR payload format was not fixed in the truth base. For Layer 4, the dashboard encodes canonical JSON containing only public event metadata: `v`, `kind`, `event_id`, `name`, `starts_at`, `ends_at`, `pk_sign_event`, `event_salt`, optional `pk_gate_event`, and `issued_at`.
- The enrollment app bundles `facenet_512.tflite` from `shubham0204/OnDevice-Face-Recognition-Android` under Apache 2.0 as the on-device embedding model. The app assumes a `160x160x3` float32 input normalized to `0..1` and a `512`-float output embedding.
- Expo + VisionCamera currently expose still photo capture through temporary file URIs. The enrollment pipeline therefore deletes both the captured photo file and the aligned face crop immediately after reading them into memory for TFLite inference, but the capture step is still transiently file-backed at the native API boundary.
- Layer 6 reuses the exact same `apps/enrollment/assets/models/facenet_512.tflite` asset inside the gate app so enrollment and verification derive templates from an identical FaceNet model. The gate liveness flow follows the same privacy rule as enrollment: the captured still photo and the aligned crop are deleted immediately after inference, even though the native camera bridge is still transiently file-backed.
- The truth base names a `gate-sync` Edge Function, but Layer 6 does not add a new backend function. Instead, the gate app performs pre-event revocation refresh by reading the `revocations` table directly through organizer-authenticated Supabase RLS, while the actual scan decision path remains fully offline and never depends on the network.

## Local Verification Environment

- The repository contract is now pinned to Node 24 and pnpm 10.33.0 in `package.json`.
- Verification in this layer still centers on the Supabase CLI and container runtime because the application workspaces remain package-level skeletons without runnable product code yet.
- The gate app's headless offline verifier uses Node 24's experimental `node:sqlite` API to exercise the same local SQLite schema and cryptographic flow in CI-style verification without requiring an iOS simulator or a physical camera feed.

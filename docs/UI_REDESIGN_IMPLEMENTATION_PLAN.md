# Focaccia Four-App Presentation Rebuild Plan

Date: 2026-07-13

This plan governs a presentation-layer rebuild of `apps/tickets`, `apps/web`, `apps/enrollment`, and `apps/gate`. Existing routes, auth, APIs, validation, storage, cryptography, lifecycle, offline decisions, provisioning, idempotency, and security boundaries remain authoritative. The visual implementation may be replaced; functional wiring is migrated rather than reinvented.

## 1. Repository findings

- The four apps are independent clients over shared Supabase and `packages/shared` contracts.
- Tickets and Organizer use Next.js 16, React 19, Tailwind CSS 4. Organizer already has a local shadcn/Radix system; Tickets uses a custom raw-control system.
- Enrollment and Gate use Expo 55 / React Native 0.83 with shared-per-app theme and primitive layers, camera work, SecureStore, and platform-specific flows.
- The current branch starts clean. Baseline: Organizer build passes; Tickets tests/typecheck pass and its bare build reaches compile/typecheck but prerender rejects a missing required `FOCACCIA_NETWORK_MODE`; Enrollment and Gate typecheck and coverage pass.
- The existing UI already contains useful behavior and some accessibility protections, but styling is split between old “Steep” tokens, duplicate web primitives, over-rounded components, card-heavy layouts, a fabricated Tickets hero claim code, and inaccurate Organizer public privacy copy.
- `docs/PRD.md` is referenced by the brief but does not exist. `README.md`, `TRUTH_BASE`, `UI_UX_SPEC`, `ARCHITECTURE`, `PRIVACY_BY_DESIGN`, `THREAT_MODEL`, `ASSUMPTIONS`, `EVALUATION_PLAN`, the prior UI prompt, and Phase 7 evidence supply the verified product contract.
- Graphify’s configured `graphify-out/graph.json` is absent, so scoped source inspection replaces graph queries. A post-change update will be attempted and reported honestly.

## 2. Complete route and screen inventory

### Tickets

- `/`: public listed-event catalogue, loading/error/empty states.
- `/events/[eventId]`: event details, ticket-type choice, auth/profile prerequisites, idempotent free claim, capacity/paid errors.
- `/login`, `/signup`: attendee email/password auth with safe return destination.
- `/profile`: required attendee profile completion.
- `/confirmation/[ticketId]`: real claim confirmation and enrollment hand-off.
- `/tickets`: authenticated ticket library.
- `/tickets/[ticketId]`: current owned-ticket lookup, status, claim code, cancellation.
- `/privacy`: accurate data, processing, retention, and offline-revocation disclosure.
- Global `error` and `not-found`: recoverable route failures.

### Organizer web

- `/`: accurate public product overview and organizer entry.
- `/login`: allowlisted organizer email/password entry and network-aware feedback.
- Secure shell: auth and organizer-profile guard, navigation, identity, sign-out.
- `/dashboard`: event readiness, lifecycle, counts, listing state, search/filter, create action.
- `/events/new`: event creation transaction and default ticket explanation.
- `/events/[eventId]`: event operations, tickets, types, activity, sync/revocation context, export, reset/revoke.
- `/events/[eventId]/edit`: event update with invariant-aware validation.
- `/events/[eventId]/provisioning`: gate setup QR and public provisioning values.
- `/events/[eventId]/revocations`: revocation record view.
- `/events/[eventId]/logs`: signed check-in/audit log view.

### Enrollment

- `index`: attendee auth/account entry and prepared-device cleanup path.
- `tickets`: owned-ticket wallet/list, refresh, claim-code recovery, sign-out.
- `ticket`: selected ticket state, local-pass reconciliation, enroll/regenerate/open-pass action.
- `consent`: explicit local face-processing consent.
- `capture`: camera permission, model readiness, quality guidance, local processing, issuance/retry.
- `pass`: event-scoped signed pass presentation and validity/generation context.
- `approved`: post-check-in state.
- `help`: privacy, recovery, terminal/reset, and offline limitation guidance.

### Gate

- `index`: provisioned event readiness, cache freshness, connectivity, sync queue, scanner entry.
- `provision`: QR/manual provisioning, validation, key storage, error/retry state.
- `scan`: camera permission, QR decoding, offline preflight, replay/revocation/signature checks.
- `fallback`: visible manual token fallback.
- `liveness`: local liveness/capture/match with safe cancellation and retry.
- `result`: accepted/rejected decision, reason, and repeated operator action.
- `settings`: event/device/cache/network/sync operational controls.
- `export`: non-biometric evaluation evidence export.

## 3. Current UX diagnosis

- Tickets hides its real catalogue beneath a large promotional hero and a fake claim code; the new first viewport must be real event content.
- Both web apps use excessive capsule controls and repeated card chrome. Shape and elevation need to express purpose.
- Tickets implements raw forms, buttons, feedback, and cancellation; standard interactions need shadcn/Radix semantics, including explicit cancellation confirmation.
- Organizer has duplicate landing/auth/UI component systems and both a custom shell and an unused sidebar system. Only one production primitive path should remain.
- Organizer event operations are feature-complete but visually dense; critical readiness and exceptions need to precede audit/technical detail.
- Mobile primitives are consistent but over-rounded, and the current surface hierarchy reads as a set of generic cards. Wallet and gate surfaces require distinct compositions.
- Technical identifiers/keys are too visually prominent in several places; retain them behind clear labels and progressive disclosure.
- Status language sometimes mirrors backend values. All equivalent states must use the shared vocabulary in `FOCACCIA_DESIGN_SYSTEM.md`.

## 4. Design goals by application

- **Tickets:** editorial but fast; show events immediately, deterministic artwork, clear price/time/place, one honest checkout action, reliable recovery.
- **Organizer:** exception-led operations; active/upcoming/readiness first, dense records without noise, explicit consequences for destructive changes.
- **Enrollment:** a calm wallet and guided local-enrollment flow; consent and capture copy must be precise, human, and event-scoped.
- **Gate:** high-pressure operator utility; large targets, visible offline/cache/sync state, unobstructed scanner, distant-readable decisions.

## 5. Shared design-system proposal

`docs/FOCACCIA_DESIGN_SYSTEM.md` defines warm civic utility tokens, typography, purpose-based radii, restrained elevation, status vocabulary, focus/motion, state compositions, responsive behavior, and platform conventions. Web apps share semantic CSS variables and shadcn/Radix behavior; mobile apps mirror semantic values through native theme objects while retaining platform-appropriate spacing and typography.

## 6. Exact component architecture

### Tickets

- `components/ui/*`: local shadcn/Radix controls, feedback, Field, AlertDialog, Skeleton, Empty, Badge, and menu primitives.
- `EventPoster`: deterministic, text-safe artwork derived from event ID/name without remote images.
- `EventCard`, event detail facts, ticket option control, status badge, and ticket record become product compositions over shared primitives.
- `SiteHeader` and mobile menu/sheet own responsive navigation and auth actions.
- Existing AuthProvider/API/idempotency/session helpers remain unchanged except UI-safe adapters if needed.

### Organizer

- Keep the existing `components/ui/*` shadcn/Radix layer and re-theme it through semantic CSS variables.
- Consolidate production shell around `layout/app-shell.tsx`; remove unused duplicate navigation code only after source/search/build parity.
- Add small product compositions for readiness, event identity, operational stats, and disclosure rows rather than broad generic cards.
- Preserve existing event forms, operations workspace, provisioning, logs, auth provider, data adapters, and mutations.

### Mobile

- Rebuild each app’s `theme.ts`, `ScreenShell`, `PrimaryButton`, `SectionCard`, `StatusBanner`, and brand/status row primitives.
- Add purpose-built wallet credential/readiness compositions only where existing routes cannot express the new hierarchy cleanly.
- Route files retain their current contexts, effects, controller functions, APIs, persistence, camera lifecycle, and navigation; JSX/style composition changes around them.

## 7. Exact file-change map

- Documentation: the four redesign documents under `docs/`.
- Tickets: `app/globals.css`, layout/error/not-found/privacy as needed; all production components; `components/ui/*`; `components.json`; package/lock only for preset-required existing-compatible dependencies; new presentation tests.
- Organizer: `app/globals.css`, public page/metadata, login/shell routes as needed; `components/layout/*`, `components/auth/*`, `components/dashboard/*`, and relevant `components/ui/*`; presentation tests.
- Enrollment: `src/theme.ts`, all `src/components/*`, every route under `app/` where composition/copy changes, and source-contract/presentation tests.
- Gate: `src/theme.ts`, all `src/components/*`, every route under `app/` where composition/copy changes, and source-contract/presentation tests.
- No backend or shared-security file is in the change map.

## 8. Migration-ledger summary

`docs/UI_REDESIGN_MIGRATION_LEDGER.md` records every production route and major reusable component. Each row starts Planned, moves to Migrated after implementation and route-level checks, and reaches Verified only after relevant unit/type/build/render checks. Old presentation code is removed only after its route’s functional parity gate.

## 9. Dependency and shadcn plan

- Apply preset `beEhf1ou` separately inside `apps/web` and `apps/tickets` with the current shadcn CLI, then inspect the full diff.
- Preserve existing base/RTL settings as the CLI specifies. Do not pass overwrite flags or replace functional local components blindly.
- Reinstall only required standard components after reading their official CLI-provided documentation. Use existing dependencies where possible.
- Do not add icon libraries, animation frameworks, or UI kits merely for styling. Remove unused presentation dependencies only after import scans, builds, and tests prove they are unused.
- If the supplied preset code is unavailable from the official registry, record the exact CLI failure, retain a reproducible config, and implement the documented semantic tokens without pretending the preset applied.

## 10. Implementation sequence

1. Baseline and inventory; create plan, audit, design system, and ledger.
2. Write presentation contract tests that fail for known defects.
3. Apply/audit web preset and establish shared web tokens/primitives.
4. Rebuild Organizer foundation, public/auth/shell, dashboard, event operations, provisioning, logs/revocations.
5. Rebuild Tickets foundation, catalogue/detail, auth/profile, confirmation/library/detail/privacy.
6. Rebuild Enrollment foundation and every route; run its unit/coverage/typecheck gate.
7. Rebuild Gate foundation and every route; run its unit/coverage/typecheck gate.
8. Cross-product status/content/accessibility/responsive review.
9. Web browser screenshot matrix and interaction checks. Per user instruction, do not attempt full mobile simulator/device E2E; record mobile unit/type results and required physical checks.
10. Production builds, source/security scans, diff review, Graphify attempt, ledger finalization, and checkpoint commits.

## 11. Accessibility plan

- Semantic headings, landmarks, labels, `aria-invalid`, busy/live state, keyboard navigation, visible focus, escape/dismiss behavior, and named horizontal table regions on web.
- 44 px/pt minimum controls; 52–56 pt primary mobile/gate controls; accessible native roles, labels, hints, and state.
- WCAG 2.2 AA contrast, text zoom/Dynamic Type, wrapping, safe reading order, non-colour status cues, reduced motion, and no gesture-only critical path.
- Run automated source tests and browser axe checks on reachable web routes/states; manually inspect focus order and mobile-width overflow.

## 12. Responsive plan

- Tickets: 390 px catalogue/detail/auth/ticket layouts and 1440 px editorial grids; real events remain in the first viewport.
- Organizer: 390 px shell/menu/forms and scrollable operational records; 1440 px event workspace with bounded content and no stretched cards.
- Mobile: preserve responsive-metric hooks, safe-area handling, keyboard avoidance, and FlatList for ticket collections; test compact and tablet metric helpers through unit tests.
- Long event names, locations, emails, and status copy must wrap without clipping.

## 13. Screenshot matrix

Local evidence lives in ignored `.focaccia/ui-redesign/`.

| App | Required rendered evidence |
| --- | --- |
| tickets | Catalogue loading/empty/populated/error; event detail; auth; confirmation; My tickets; ticket detail/cancellation; privacy; 390×844 and 1440×1000 |
| web | Public overview; login; dashboard populated/empty; create/edit; event workspace; destructive dialog; provisioning; revocations; logs; 390×844 and 1440×1000 |
| enrollment | Not fully exercised per user instruction; unit/source checks cover auth, wallet, detail, consent, capture states, pass, approved, help; physical rendering remains user QA |
| gate | Not fully exercised per user instruction; unit/source checks cover home, provision, scan, fallback, liveness, accepted/rejected, settings, export; physical rendering remains user QA |

## 14. Visual QA plan

- Compare each web capture with the design system for hierarchy, state clarity, contrast, focus, spacing, purpose-based shape, and absence of fabricated data.
- Exercise desktop/mobile widths, reduced motion, keyboard-only navigation, loading/empty/error states, dialogs/menus, and horizontal record reachability.
- Inspect mobile source compositions against safe areas, target size, Dynamic Type, camera obstruction, offline/cache/sync visibility, and accepted/rejected distance legibility; do not claim simulator/device rendering that was not run.
- Update the migration ledger with exact evidence or remaining limitation.

## 15. Functional-parity strategy

- TDD: add failing tests for the current fabricated Tickets hero, missing cancellation confirmation, deterministic artwork, privacy accuracy, shared status terms, and mobile primitive/accessibility contracts.
- Preserve data fetching, mutations, validation schemas, idempotency keys, auth/profile guards, session cleanup, camera lifecycle, persistence, crypto calls, ticket/pass reconciliation, cache/sync logic, and route destinations.
- Use existing unit/integration/source-contract suites as regression gates. Add logic-level tests only for new pure presentation adapters.
- Build/typecheck each app after its migration and run the exact user-scoped mobile unit/coverage gates.

## 16. End-to-end workflow strategy

- Web: run the local/public routes and reachable auth/degraded states in a browser; use a valid selected network mode for production builds; do not change fail-fast network semantics to make a build pass.
- Cross-app: verify contract preservation through tests/source review and, where the local backend is available safely, exercise organizer-to-ticket web actions without rotating stable credentials.
- Enrollment/Gate: user explicitly owns full device testing. This pass stops at unit tests, coverage, typecheck, and source-level visual/accessibility review; no simulator/device/export/offline/provisioning E2E claim is made.

## 17. Risk register

| Risk | Mitigation |
| --- | --- |
| Visual replacement breaks security/auth wiring | Keep controllers and providers intact; change composition around them; run existing source-contract tests |
| Preset overwrites local behavior | Run separately, no overwrite flag, inspect diff, restore/reconcile functional components before proceeding |
| Tickets build lacks selected network mode | Build through the repository’s intended env/bootstrap path; preserve fail-fast validation and report a genuine env limitation |
| Mobile camera lifecycle regresses | Avoid controller/effect rewrites; preserve mounted-camera behavior; run existing capture/liveness source tests |
| Status language hides operational nuance | Map every state through the shared vocabulary while retaining detailed explanation and audit values |
| UI suggests stronger privacy or biometric assurance | Validate copy against `PRIVACY_BY_DESIGN`, `THREAT_MODEL`, and `ASSUMPTIONS` |
| Dense organizer tables fail at mobile widths | Named focusable scroll region, sticky/clear headers where practical, explicit scroll cue, browser overflow checks |
| Full device behavior remains unrendered | Clearly separate unit/type/source evidence from user-owned physical-device QA |
| Existing dirty/generated files appear | Preserve unrelated work; inspect status before every checkpoint; Graphify output is handled separately |

Mobile design risk index: platform familiarity 5 + accessibility readiness 4 - interaction complexity 4 - performance sensitivity 4 - offline complexity 5 = **-4 (dangerous)**. The response is deliberately conservative: presentation-only changes, no controller/crypto/storage rewrites, restrained motion, and full mobile unit/coverage/typecheck regression gates.

## 18. Off-limits files and behavior

- `supabase/**`
- `packages/shared/src/**`
- database schema, migrations, Edge Functions, RLS, auth/allowlist rules
- pass signing, encryption, cancelable templates, liveness, matching, replay, revocation, offline decision, signed sync, and idempotency semantics
- server/network configuration and URL selection semantics
- native generated iOS project files unless the existing Expo build system requires an unavoidable generated change (not planned)
- stable local organizer credentials and account state

Presentation-only formatting helpers under app-local `lib` may change only when pure, type-safe, tested, and behavior-neutral.

## 19. Completion criteria

- Every production route and major component is recorded in the ledger and reaches Migrated or Verified with an honest evidence entry.
- The four modes visibly belong to one design system without reading as identical skins.
- No fabricated event, claim code, analytics, person, ticket, or operational state is shipped.
- Standard web controls use the local shadcn/Radix system; duplicate production UI systems and unused presentation code are removed only after parity.
- All existing user actions/routes/states remain available with clearer loading, empty, error, offline, stale, terminal, and recovery feedback.
- Tickets and Organizer tests/typechecks/builds and browser QA pass, subject only to documented external/runtime limitations.
- Enrollment and Gate unit/coverage/typecheck pass; their full simulator/device testing is explicitly left to the user as requested.
- Accessibility/source/security scans and `git diff --check` pass, no secrets or sensitive values are introduced, and off-limits backend/security code is unchanged.

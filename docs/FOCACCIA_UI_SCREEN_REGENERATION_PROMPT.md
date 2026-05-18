# Focaccia UI Screen Regeneration Prompt

Use this prompt when the Focaccia repo already has generated UI screens and you want a dedicated full-interface regeneration pass across the web dashboard, enrollment app, and gate app.

```text
You are a senior product designer, senior frontend engineer, React/Next.js engineer, Expo React Native engineer, mobile UI reviewer, accessibility reviewer, and security-aware UI implementation agent working inside the existing Focaccia project.

Your task is to completely scrap and rebuild the current UI implementation for every existing Focaccia frontend surface while preserving all backend behavior, data contracts, auth flows, cryptographic flows, storage logic, routing intent, and security boundaries.

This is a UI-only regeneration pass. Do not edit backend code. Do not change Supabase schema, migrations, Edge Functions, RLS policies, shared crypto code, template generation logic, liveness logic, offline verification logic, provisioning semantics, auth semantics, or API contracts. Only change UI screens, layout components, visual primitives, style/theme files, presentational components, and UI copy where that copy is part of the interface.

The project is Focaccia: a privacy-preserving event access prototype where biometric entry does not need a central face database. The repo has three production frontend surfaces:

- `apps/web`: Next.js 16 + React 19 organizer dashboard using Tailwind CSS 4 and shadcn/Radix-style primitives.
- `apps/enrollment`: Expo 55 + React Native attendee enrollment app.
- `apps/gate`: Expo 55 + React Native gate verification app.

The source-of-truth design file is `docs/DESIGN.md`. Use it as the visual contract. The target visual direction is the Focaccia “Steep / Warm, Crisp Canvas” system: light canvas, ink typography, restrained warm accent, generous whitespace, rounded surfaces, subtle elevation, high trust, clear operational hierarchy, and careful product-showcase style. Do not replace this with a dark dashboard, purple/blue AI gradient, generic SaaS card grid, or mobile app template.

Before editing code, open and read:

- `README.md`
- `docs/DESIGN.md`
- `docs/UI_UX_SPEC.md`
- `docs/TRUTH_BASE.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY_BY_DESIGN.md`
- `docs/THREAT_MODEL.md`
- `docs/ASSUMPTIONS.md`
- `docs/EVALUATION_PLAN.md`
- `apps/web/package.json`
- `apps/enrollment/package.json`
- `apps/gate/package.json`
- Existing frontend source files in:
  - `apps/web/app`
  - `apps/web/components`
  - `apps/web/hooks`
  - `apps/web/app/globals.css`
  - `apps/web/tailwind.config.ts`
  - `apps/enrollment/app`
  - `apps/enrollment/src/components`
  - `apps/enrollment/src/theme.ts`
  - `apps/gate/app`
  - `apps/gate/src/components`
  - `apps/gate/src/theme.ts`

Use these mandatory skills and plugins throughout the work:

- `$frontend-skill` at `/Users/manavcodaty/.codex/skills/frontend-skill/SKILL.md`
- `$frontend-design` at `/Users/manavcodaty/.agents/skills/frontend-design/SKILL.md`
- `$frontend-design` at `/Users/manavcodaty/.codex/skills/frontend-design/SKILL.md`
- `$frontend-ui-dark-ts` at `/Users/manavcodaty/.codex/skills/frontend-ui-dark-ts/SKILL.md`
- `$build-web-apps:frontend-app-builder` at `/Users/manavcodaty/.codex/plugins/cache/openai-curated/build-web-apps/d947469e/skills/frontend-app-builder/SKILL.md`
- `$senior-frontend` at `/Users/manavcodaty/.codex/skills/senior-frontend/SKILL.md`
- `$design-taste-frontend` at `/Users/manavcodaty/.agents/skills/design-taste-frontend/SKILL.md`
- `$ui-skills` at `/Users/manavcodaty/.codex/skills/ui-skills/SKILL.md`
- `$ui-ux-pro-max` at `/Users/manavcodaty/.codex/skills/ui-ux-pro-max/SKILL.md`
- `$ui-ux-designer` at `/Users/manavcodaty/.codex/skills/ui-ux-designer/SKILL.md`
- `$ui-review` at `/Users/manavcodaty/.codex/skills/ui-review/SKILL.md`
- `$emil-design-eng` at `/Users/manavcodaty/.agents/skills/emil-design-eng/SKILL.md`
- `$redesign-existing-projects` at `/Users/manavcodaty/.agents/skills/redesign-existing-projects/SKILL.md`
- `$design-spells` at `/Users/manavcodaty/.codex/skills/design-spells/SKILL.md`
- `$mobile-design` at `/Users/manavcodaty/.codex/skills/mobile-design/SKILL.md`
- `$high-end-visual-design` at `/Users/manavcodaty/.agents/skills/high-end-visual-design/SKILL.md`
- `@superpowers` at `plugin://superpowers@openai-curated`
- `@build-ios-apps` at `plugin://build-ios-apps@openai-curated`

Skill conflict rule:

- `docs/DESIGN.md` overrides all generic style defaults from the skills.
- Use dark-theme skills only for state, contrast, hierarchy, motion, and component-quality guidance. Do not convert Focaccia to a dark theme.
- Use web-app skills for `apps/web`, but translate their design-quality rules into Next.js/Tailwind/shadcn-compatible implementation.
- Use mobile-design and iOS build guidance for `apps/enrollment` and `apps/gate`, but do not convert the apps to SwiftUI. The current mobile stack is Expo React Native and must remain Expo React Native.
- Use design-spells and high-end visual design only where they improve trust, clarity, and repeated-use speed. No gimmicks, no distracting animations, no novelty effects in camera, liveness, crypto, or gate decision screens.
- Use existing dependencies only unless a new dependency is clearly necessary. Before importing any package, verify it exists in the relevant `package.json`. Prefer existing Radix/shadcn primitives, React Native components, Expo APIs, `react-native-reanimated` if already established, and local theme files.

Complete the work in this sequence.

1. Inventory every UI surface.
   - Search all frontend files for pages, layouts, route screens, reusable UI components, forms, cards, tables, dialogs, drawers/sheets, alerts, banners, camera guidance, QR/provisioning views, success states, error states, loading states, empty states, settings surfaces, help surfaces, debug/verification surfaces, and shared shells.
   - Produce a screen/component inventory before editing. Include file paths and a one-line purpose for each surface.
   - Group each surface by product area:
     - Web organizer auth
     - Web dashboard shell
     - Event creation and event list
     - Gate provisioning and QR payloads
     - Gate logs and revocation operations
     - Enrollment consent
     - Enrollment join/pass/capture/help flow
     - Gate provisioning
     - Gate scan/liveness/result/fallback/settings/export flow
     - Shared UI primitives
     - Shared mobile primitives

2. Diagnose the current UI against `docs/DESIGN.md`.
   - Compare every screen with the Steep / Warm, Crisp Canvas tokens and rules in `docs/DESIGN.md`.
   - Identify generic AI patterns, weak hierarchy, overused cards, inconsistent spacing, mismatched colors, poor typography, missing states, weak error handling, unclear security/privacy copy, dead controls, poor mobile touch ergonomics, and inaccessible focus/reading order.
   - For web, check Tailwind 4 usage, Radix/shadcn primitive consistency, semantic HTML, keyboard navigation, focus states, form labels, table readability, loading/empty/error states, and responsive layouts.
   - For mobile, complete a mobile checkpoint before code:
     - Platform: iOS-oriented Expo React Native dev builds.
     - Framework: Expo React Native.
     - Constraints: camera, TFLite, libsodium, QR scanning, SQLite/offline verification, SecureStore.
     - Principles: touch-first 44-48pt targets, safe areas, clear state feedback, battery/performance restraint, offline/degraded clarity.
   - Apply the design-engineering skill to motion timing, origin-aware sheets/popovers, button press feel, reduced-motion support, and performance-safe transitions.

3. Define the redesign plan.
   - Start with shared design primitives, not one-off screen styling.
   - For `apps/web`, plan updates around:
     - global CSS tokens
     - Tailwind theme usage
     - shadcn/Radix primitive styling
     - app shell
     - auth card
     - dashboard cards/tables/forms/dialogs
     - QR/provisioning cards
     - empty/loading/error states
     - toasts/alerts/focus rings
   - For `apps/enrollment` and `apps/gate`, plan updates around:
     - `src/theme.ts`
     - `ScreenShell`
     - `PrimaryButton`
     - `SectionCard`
     - `StatusBanner`
     - camera guidance
     - flow-specific route screens
     - safe-area and responsive metrics
   - Keep the plan scoped to UI and UX rendering. If a small state binding is required to display an existing UI state correctly, keep it local and do not alter backend semantics.
   - Explicitly list files that are off limits:
     - `supabase/**`
     - `packages/shared/src/**`
     - backend/data/auth/network/crypto/storage logic under `apps/*/src/lib/**` unless the change is purely type-safe UI formatting and does not affect behavior
     - database migrations
     - generated native iOS project files unless required by the existing Expo build system

4. Rebuild the UI from scratch inside the existing frontend boundaries.
   - You may replace current layout and presentational component implementations completely.
   - Preserve existing routes, navigation destinations, user actions, form submissions, backend calls, auth checks, pass issuance behavior, provisioning behavior, offline verification behavior, liveness behavior, and storage behavior.
   - Do not delete a flow because it is visually weak. Redesign it.
   - Do not add new backend-backed product features. You may add missing UI states for existing possible conditions.
   - Use Focaccia-specific copy. Avoid placeholder text, lorem ipsum, generic SaaS language, generic fitness language, shame language, AI cliches, hype copy, and vague privacy claims.
   - Keep privacy communication plain and accurate:
     - face processing happens on-device where applicable
     - raw face images are not stored in Supabase
     - passes are event-scoped
     - gate verification is designed for offline operation
     - rejection states explain what happened without leaking sensitive internals
   - Use the `docs/DESIGN.md` palette:
     - Canvas `#ffffff`
     - Ink `#17191c`
     - Fog `#f7f7f8`
     - Warm Mist `#fbe1d1`
     - Terracotta `#5d2a1a`
     - Muted Stone `#4c4c4c`
     - Hint of Grey `#a3a6af`
   - Use Signifier-style display treatment only for prominent display headings where appropriate. Use Sohne/system-style sans for UI, body, buttons, nav, forms, and operational screens.
   - Keep Focaccia light, spacious, crisp, and operational. Avoid heavy dark backgrounds, neon glows, purple/blue AI gradients, dense decorative dashboards, and card-inside-card clutter.
   - Use rounded surfaces and subtle elevation according to `docs/DESIGN.md`, but do not turn every section into a card. Operational screens should use clear grouping, tables, lists, dividers, and panels where they read better.

5. Web-specific expectations.
   - Rebuild `/login` to feel trustworthy, fast, and minimal with clear loading and auth-error states.
   - Rebuild the authenticated dashboard shell so navigation, organizer identity, sign-out, current location, and primary actions are obvious.
   - Rebuild event list/table states for populated, loading, empty, error, and degraded local-network conditions.
   - Rebuild event creation so validation, pending, success, and backend error states are clear.
   - Rebuild gate provisioning/QR screens so staff can understand what the QR does, whether a gate is provisioned, and what to do if provisioning fails.
   - Rebuild revocation/gate-log surfaces for scanning, filtering/reading, and audit confidence without visual noise.
   - Maintain semantic HTML, accessible labels, visible focus rings, keyboard navigation, and responsive behavior from mobile width through wide desktop.

6. Enrollment app expectations.
   - Rebuild the attendee flow as a guided, calm wizard.
   - Screens must cover welcome/join, consent, capture, pass, and help.
   - Consent must be plain English and specific to Focaccia’s privacy model.
   - Capture screens must be camera-safe, direct, and readable under real phone use. Avoid tiny instructions or decorative overlays that obscure the camera.
   - Pass/success screens must make the next step obvious and avoid implying the pass is reusable beyond its event scope.
   - Loading, permission denied, camera unavailable, model loading, low-quality capture, network failure, issuance failure, retry, and success states must be visually designed.

7. Gate app expectations.
   - Rebuild the gate flow for operational pressure: large type, clear mode, large touch targets, and fast status recognition.
   - Screens must cover provisioning, scan, liveness, result, fallback, settings, and export.
   - Accept/reject/result states must be unmistakable but not cartoonish.
   - Rejection states must explain the practical reason and next action without leaking sensitive data.
   - Offline/degraded states must be visible and calm.
   - Settings/export screens must be restrained, legible, and useful for verification.
   - Camera/liveness screens must prioritize performance and clarity over decorative motion.

8. Interaction, motion, and delight.
   - Add tactile button press feedback, polished sheet/dialog transitions, skeleton loaders, and subtle staggered entry where appropriate.
   - Respect reduced motion.
   - Animate only transform and opacity where possible.
   - Keep UI animation under 300ms for repeated operational interactions.
   - Avoid continuous or heavy animation on camera, liveness, QR scanning, or gate result screens.
   - Use “delight” only for low-risk moments such as successful setup, successful pass issuance, or helpful empty states.

9. Accessibility and mobile QA.
   - Verify accessible labels, hints, traits/roles, reading order, focus order, semantic grouping, contrast, keyboard navigation, reduced motion, and screen-reader-friendly wording.
   - Verify touch targets are at least 44pt/px, preferably 48pt for primary mobile controls.
   - Verify safe-area handling, keyboard avoidance, sheet dismissal, back behavior, scroll behavior, and no horizontal overflow.
   - Avoid gesture-only actions unless a visible button fallback exists.
   - Do not log secrets, tokens, pass payloads, face data, embeddings, templates, or sensitive user data while testing.

10. Verification.
   - Run all relevant checks available in the repo. At minimum, attempt:
     - `pnpm --filter @face-pass/shared typecheck`
     - `pnpm --filter @face-pass/shared test`
     - `pnpm --dir apps/web build`
     - `pnpm --dir apps/enrollment typecheck`
     - `pnpm --dir apps/enrollment test:flow`
     - `pnpm --dir apps/gate typecheck`
     - `pnpm --dir apps/gate test:offline`
     - `pnpm --dir apps/gate test:provisioning`
     - `pnpm run db:verify`
   - If UI changes depend on local Supabase behavior, start the local stack and functions:
     - `pnpm run db:start`
     - `pnpm run db:functions:serve`
     - `pnpm --dir apps/web dev`
   - Verify web UI in browser across desktop and mobile viewport sizes. Walk through signed-out login, dashboard, event creation, event list, provisioning/QR, revocation, and gate logs where local data allows.
   - Launch or build the Expo apps where the environment allows:
     - `pnpm --dir apps/enrollment ios`
     - `pnpm --dir apps/gate ios`
   - Manually walk through enrollment and gate UI flows in simulator/device where possible.
   - If external credentials, camera permissions, model assets, device availability, local Supabase runtime, or signing prevents full verification, verify the fallback/mock/degraded UI state and document the real blocker precisely.
   - Do not claim end-to-end success for flows that were not actually run.

11. Final report.
   - List every UI file changed.
   - List every screen/component reviewed.
   - Explain the shared design primitives rebuilt.
   - Include a before/after summary of the most important design upgrades.
   - Include a `Frontend Design Verification` section with:
     - `docs/DESIGN.md` rules used
     - skills/plugins used
     - screens reviewed
     - mismatches found
     - fixes made
     - intentional deviations
     - accessibility results
     - mobile QA results
     - visual/browser/simulator verification results
   - Include exact commands run and whether each passed or failed.
   - Include remaining blockers only if they are real external limitations.
   - Include a final statement confirming that no backend code, Supabase functions, migrations, shared crypto, pass issuance semantics, provisioning semantics, or offline verification semantics were changed.

I want you to self verify your work by testing it end to end. Do not return control to me until you have met the requirements and it is working as expected.
```

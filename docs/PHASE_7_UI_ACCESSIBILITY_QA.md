# Phase 7 UI, Accessibility, And Design QA

Date: 2026-06-14

## Scope

The active UI in `apps/tickets`, `apps/web`, `apps/enrollment`, and `apps/gate` was reviewed against `docs/DESIGN.md`. The pass covered loading, empty, error, authentication, ticket, pass, lifecycle, network, gate provisioning, revocation, and sync feedback surfaces that are reachable in the current applications.

## Changes

- Replaced the organizer landing and login presentation with the locked warm-canvas Focaccia system and removed active decorative motion/glass styling.
- Added skip navigation, visible keyboard focus, reduced-motion behavior, explicit button types, accessible live feedback, and field/control labels.
- Improved ticket loading semantics and muted-text contrast without logging runtime error objects.
- Made the organizer event roster a named, keyboard-focusable horizontal region with a plain-English mobile instruction.
- Added explicit accessibility state to enrollment and gate feedback/buttons and labels to sensitive credential fields.
- Added Phase 7 source-contract tests for all four applications.

## Browser Evidence

The configured Browser/IAB connector was unavailable in this session. Playwright 1.57 with system Chrome and `@axe-core/playwright` was used as the local-browser fallback.

Clean-cache WCAG A/AA audits reported zero violations and no page-level horizontal overflow for:

- Organizer home, login, and authenticated dashboard
- Ticket home, login, and privacy routes
- Desktop and 390 by 844 mobile viewports
- Reduced-motion browser preference

The organizer roster measured 308 CSS pixels wide with 1,120 CSS pixels of content and scrolled from 0 to 812. Its container has `tabIndex=0`, and the final sync/action columns remained reachable.

Reviewed screenshots are stored under `.focaccia/phase7-*.png`, including the clean-cache dashboard at `.focaccia/phase7-organizer-dashboard-mobile-clean-cache-scrolled.png`.

## Native Evidence

- Enrollment built, installed, launched, and rendered on an iPhone 17e simulator running iOS 26.5.
- Gate built, installed, launched, and rendered on the same phone simulator.
- Gate installed on an iPad mini simulator running iOS 26.5. The Expo development launcher reached the LAN server; iOS presented its first-open confirmation sheet, which `simctl` cannot acknowledge.
- A development profile for `com.facepass.enrollment` was generated and the app installed on the paired physical iPhone 12 Pro. Launch was blocked by iOS until the user explicitly trusts the new developer profile in Settings. That trust action cannot be automated from the host.

Physical-device Local Network permission and touch-flow verification therefore remain externally blocked. This is the only Phase 7 pass-gate item not completed.

## Automated Verification

- Organizer web: 41 tests passed; 89.04% lines, 82.89% branches, 84% functions; production build passed.
- Ticket web: 6 tests passed; 100% lines and branches, 90% functions; typecheck and production build passed.
- Enrollment: 43 tests passed; 93.05% lines, 81.76% branches, 94.44% functions; typecheck and iOS export passed.
- Gate: 28 tests passed; 98.97% lines, 87.16% branches, 97.92% functions; typecheck, offline verification, provisioning, and iOS export passed.
- `verify:network-config`, `verify:local-network`, and `verify:phase3` passed.
- Production-source scans found no TODO, FIXME, placeholder, debugger, or application `console.log`/`console.debug` usage. Verification scripts retain intentional result output.
- `git diff --check` passed.

## React Doctor Triage

`pnpm dlx react-doctor@latest --verbose` was run across all applications. Phase 7 findings for missing button types and status semantics were fixed. Its remaining accessibility warnings target generic polymorphic heading/group primitives; runtime axe audits confirm populated headings and valid rendered semantics.

The report also includes pre-existing performance/maintainability findings and flags public Supabase client configuration in generated `.next` artifacts as secret-looking. Network tests confirm public/server environment separation, and no service-role credential is shipped by the source. These findings are not suppressed or represented as resolved.

## Pass Status

Conditional fail: code, automated accessibility, browser, build, simulator, and LAN verification pass. The physical iPhone app is installed but cannot launch until the owner trusts the newly generated developer profile, so the mandatory physical touch and Local Network permission workflow is not yet objectively complete.

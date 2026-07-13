# Focaccia Design System

Version: 2026-07-13 presentation rebuild

Focaccia is one coherent product family expressed in four modes:

1. **Public editorial** — event discovery and ticket ownership.
2. **Organizer operational** — event readiness, records, and accountable actions.
3. **Attendee wallet** — calm, personal, event-scoped credentials.
4. **Gate operator** — high-pressure readiness, scan, decision, and recovery.

The shared visual thesis is **warm civic utility**: trustworthy public-service clarity with the warmth of a well-made ticket. The system is quiet until a user needs to act.

## Product and brand principles

1. **Real work first.** Show the catalogue, readiness state, credential, or scanner before explanatory marketing.
2. **State is part of the interface.** Loading, empty, error, offline, stale, terminal, and recovery states receive deliberate compositions.
3. **Privacy claims stay exact.** Say what is processed, where, and what is retained; never say that Focaccia stores no personal data.
4. **Technical detail is progressive.** IDs, keys, payloads, cache timestamps, and network mode remain available where necessary but never compete with the task.
5. **Shape communicates purpose.** Cards, controls, credentials, status chips, and camera overlays do not share one indiscriminate radius.
6. **Motion confirms causality.** Repeated operations are quick, interruptible, reduced-motion safe, and never decorative in camera or verification flows.
7. **One action dominates.** Each screen has one obvious next step; secondary actions are visibly secondary and destructive actions require confirmation.

## Colour tokens

| Token | Hex | Role |
| --- | --- | --- |
| `canvas` | `#FFFDFC` | Primary warm canvas |
| `surface` | `#FFFFFF` | Inputs, dialogs, credentials, high-clarity panels |
| `surface-subtle` | `#F7F4F1` | Quiet grouping and alternating rows |
| `surface-clay` | `#F4DED2` | Selected/brand-supporting surface |
| `ink` | `#1D1917` | Primary text and inverse surface |
| `ink-muted` | `#625B56` | Secondary text |
| `ink-subtle` | `#817973` | Tertiary text that still meets contrast at intended sizes |
| `border` | `#DED8D3` | Default border and divider |
| `border-strong` | `#BDB4AD` | Emphasized boundaries and controls |
| `clay` | `#7B3F2C` | Primary brand/action colour |
| `clay-hover` | `#673323` | Primary hover/pressed state |
| `clay-soft` | `#F4DED2` | Brand tint |
| `inverse` | `#1D1917` | Camera and high-contrast operational surfaces |
| `inverse-muted` | `#D9D1CB` | Secondary inverse text |

No generic blue or purple gradient is a brand token. Dark surfaces are limited to camera, QR contrast, and accepted/rejected operational moments.

### Status tokens

| Meaning | Foreground | Background | Border | Use |
| --- | --- | --- | --- | --- |
| Success / accepted | `#176747` | `#E7F4ED` | `#A7D6C0` | Ready, enrolled, checked in, entry accepted |
| Warning / stale | `#7A4D06` | `#F8ECD4` | `#DEC284` | Needs setup, stale cache, sync pending |
| Destructive / rejected | `#9D3525` | `#FBE8E3` | `#E4B3A8` | Revoked, action required, entry rejected |
| Informational | `#4D4540` | `#F1EEEB` | `#D5CEC8` | Neutral state and contextual notices |

Status is never communicated by colour alone. Every state has text and, where useful, an icon.

## Typography

### Web operational sans

- Primary: the locally configured Geist/modern system sans from the shadcn preset; fallback `ui-sans-serif, system-ui, sans-serif`.
- UI controls: 14–16 px, 600 weight for primary actions.
- Body: 15–16 px, 1.5–1.65 line height.
- Labels: 13–14 px, 600 weight; sentence case.
- Page title: 32–44 px responsive, 600–650 weight, tight but not compressed.
- Counts, dates, times, generations, and timestamps use tabular numerals.

### Public editorial

- A restrained local serif/display face may be used for event names and selected primary headings only.
- Forms, prices, statuses, checkout, and navigation always use the operational sans.
- Display text wraps naturally; no text-gradient treatments.

### Mobile

- IBM Plex Sans remains the bundled native-feeling family already loaded once by each app.
- The scale is Dynamic-Type friendly: display 32–40, title 24–30, section 18–22, body 16–18, label 14–16, caption 13–14.
- Avoid fixed-height text containers. Permit wrapping for long event names, locations, status explanations, and accessibility text sizes.

## Spacing, grids, and breakpoints

Base spacing sequence: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

- Web page gutters: 16 px mobile, 24 px tablet, 32–48 px desktop.
- Public content maximum: 1280 px; readable event/detail column: 720 px.
- Organizer shell maximum: 1440 px; tables may use contained horizontal scrolling with a keyboard-focusable region.
- Mobile horizontal safe padding: 20 px compact phones, 24 px standard phones, up to 32 px tablets.
- Mobile vertical section gap: 24–32 px; camera layouts may use 16–20 px.

Breakpoints:

- `compact`: below 640 px — single column, bottom/thumb-zone primary action.
- `medium`: 640–1023 px — two-column where content supports it; no squeezed tables.
- `wide`: 1024–1439 px — organizer shell and split event/detail layouts.
- `extra-wide`: 1440 px and above — content remains bounded; whitespace grows, components do not stretch indiscriminately.

## Shape, borders, shadows, and elevation

| Purpose | Radius |
| --- | --- |
| Compact controls, menus, table actions | 10–12 px |
| Inputs and operational panels | 12–16 px |
| Standard mobile surfaces | 16–20 px |
| Event artwork and wallet credentials | 22–28 px |
| Statuses and segmented controls | Capsule only where semantically useful |

- Default containers use a 1 px quiet border or tonal surface, not both heavy border and shadow.
- Strong shadow is reserved for dialogs, sheets, menus, floating mobile actions, and the active wallet credential.
- Default elevation: none. Raised: `0 8px 24px rgba(29,25,23,.08)`. Overlay: `0 20px 60px rgba(29,25,23,.16)`.
- Focus rings are not shadows used for decoration; they are persistent accessibility indicators.

## Iconography

- Web uses the icon library configured by the applied shadcn preset and local component system; do not mix icon families in one surface.
- Mobile uses existing vector/native symbols where already available; text labels remain for critical actions.
- Icons use `currentColor`, inherit semantic state, and are normally 16–20 px web / 20–24 pt mobile.
- No emoji stand in for product icons. Decorative icons are omitted when text is clearer.

## Interaction and motion

- Hover: small tonal or border shift; no layout movement.
- Press: opacity and `scale(.98)` where appropriate, returning immediately on release.
- Focus-visible: 2 px clay ring with 2 px canvas offset; destructive controls use the same focus mechanism, not colour-only focus.
- Disabled: reduced contrast plus a disabled semantic state; never rely on opacity below readable contrast for explanatory text.
- Pending: preserve the control width, use an explicit verb such as `Saving…`, prevent duplicate mutations, and expose busy state.
- Repeated UI motion: 120–220 ms. Dialog/sheet: up to 260 ms. Only opacity and transform by default.
- Reduced motion removes stagger, scale, and travel while preserving immediate state changes.
- Camera, liveness, QR scanning, and gate result surfaces have no continuous decorative animation.

## Forms

- Every input has a persistent label; placeholder text is optional support, never the label.
- Group related fields with `Field`, `FieldGroup`, descriptions, and inline errors on web; native equivalents use accessible labels/hints.
- Errors appear beside the field and in a concise form-level alert when submission fails.
- Required fields, constraints, and paid-ticket limitations are disclosed before submit.
- Destructive changes use an AlertDialog or native confirmation. Validation and mutation logic remain existing code unless a UI adapter is required.

## Tables, lists, and records

- Use tables for comparable operational records, lists for browsing, and definition rows for single-record detail.
- Headers remain visible and concise. Rows use alignment and dividers before card chrome.
- Mobile web tables live in named, focusable horizontal regions and include a plain-language scroll cue when columns exceed the viewport.
- Row actions use a menu when there are several secondary actions; the primary destination can remain the row title link.
- Empty, loading, and error states occupy the table/list region so layout does not jump into an unrelated page design.

## Navigation patterns

- Public ticketing: compact site header; Discover, My tickets, and account state. Mobile uses an accessible menu/sheet if needed.
- Organizer: persistent wide navigation and a compact mobile sheet; current route and organizer identity are explicit.
- Event workspaces: shallow route tabs for Overview, Provisioning, Revocations, and Logs.
- Enrollment: linear route progression with visible Back/Help where safe; the wallet remains the recovery home.
- Gate: task set stays small—Home, Scan, Settings, Export—with scanner access dominant and safe Back/Cancel actions.
- No hover-only or gesture-only critical action.

## State compositions

### Loading

- Web uses skeletons matching the final content shape and short live-region labels.
- Mobile uses a stable surface with an activity indicator and the current verb; never blank the screen during security-sensitive work.

### Empty

- State what is absent, why that may be normal, and the one available next action.
- Do not fabricate examples, claim codes, analytics, people, or tickets to make an empty screen feel populated.

### Error and degraded

- Say what failed, what is still safe, and what the user can do next.
- Network, permission, model, capacity, ownership, terminal, stale-cache, and sync errors remain distinct.
- Do not expose stack traces, backend enums, access tokens, pass payloads, keys, face values, or sensitive identifiers.

## Mobile surfaces

### Safe areas and touch

- Respect top, bottom, left, and right safe areas. Keyboard avoidance must retain the submit action.
- Minimum target is 44 pt; primary gate and capture actions target 52–56 pt.
- Primary actions live in the thumb zone unless the camera task requires a stable overlay.
- Long collections use `FlatList`; critical flows do not depend on gesture-only dismissal.

### Wallet credentials

- Credential cards use 22–28 pt radii, a clear event identity, status, date/location, generation/validity, and one next action.
- Stacking may communicate multiple passes, but essential content remains readable without animation.
- Focaccia passes must not be described as Apple Wallet passes, reusable identity, or transferable credentials.

### Camera and gate operational surfaces

- Use inverse ink surfaces for contrast, a large unobstructed camera region, one instruction at a time, and a visible Cancel/fallback path.
- Scanner/liveness overlays use white or semantic borders that remain visible in daylight and do not obscure faces or QR codes.
- Accepted/rejected results are readable from arm’s length and combine title, reason, and next action.
- Gate readiness exposes event, provisioning, revocation cache freshness, network/offline state, and pending sync before scan begins.

## Accessibility rules

- WCAG 2.2 AA contrast for text, controls, focus, and semantic states.
- Semantic HTML and native roles; valid heading order; one page-level heading.
- Keyboard access and visible focus for every web action, including menus, dialogs, filters, and horizontal record regions.
- Accessible labels, hints, state, and live feedback for native controls. Announce accepted/rejected and mutation results.
- Support 200% web zoom, reduced motion, Dynamic Type, text wrapping, and screen-reader reading order.
- Colour never carries state alone. Icon-only controls require accessible names and tooltips on web.
- QR areas retain high contrast and a quiet zone; do not place gradients, textures, or translucent overlays behind the code.

## Content rules and vocabulary

- Sentence case, short concrete verbs, no shame language, no AI/startup hype, no vague “military-grade” or “zero data” claims.
- Prefer `Open scanner`, `Refresh revocations`, `Try capture again`, and `Cancel ticket` to generic `Continue` when the action is known.
- Use UK English and GBP formatting already established by the product.
- Describe privacy precisely: face processing happens on device; native capture may create a temporary file deleted best-effort after inference; encrypted event-scoped template material is used; Supabase stores required personal and operational records but not raw face images or reusable embeddings.

Shared status vocabulary:

| Product state | User-facing term |
| --- | --- |
| Prepared and safe to proceed | Ready |
| Configuration incomplete | Needs setup |
| Blocking problem | Action required |
| Gate can decide without network | Offline ready |
| Accepted receipt queued locally | Sync pending |
| Revocation cache missing or critical | Refresh required |
| Pass issued | Enrolled |
| Accepted gate record | Checked in |
| Attendee cancellation | Cancelled |
| Organizer terminal revocation | Revoked |
| Generation returned to zero | Reset by organizer |
| Positive gate decision | Entry accepted |
| Negative gate decision | Entry rejected |

Backend enums may appear only in developer/audit detail when genuinely required, never as the primary status label.

## Component conventions

### Web

- Standard controls, forms, feedback, navigation overlays, menus, dialogs, tables, tabs, and tooltips use local shadcn/Radix components.
- Product compositions—event poster, readiness strip, credential summary, operation timeline—compose those primitives and shared tokens.
- No second raw-button/input/dialog system may coexist inside production routes.

### Native

- Shared primitives are `ScreenShell`, `PrimaryButton`, `SectionCard`, `StatusBanner`, brand mark, status chip, ticket/metric rows, and camera guidance.
- Route files own composition and existing controllers/state; shared primitives own spacing, touch feedback, semantics, and token use.
- Avoid prop matrices that turn one component into every surface. Add small purpose-built primitives where composition differs materially.

# UI_UX_SPEC.md

## One-Time Face Pass — UI / UX Specification

## 1. Purpose

This document defines the user interface structure, navigation flow, and component hierarchy for **One-Time Face Pass** across:

1. the **Next.js web dashboard** for organizers, and  
2. the **Expo-based iOS mobile apps** for attendee enrollment and gate verification.

This is a structural blueprint rather than a visual design system. Its purpose is to ensure that the interface layer remains fully aligned with the architectural and security constraints already fixed in the truth base, PRD, architecture document, and threat model.

The UI/UX design must support the following system goals:

- clear privacy communication,
- low-friction event setup,
- understandable biometric consent,
- predictable and auditable gate operation,
- readable success and failure states,
- minimal ambiguity during security-sensitive flows,
- strong perceived reliability during camera, liveness, cryptographic, and offline verification operations.

---

## 2. Locked Frontend Constraints

## 2.1 Web Dashboard Constraints
The organizer dashboard must be built with:

- **Next.js 16 App Router**
- **Tailwind CSS**
- **`shadcn/ui` component library**

All dashboard interface elements must be implemented using `shadcn/ui` building blocks and styled through Tailwind CSS utility classes. This includes, at minimum:

- buttons,
- cards,
- inputs,
- labels,
- forms,
- tables,
- badges,
- alerts,
- dialogs,
- dropdown menus,
- separators,
- tabs where appropriate,
- toast feedback.

No custom ad hoc widget system should replace these primitives for the main dashboard surfaces.

## 2.2 iOS App Constraints
The **Enrollment App** and **Gate App** must be built with React Native + Expo Dev Build and must use:

- **standard React Native `StyleSheet`** for layout and styling,
- native-feeling screen composition,
- minimal runtime layout overhead,
- restrained animation usage.

The explicit reason for this styling constraint is to preserve stable performance during:

- camera frame handling,
- TFLite inference,
- liveness tracking,
- libsodium cryptographic operations,
- QR scanning,
- local offline verification.

This means the mobile apps must avoid heavy runtime styling abstractions and should use direct `StyleSheet.create(...)` definitions with predictable render trees.

---

## 3. Design Principles

## 3.1 Security-Critical Clarity
Where the system is making a security decision, the UI must state clearly:

- what is happening,
- whether the user must wait or act,
- whether the action succeeded or failed,
- what the next step is.

## 3.2 Privacy Transparency
The enrollment flow must explain in plain language:

- face data is processed on-device,
- no face image is uploaded or stored,
- the pass is event-scoped,
- the final token is one-time-use.

## 3.3 Operational Readability
The gate UI must be optimized for fast comprehension under pressure. Gate staff should be able to identify:

- current mode,
- whether the scanner is live,
- whether a challenge is in progress,
- whether the result is accept or reject,
- why a rejection happened.

## 3.4 Low Cognitive Load
The design should reduce branching and avoid dense technical language on primary screens. Technical detail belongs in secondary help or logs, not in the main interaction path.

## 3.5 State Visibility
Longer operations must expose explicit progress states so users do not assume the app is frozen. This is especially important during:

- face model loading,
- template generation,
- encryption,
- token signing request,
- offline verification,
- liveness tracking.

---

## 4. Global Information Architecture

The product has three frontend surfaces:

1. **Organizer Dashboard (Web)**
2. **Enrollment App (iOS)**
3. **Gate App (iOS)**

Each surface must use a different interaction model:

- **Web**: dashboard/admin model, dense enough for configuration and review.
- **Enrollment**: guided wizard model, sequential, calm, trust-building.
- **Gate**: kiosk / operations model, large touch targets, immediate status visibility.

---

# 5. Next.js Web Dashboard UI Specification

## 5.1 Technology Requirement
The web dashboard must use:

- **Tailwind CSS for layout, spacing, typography, color, borders, responsive rules, and state styling**
- **`shadcn/ui` for all interface elements**, especially:
  - `Button`
  - `Card`
  - `Input`
  - `Label`
  - `Form`
  - `Table`
  - `Dialog`
  - `Alert`
  - `Badge`
  - `Tabs`
  - `DropdownMenu`
  - `Separator`
  - `Toast`
  - `Textarea` where needed

All forms, tables, confirmation modals, and destructive actions must be composed from these primitives.

---

## 5.2 Web Dashboard Page Map

### A. `/login`
**Purpose:** organizer authentication entry point.

**Primary UI blocks:**
- centered auth card,
- event system title and short privacy/security positioning line,
- email/password form,
- sign-in button,
- error alert area.

**Component hierarchy:**
- Page container
  - `Card`
    - `CardHeader`
    - `CardTitle`
    - `CardDescription`
    - `CardContent`
      - `Form`
        - `FormField` email
        - `FormField` password
        - `Button`
      - `Alert` for auth failure

**UX notes:**
- very minimal page,
- no distraction,
- clear loading state on submit,
- disabled button while auth request is pending.

---

### B. `/dashboard`
**Purpose:** organizer landing page after login.

**Content:**
- top summary bar,
- list of events,
- create-event CTA,
- quick status chips for provisioning and revocations.

**Primary UI blocks:**
- page header with title and action button,
- event table or card list,
- small empty state if no events exist.

**Component hierarchy:**
- App shell
  - top nav
    - product name
    - organizer identity
    - sign out button
  - main content
    - page header
      - title
      - subtitle
      - `Button` “Create Event”
    - content area
      - if events exist:
        - `Table`
          - columns:
            - event name
            - event id
            - time window
            - gate status
            - revocation count
            - actions
      - if no events:
        - `Card`
          - empty-state icon area
          - explanatory text
          - `Button`

**UX notes:**
- gate status should be visible immediately via `Badge`,
- “Create Event” should be above the fold,
- action menu for each event should use `DropdownMenu`.

---

### C. `/events/new`
**Purpose:** event creation form.

**Fields:**
- event name,
- event id,
- starts_at,
- ends_at.

**Primary UI blocks:**
- single form card,
- validation hints,
- submit button,
- cancellation button.

**Component hierarchy:**
- Page container
  - `Card`
    - `CardHeader`
    - `CardContent`
      - `Form`
        - event name field
        - event id field
        - starts_at field
        - ends_at field
        - inline validation messages
        - button row
          - `Button` primary submit
          - `Button` secondary cancel

**UX notes:**
- strong inline validation,
- prevent invalid time ranges at form level,
- submit button label should change to a loading state such as “Creating event...”.

---

### D. `/events/[eventId]`
**Purpose:** primary event detail view.

**Content sections:**
1. event summary,
2. join code,
3. provisioning state,
4. public cryptographic metadata,
5. revocation controls,
6. logs / exports entry point.

**Primary UI layout:**
- top hero summary card,
- two-column desktop layout,
- stacked mobile layout.

**Component hierarchy:**
- App shell
  - header row
    - back navigation
    - event title
    - event action buttons
  - summary section
    - `Card`
      - event name
      - event id
      - time window
      - `Badge` gate provisioned / not provisioned
  - content grid
    - left column
      - `Card` join code
      - `Card` gate provisioning state
      - `Card` public values
    - right column
      - `Card` revocations
      - `Card` logs

**Section-specific notes:**

#### Join Code Card
- large monospaced join code,
- copy button,
- explanatory helper text for attendee enrollment.

Use:
- `Card`
- `Button`
- `Badge`
- `Toast` for copy success

#### Gate Provisioning Card
- prominent current status,
- timestamp if provisioned,
- one-gate-per-event explanation,
- warning styling if not provisioned.

Use:
- `Card`
- `Badge`
- `Alert`

#### Public Values Card
Displays:
- `PK_SIGN_EVENT`
- `EVENT_SALT`
- `PK_GATE_EVENT` if provisioned

These should be displayed in:
- wrapped monospaced blocks,
- not editable inputs,
- copyable rows.

Use:
- `Card`
- `Button`
- `Separator`

#### Revocations Card
Displays:
- list of revoked pass IDs,
- add-revocation action,
- remove-revocation action.

Use:
- `Table`
- `Dialog` for add confirmation if needed
- `Dialog` for delete confirmation
- `Button`
- `Toast`

#### Logs Card
Displays:
- uploaded log entries,
- CSV download links,
- empty state if no logs uploaded yet.

Use:
- `Table`
- `Button`
- `Badge`

---

### E. `/events/[eventId]/logs`
**Purpose:** dedicated log review page if the event has enough log volume to warrant a separate route.

**Content:**
- log upload history,
- downloadable CSV rows,
- summary counts,
- filters by outcome or reason code.

**Component hierarchy:**
- page header
- summary stat cards
- filters row
- logs table

Use:
- `Card`
- `Table`
- `Input`
- `Select` if used via shadcn/ui primitives
- `Badge`
- `Button`

**UX notes:**
- this page should stay administrative, not forensic-heavy,
- users should be able to spot common failure reasons quickly.

---

## 5.3 Web Navigation Model

### Top-Level Navigation
The dashboard shell should include:
- Dashboard
- Current event context when inside event detail
- Sign out

### Internal Event Navigation
Inside an event page, use either:
- stacked cards on one page for simplicity, or
- small `Tabs` for sections like Overview / Revocations / Logs.

The simpler version is preferred unless the event page becomes too long.

---

## 5.4 Web Dashboard Feedback Patterns

### Form Submission Feedback
Every form must support:
- idle,
- validating,
- submitting,
- success,
- failure.

Use:
- disabled button while pending,
- spinner inside primary button,
- `Toast` for success,
- `Alert` for errors that block progression.

### Destructive Action Feedback
Revocation creation/removal should require:
- explicit confirmation,
- visible result,
- no silent deletion.

Use:
- `Dialog`
- destructive button styling
- success toast.

### Empty States
All empty states should include:
- one sentence stating why the area is empty,
- one sentence describing next action,
- one primary CTA if relevant.

---

## 5.5 Web Component Hierarchy Summary

```text
Web App Shell
├── Top Navigation
│   ├── Product Label
│   ├── Context Title
│   └── Sign Out Button
├── Dashboard Page
│   ├── Header Row
│   ├── Create Event Button
│   └── Events Table / Empty State Card
├── Create Event Page
│   └── Event Form Card
└── Event Detail Page
    ├── Event Summary Card
    ├── Join Code Card
    ├── Gate Status Card
    ├── Public Values Card
    ├── Revocations Card
    └── Logs Card
```

---

# 6. Enrollment App (Expo iOS) UI Specification

## 6.1 Styling Requirement
The Enrollment App must use **standard React Native `StyleSheet`** for all layout and styling. This is mandatory to preserve high runtime efficiency during:

- TFLite embedding inference,
- face detection and alignment,
- cryptographic template encryption,
- QR rendering preparation,
- camera preview lifecycle.

This app should avoid complex runtime styling abstractions and keep screen trees shallow and predictable.

---

## 6.2 Enrollment Screen Map

Required route structure:

- `/`
- `/consent`
- `/capture`
- `/pass`
- `/help`

---

## 6.3 Enrollment Screen Specifications

### A. `/` — Join Code Screen
**Purpose:** attendee enters the join code.

**Main elements:**
- product title,
- short privacy-first subtitle,
- join code text input,
- continue button,
- status area,
- help link.

**Hierarchy:**
- Safe area container
  - header block
  - input block
    - label
    - text input
    - helper text
  - primary button
  - inline status area
  - secondary help action

**States:**
- idle,
- invalid input,
- fetching enrollment bundle,
- event unavailable,
- gate not yet provisioned.

**Feedback loop:**
1. user enters code,
2. button enables only when format is acceptable,
3. on submit, button disables and label changes to “Checking event...”,
4. inline progress text appears,
5. on success, route advances,
6. on failure, inline error message and retry affordance appear.

**Style notes:**
- centered composition,
- large tap targets,
- clean, trust-building aesthetic,
- visible keyboard-safe spacing.

---

### B. `/consent` — Privacy and Consent Screen
**Purpose:** explain biometric handling before capture.

**Main elements:**
- title,
- plain-language explanation,
- short bullet list of privacy guarantees,
- consent checkbox/toggle,
- continue button,
- back button.

**Required content themes:**
- on-device processing,
- no face image storage,
- no reusable biometric storage,
- one-time event pass,
- attendance verification only.

**Hierarchy:**
- scroll container
  - title
  - explanatory paragraph block
  - bullet list block
  - consent control row
  - action row

**States:**
- continue disabled until consent is given,
- optional secondary “Learn more” link to `/help`.

**Feedback loop:**
- no cryptographic or camera operations start before explicit consent,
- the UI should make this pause feel intentional and trustworthy.

---

### C. `/capture` — Face Capture Screen
**Purpose:** capture face and generate pass.

This is the most complex attendee screen.

**Main layout zones:**
1. top instruction area,
2. live camera preview,
3. face alignment guide,
4. live status text,
5. processing overlay zone,
6. primary / retry controls.

**Hierarchy:**
- full-screen container
  - top instruction panel
  - camera preview region
    - overlay frame guide
    - face-detected indicator
  - bottom status panel
    - instruction text
    - quality feedback
    - action button(s)

---

## 6.4 Camera Permission Feedback Loop (Enrollment)

### Required states
1. **Not requested**
2. **Requesting**
3. **Granted**
4. **Denied temporarily**
5. **Denied permanently / needs Settings**

### UX behavior
- before requesting, explain why camera access is needed,
- after tapping continue, show system permission request,
- if granted, transition into live camera,
- if denied, show clear fallback message,
- if permanently denied, show “Open Settings” action.

### Required UI messages
- pre-permission: “We need camera access to generate your pass on this device.”
- denied: “Camera access is required to continue enrollment.”
- permanent denial: “Enable camera access in Settings to continue.”

### Buttons
- `Continue`
- `Try Again`
- `Open Settings`
- `Back`

---

## 6.5 Capture Quality Feedback Loop

During live preview, the app must provide exact real-time guidance using lightweight overlays and text.

### Quality states
- no face detected,
- face too far,
- face too close,
- low lighting,
- face not centered,
- ready to capture,
- processing.

### Example feedback text
- “Move your face into the frame.”
- “Bring the phone slightly closer.”
- “Move a little farther back.”
- “Center your face.”
- “Hold still.”
- “Face captured. Creating your pass...”

This feedback must be visible without overwhelming the preview.

---

## 6.6 Cryptographic Processing Feedback Loop (Enrollment)

Once capture succeeds, the attendee must see explicit progress through the sensitive processing chain.

### Required processing phases
1. **Preparing face**
2. **Generating secure face template**
3. **Encrypting pass data**
4. **Requesting server signature**
5. **Finalizing pass**

### UI treatment
- full-screen or modal loading overlay,
- each phase shown as a single active line or step list,
- user interaction disabled while critical operations run,
- no ambiguous frozen state.

### Example copy
- “Preparing face...”
- “Generating secure event pass...”
- “Encrypting pass data for gate verification...”
- “Contacting server for secure signature...”
- “Your pass is almost ready...”

### Failure states
- face model failed,
- encryption failed,
- signing request failed,
- network error,
- unknown error.

### Failure UI
- blocking error card or panel,
- plain-language explanation,
- retry button,
- back button if the user needs to restart.

---

### D. `/pass` — Pass Display Screen
**Purpose:** display the signed QR token and fallback options.

**Main elements:**
- success title,
- event name / time,
- QR code,
- copy token button,
- token snippet,
- instruction card,
- optional help button.

**Hierarchy:**
- scroll container
  - success header
  - event summary card
  - QR card
  - fallback card
  - instructions card

**Required UX notes:**
- QR code must be large and high contrast,
- copy action must provide instant confirmation,
- fallback text must explain that full token copy can be used if scanning fails,
- the screen should feel stable and complete, not like a transient loading state.

**Feedback loop:**
- copy button changes to success state briefly,
- if QR rendering fails, provide fallback token view and retry render action.

---

### E. `/help` — Help and Entry Instructions
**Purpose:** low-pressure support surface.

**Content:**
- how to enroll,
- what privacy means in this app,
- how to present the QR at the gate,
- what to do if scan fails,
- what active liveness means.

**UX notes:**
- this must be readable and reassuring,
- not overly technical,
- should reduce fear around the face step.

---

## 6.7 Enrollment Component Hierarchy Summary

```text
Enrollment App
├── Join Code Screen
│   ├── Header
│   ├── Join Code Input
│   ├── Continue Button
│   └── Inline Status Area
├── Consent Screen
│   ├── Privacy Summary
│   ├── Consent Control
│   └── Continue Button
├── Capture Screen
│   ├── Instruction Header
│   ├── Camera Preview
│   ├── Face Guide Overlay
│   ├── Real-Time Quality Feedback
│   └── Processing Overlay
├── Pass Screen
│   ├── Success Header
│   ├── Event Summary
│   ├── QR Display
│   ├── Copy Token Action
│   └── Fallback Instructions
└── Help Screen
    ├── FAQ Blocks
    └── Entry Guidance
```

---

# 7. Gate App (Expo iOS) UI Specification

## 7.1 Styling Requirement
The Gate App must also use **standard React Native `StyleSheet`** for layout and styling. This is mandatory for operational consistency and to minimize UI overhead during:

- QR scan pipeline,
- signature verification,
- sealed-box decryption,
- active liveness tracking,
- live embedding inference,
- Hamming comparison,
- local database writes.

The gate app should prioritize:

- fast first paint,
- large touch targets,
- readable typography,
- high contrast state colors,
- minimal layout nesting.

---

## 7.2 Gate Screen Map

Required routes:

- `/`
- `/provision`
- `/scan`
- `/liveness`
- `/result`
- `/fallback`
- `/settings`
- `/export`

---

## 7.3 Gate Screen Specifications

### A. `/` — Home / Event Selection Screen
**Purpose:** confirm organizer auth state and select the event context.

**Main elements:**
- current organizer/session state,
- list of accessible events,
- status badge per event,
- primary select action,
- link to provisioning if needed.

**States:**
- loading events,
- no events,
- event selected,
- unauthorized.

**UX notes:**
- should be simple and operational,
- no dense admin clutter,
- provisioning status should be visible immediately.

---

### B. `/provision` — Gate Provisioning Screen
**Purpose:** bind the single gate phone to the event.

**Main elements:**
- selected event summary,
- provisioning explanation,
- primary “Provision This Gate” action,
- current status,
- post-success confirmation.

**Provisioning feedback loop:**
1. idle screen explains that this will create the gate encryption keys on this device,
2. user taps provision,
3. UI enters blocking provisioning state,
4. progress copy steps through:
   - generating secure gate keys,
   - registering gate with server,
   - downloading offline verification bundle,
   - saving secure local configuration,
5. success screen shows gate ready,
6. if provisioning fails, show exact retry state.

**Failure cases to surface:**
- event already provisioned,
- network error,
- secure storage failure,
- bundle sync failure.

---

### C. `/scan` — Primary Scanning Screen
**Purpose:** operational scanning surface during live entry.

This is the most important gate screen.

**Main layout zones:**
1. event header,
2. scanner preview,
3. scanner frame,
4. persistent status bar,
5. bottom action row.

**Main elements:**
- event name,
- offline-ready badge,
- camera scanner preview,
- “Ready to scan” status,
- manual fallback button,
- settings access.

**Operational states:**
- initializing scanner,
- scanner ready,
- token detected,
- verifying token,
- blocked because camera permission missing,
- paused after result.

**Feedback loop:**
- scanner should remain visually stable,
- once token is detected, scanner preview may freeze or dim,
- status text should change immediately to “Verifying token...”,
- user must never wonder whether the scan registered.

---

## 7.4 Camera Permission Feedback Loop (Gate)

This is similar to the enrollment app but operationally stricter.

### Required states
1. not requested,
2. requesting,
3. granted,
4. denied,
5. permanently denied.

### Required UI behavior
- explain that camera access is required for QR scanning and live verification,
- if denied, block use of scan route,
- surface clear path to Settings,
- keep fallback access available where appropriate.

### Message examples
- “Camera access is required to scan passes and complete verification.”
- “Enable camera access in Settings to operate the gate scanner.”

---

### D. `/liveness` — Active Liveness Screen
**Purpose:** challenge the attendee after token structure and decryption succeed.

**Main layout zones:**
- top prompt area,
- live face preview,
- challenge progress indicator,
- countdown / timing cue,
- status line.

**Supported challenge prompts:**
- blink twice,
- turn left then center,
- look up then center.

### Required liveness feedback loop
1. token validated and decrypted,
2. route transitions to liveness screen,
3. prompt appears immediately in large text,
4. countdown / time window is visible,
5. live tracking indicator shows whether the face is being tracked,
6. if tracking is lost, prompt resets with clear text,
7. if challenge succeeds, status changes to “Liveness confirmed. Matching...”
8. if challenge fails, route transitions to reject result.

### Required live indicators
- face tracked / not tracked,
- challenge in progress,
- time remaining,
- success pulse when completed.

### Example on-screen copy
- “Blink twice”
- “Hold your face in frame”
- “Face lost. Re-center to continue.”
- “Liveness confirmed. Verifying match...”

---

## 7.5 Cryptographic Processing Feedback Loop (Gate)

The gate app must explicitly expose verification progress after token acquisition.

### Required phases
1. **Reading token**
2. **Verifying signature**
3. **Checking event and validity window**
4. **Checking replay and revocation status**
5. **Decrypting secure template**
6. **Running liveness**
7. **Generating live template**
8. **Comparing secure match**
9. **Recording result**

### UI treatment
- these states can be shown in:
  - a compact status bar on scan/liveness screens, or
  - a full-screen transitional verifier panel.

### Design rule
The app must always show one dominant current step. Do not show all steps with equal emphasis if that makes the screen noisy.

### Failure examples to expose clearly
- invalid token,
- bad signature,
- wrong event,
- expired token,
- replay used,
- revoked token,
- decrypt fail,
- liveness fail,
- match fail,
- system error.

---

### E. `/result` — Result Screen
**Purpose:** show the final decision.

This screen must be high contrast and instantly interpretable.

**Two primary variants:**
- **Accept**
- **Reject**

### Accept layout
- full-screen green dominant state,
- large “Accepted” text,
- optional check icon,
- event context,
- optional subtle pass-id snippet,
- auto-return to scan after short delay,
- haptic success feedback.

### Reject layout
- full-screen red or warning state,
- large reason title,
- short human-readable explanation,
- action buttons:
  - `Try Again`
  - `Manual Fallback` where relevant
  - `Back to Scan`

### Required result behavior
- accepted passes must not be ambiguous,
- rejected passes must state why in operator language,
- auto-reset should be predictable and visible.

**Operator-readable reason examples**
- “Pass already used”
- “Pass expired”
- “Wrong event”
- “Liveness failed”
- “Face did not match”
- “Could not verify token”

---

### F. `/fallback` — Manual Token Entry Screen
**Purpose:** handle non-scannable QR cases.

**Main elements:**
- title,
- explanatory text,
- large multiline token input,
- paste button,
- validate button,
- inline validation state.

**Feedback loop:**
1. gate staff pastes token,
2. app validates structure locally,
3. if valid, enters same verification pipeline as scan,
4. if invalid, show immediate message before deeper verification.

**UX notes:**
- keep this screen simple,
- make paste easy,
- make return-to-scan obvious.

---

### G. `/settings` — Gate Settings Screen
**Purpose:** operational configuration and read-only context.

**Content:**
- selected event,
- gate provisioning status,
- offline sync timestamp,
- threshold / policy visibility if exposed,
- secure reset or reprovision actions if allowed.

**UX notes:**
- settings should be sparse,
- dangerous actions require confirmation,
- reprovision/reset must use clear warning language.

---

### H. `/export` — Log Export Screen
**Purpose:** export local logs after event.

**Content:**
- event summary,
- count of stored entries,
- export CSV action,
- upload logs action if supported,
- last export timestamp.

**Feedback loop:**
- show progress during export generation,
- show success message with file or upload result,
- show failure reason if export fails.

---

## 7.6 Gate App Component Hierarchy Summary

```text
Gate App
├── Home / Event Selection Screen
│   ├── Session Header
│   ├── Event List
│   └── Provisioning Status Badges
├── Provision Screen
│   ├── Event Summary
│   ├── Provision CTA
│   └── Progress State Panel
├── Scan Screen
│   ├── Event Header
│   ├── QR Scanner Preview
│   ├── Status Bar
│   └── Action Row
├── Liveness Screen
│   ├── Challenge Prompt
│   ├── Live Preview
│   ├── Tracking Indicator
│   └── Progress Status
├── Result Screen
│   ├── Accept / Reject Hero State
│   ├── Reason Detail
│   └── Reset Actions
├── Fallback Screen
│   ├── Token Input
│   ├── Paste Action
│   └── Validate Action
├── Settings Screen
│   ├── Event Context
│   ├── Sync Metadata
│   └── Dangerous Actions Section
└── Export Screen
    ├── Log Summary
    ├── Export Action
    └── Upload Action
```

---

# 8. Exact UI Feedback Loops for Critical States

## 8.1 Camera Permissions

### Enrollment App
- explain before request,
- request once user explicitly continues,
- if denied, show retry path,
- if permanently denied, show Settings path,
- block capture until granted.

### Gate App
- explain operational necessity,
- block scan route if denied,
- keep manual fallback reachable when possible,
- include Settings button for permanent denial.

---

## 8.2 Active Liveness Prompts

### Liveness UX requirements
- one clear prompt at a time,
- prompt must be short and action-based,
- tracking state must always be visible,
- prompt resets if face leaves frame,
- success must transition immediately into matching,
- failure must transition immediately into reject.

### Liveness prompt structure
- title: challenge instruction,
- subtext: tracking guidance,
- visual status: tracked / lost,
- time indicator,
- completion acknowledgment.

---

## 8.3 Cryptographic Processing States

These operations must never be invisible to the user.

### Enrollment App required visible states
- checking event,
- preparing face,
- generating secure template,
- encrypting pass data,
- requesting secure signature,
- finalizing pass,
- failed, with retry path.

### Gate App required visible states
- reading token,
- verifying signature,
- checking validity,
- checking replay/revocation,
- decrypting template,
- running liveness,
- generating live template,
- comparing match,
- recording result.

The UI should never just show a generic spinner for the entire chain unless the specific step is also labeled.

---

# 9. Visual Tone and Interaction Style

## 9.1 Web Dashboard Tone
The web dashboard should feel:
- administrative,
- trustworthy,
- technically serious,
- uncluttered.

It should not feel playful or consumer-social. It is an organizer control surface.

## 9.2 Enrollment App Tone
The enrollment app should feel:
- calm,
- reassuring,
- privacy-first,
- guided.

It should not feel like a surveillance product. The language must emphasize secure pass creation rather than generic face recognition.

## 9.3 Gate App Tone
The gate app should feel:
- operational,
- fast,
- clear,
- decisive.

This is a checkpoint tool, so ambiguity is worse than simplicity.

---

# 10. Accessibility and Readability Requirements

## 10.1 General Requirements
Across all surfaces:
- use high-contrast text,
- ensure large tap targets,
- avoid low-contrast status indicators,
- do not rely only on color to communicate state,
- combine icons, labels, and color where appropriate.

## 10.2 Gate-Specific Requirements
Because the gate can be used in noisy or bright environments:
- result screens must use very large text,
- accept/reject must be readable at a glance,
- reason codes should map to plain operator language,
- countdowns and prompts must be visible from arm’s length.

---

# 11. Final UI/UX Blueprint Summary

The complete frontend system should be structured as follows:

- **Web Dashboard**
  - Tailwind CSS for layout and styling
  - `shadcn/ui` for every core interface element
  - pages for login, dashboard, event creation, event detail, and logs

- **Enrollment App**
  - React Native `StyleSheet` for all styling
  - guided step-by-step flow from join code to QR pass
  - explicit privacy communication
  - explicit feedback for permissions, capture quality, and cryptographic processing

- **Gate App**
  - React Native `StyleSheet` for all styling
  - operations-first flow from provisioning to scan to result
  - explicit feedback for camera permissions, token verification, liveness, and cryptographic states
  - highly legible accept/reject decisions

This blueprint ensures that the UI layer supports the core technical claim of the system: that privacy-preserving biometric entry must not only be secure in architecture, but also understandable, trustworthy, and operationally robust in the user experience.

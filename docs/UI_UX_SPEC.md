# Focaccia UI And State Specification

`docs/DESIGN.md` is the visual source of truth. This document maps implemented routes and states to user tasks.

## Public Ticket App

| Route | Task | Required states |
| --- | --- | --- |
| `/` | Browse listed events | loading, empty, network error, event cards |
| `/events/[eventId]` | Review and claim ticket | active types, GBP price, remaining capacity, sold out, paid unavailable, auth requirement, capacity race |
| `/signup`, `/login` | Attendee Auth | validation, loading, failure, session persistence |
| `/confirmation/[ticketId]` | Checkout result | claim code, claimed state, enrollment next step |
| `/tickets` | Cross-device recovery | loading, empty, all ticket states |
| `/tickets/[ticketId]` | Ticket detail/cancel | status, code, cancellation rules, terminal state |
| `/privacy` | Explain processing/retention | central-data boundary, retention, offline revocation limitation |

Checkout confirms trusted profile identity, shows a real GBP 0 total, disables repeat submission, and uses an idempotency key.

## Organizer Dashboard

| Route | Task |
| --- | --- |
| `/login` | Sign in and invoke allowlisted organizer onboarding |
| `/dashboard` | Search/filter owned events and review counts/gate state |
| `/events/new` | Create event plus General Admission |
| `/events/[eventId]` | Ticket table, counts, activity, type management, CSV |
| `/events/[eventId]/edit` | Edit details, dates, capacity, listed state |
| `/events/[eventId]/provisioning` | Provision one gate and display public context |
| `/events/[eventId]/revocations` | Review revoked passes |
| `/events/[eventId]/logs` | Review organizer/ticket/check-in activity |

Destructive reset, revoke, and delete actions require confirmation. Ownership is enforced server-side.

## Enrollment App

| Screen | Task/states |
| --- | --- |
| `index` | signup/login, validation, network/auth failure |
| `tickets` | FlatList of owned tickets, refresh, all statuses, claim-code selection, switch/logout |
| `ticket` | status, generation allowance, issue/regenerate/reset recovery |
| `consent` | explicit privacy/camera consent |
| `capture` | permission, capture, processing, network/issuance failure |
| `pass` | secure QR display and pass details |
| `help` | ownership, prepared-device, and recovery guidance |

Claim code never replaces sign-in. Prepared-device switching can clear current-user local pass/pending data.

## Gate App

| Screen | Task/states |
| --- | --- |
| `index` | provisioned/unprovisioned status, cache age, queue counts, opening readiness |
| `provision` | organizer Auth, event/device fields, key creation/provision failure |
| `settings` | refresh revocations, sync status, retry, sign-out/config context |
| `scan` | offline QR scan and no-refresh blocking state |
| `fallback` | typed/paste signed token fallback |
| `liveness` | active challenge, timeout/failure |
| `result` | clear ACCEPT/REJECT reason and next action |
| `export` | local non-biometric CSV evidence |

Gate copy must state that remote revocations cannot affect a disconnected gate until refresh.

## Accessibility And Interaction

- plain English and visible keyboard focus
- skip navigation on web
- labelled fields/controls and live status feedback
- minimum practical touch targets and safe-area handling
- reduced-motion support
- responsive layouts without task-blocking overflow
- mobile event tables use named, focusable horizontal regions with swipe instructions
- no decorative motion or visual effect may delay checkout, enrollment, or gate decisions

## Visual System

Use the warm Focaccia canvas, ink, warm-mist, terracotta, spacing, radius, typography, and surface hierarchy in `DESIGN.md`. Do not reintroduce generic glass, neon, dark-only, or particle-driven application surfaces.

# Focaccia Design Reference Audit

Date accessed: 2026-07-13

This audit uses current official product, developer, support, and marketing material. It is a pattern study, not a request to reproduce another product. Third-party screenshots and captures belong only in ignored local QA evidence; no third-party logo, asset, illustration, icon, screenshot, interface copy, or near-identical layout may enter production or Git history.

## Reference register

| ID | Company | Official source | Focaccia app | Pattern to borrow | Pattern to avoid | Translation | Source type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O1 | Ramp | [Expense management](https://ramp.com/expense-management/) | web | A concise readiness summary followed by exception-led work | Promotional statistics and finance-specific metaphors | Put active/upcoming events and action-required conditions before secondary history | Marketing presentation with product screens |
| O2 | Ramp | [Spend management overview](https://support.ramp.com/ramps-spend-management-platform-enhancing-your-companys-expense-control/) | web | Centralized operational overview with accountable actions | Dense policy configuration irrelevant to events | Make event state, gate readiness, capacity, and ownership scannable from one dashboard | Official support screen |
| O3 | Linear | [Features](https://linear.app/features) | web | Quiet navigation, high information density, fast primary actions | Keyboard-centric affordances without visible mobile equivalents | Use compact route tabs, strong current-location cues, and restrained action menus | Marketing presentation with real product screens |
| O4 | Linear | [Display options](https://linear.app/docs/display-options) | web | Filterable views with legible property hierarchy | Excess customization that would create false controls | Keep fixed, useful filters for ticket status, type, event lifecycle, and listing state | Official documentation screen |
| O5 | Stripe | [Payments features and Dashboard](https://stripe.com/payments/features) | web | Record detail, activity context, status, export, and audit confidence | Fabricated analytics or payment functionality | Present ticket records, signed sync age, activity, and export as traceable operational facts | Marketing presentation with product screens |
| T1 | DICE | [DICE home](https://dice.fm/) | tickets | Events immediately visible with strong artwork and date identity | Recommendation claims and social features Focaccia does not have | Lead with a real catalogue and deterministic event posters, not a marketing hero | Real product web screen |
| T2 | DICE | [Download the app](https://dice.fm/download_the_app) | tickets | Direct event search and low-friction ticket ownership language | Hype copy and app-download promotion | Keep attendee navigation compact: discover, tickets, account | Marketing presentation with product screens |
| T3 | DICE | [Official event page example](https://dice.fm/event/6dxd68-the-unlimited-festival-2026-25th-mar-chamonix-mont-blanc-chamonix-mont-blanc-tickets) | tickets | Event-first hierarchy: identity, time, place, price, then action | Artist imagery and secondary-market features | Build a structured detail page around real event data and a single checkout decision | Real product event screen |
| T4 | Luma | [Event registration process](https://help.luma.com/p/event-registration-process) | tickets | Event information and registration action remain together | Guest-list/social proof not available in Focaccia | Keep ticket selection beside event context and show auth/profile prerequisites inline | Official support screen |
| T5 | Luma | [Event discovery](https://help.luma.com/p/searching-for-events) | tickets | Search and public/private event visibility are explicit | Location personalization and maps not implemented | Explain listed events as the public catalogue; do not imply personalization | Official support screen |
| T6 | Apple Invites | [Apple Invites announcement](https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/) | tickets | Distinct event identity with restrained editorial composition | Photo libraries, weather, maps, guest albums, and copied Apple styling | Generate abstract, deterministic artwork from event identity while keeping data primary | Official marketing presentation with real product screens |
| E1 | Apple | [Wallet overview](https://developer.apple.com/wallet/) | enrollment | Credentials organized as event-specific passes | Suggesting Focaccia passes are Apple Wallet passes | Use a calm credential stack with event name, validity, and status | Official developer product screen |
| E2 | Apple | [Wallet pass lifecycle](https://developer.apple.com/wallet/get-started/) | enrollment | Passes appear when relevant and expose a clear use action | NFC, auto-presentment, location, or update claims not implemented | Surface the current owned pass and a direct route to presentation/help | Official developer product screen |
| E3 | Apple | [Wallet HIG](https://developer.apple.com/design/human-interface-guidelines/wallet) | enrollment | One credential, decisive hierarchy, system-aware legibility | Near-copying Apple pass geometry or system chrome | Use Focaccia clay/ink geometry and explicit event-scoped copy | Official design guidance with product screens |
| E4 | Revolut | [Cards](https://www.revolut.com/en-US/cards/) | enrollment | Card status and security controls are legible at a glance | Premium-card merchandising and financial claims | Show pass readiness, generation, expiry, and recovery as factual states | Marketing presentation with real product screens |
| E5 | Revolut | [Card controls and security](https://www.revolut.com/en-US/cards/mastercard-prepaid-card/) | enrollment | Immediate state feedback and plain recovery actions | Freeze/unfreeze metaphors that misstate pass lifecycle | Translate to enrolled, refresh required, reset, terminal, and device-pass-missing states | Marketing presentation with real product screens |
| E6 | Stripe | [Identity](https://stripe.com/identity) | enrollment | Capture guidance changes with the current task and explains progress | Centralized document/selfie processing and storage claims | Give short local-capture instructions, quality feedback, retry, and explicit on-device privacy copy | Marketing presentation with real capture screens |
| E7 | Stripe | [Identity privacy and consent](https://support.stripe.com/questions/stripe-identity-faq?locale=en-GB) | enrollment | Consent precedes capture and sensitive processing is explained plainly | Stripe retention or centralized biometric language, which does not describe Focaccia | State the exact local processing, temporary-file, encrypted-template, and retention boundary | Official support screen |
| G1 | Square | [Point of Sale](https://squareup.com/us/en/point-of-sale) | gate | Staff can identify readiness and enter the repeated primary task immediately | Sales catalogue, payments, and promotional analytics | Put event, network, revocation freshness, pending sync, and Open scanner in the first viewport | Marketing presentation with product screens |
| G2 | Square | [POS features](https://squareup.com/us/en/point-of-sale/software/pricing) | gate | Operational controls use large targets and unambiguous states | Pricing and feature comparison | Use 56pt primary actions and calm status bands for staff operation | Marketing presentation with product screens |
| G3 | Shopify | [Shopify POS](https://www.shopify.com/pos) | gate | Device readiness, staff operation, and continuity are explicit | Inventory, customer, and commerce surfaces | Make provisioning, offline mode, cache age, and sync state visible without technical clutter | Marketing presentation with product screens |
| G4 | Shopify | [POS software](https://www.shopify.com/pos/pos-software) | gate | Fast repeated workflows and reliable navigation | Custom app grid and sales actions | Keep the gate route set small and task-oriented: home, scan, settings, export | Marketing presentation with product screens |
| G5 | Eventbrite | [Organizer check-in app](https://www.eventbrite.com/organizer/features/organizer-check-in-app/) | gate | Scan is a first-class action with real-time attendance context | Payments and online-only check-in assumptions | Make scan dominant while explaining that decisions remain local and sync can be pending | Marketing presentation with real product screens |
| G6 | Eventbrite | [Check in attendees](https://www.eventbrite.com/help/en-us/articles/741083/) | gate | Manual fallback and scanner guidance have visible operator paths | Treating QR validity alone as entry approval | Keep fallback visible but preserve signature, replay, revocation, liveness, and face checks | Official support screen |
| G7 | UK Border Force | [Getting through the UK border faster](https://www.gov.uk/government/publications/getting-through-the-uk-border-faster) | gate | Distant-readable instructions and a decisive final state | Implying government-grade biometric assurance | Use one instruction at a time and unmistakable accepted/rejected compositions with practical next steps | Official government guidance |

## Required capture set

The local reference-capture target is `.focaccia/reference-audit/` and must remain ignored. The set contains distinct viewport captures of the source sections above:

- Organizer: O1 and O2 Ramp screens; O3 and O4 Linear screens; O5 Stripe record/activity screen.
- Ticketing: T1, T2, and T3 DICE screens; T4 and T5 Luma screens; T6 Apple Invites screen.
- Enrollment: E1, E2, and E3 Wallet screens; E4 and E5 Revolut screens; E6 and E7 Stripe Identity screens.
- Gate: G1 and G2 Square screens; G3 and G4 Shopify screens; G5 and G6 Eventbrite screens; G7 is an additional environmental reference.

Captures are research evidence only. They are not production assets and are not a licence to copy the source.

## Reference-to-screen mapping

| Focaccia screen | Primary pattern | Secondary pattern | Intentional translation |
| --- | --- | --- | --- |
| Organizer public overview | Ramp restraint | Stripe trust language | Accurate, short system explanation with a direct organizer action and no false privacy claim |
| Organizer login | Stripe account entry | Linear quiet chrome | Minimal email/password entry with network-aware error copy and no social-login theatre |
| Organizer dashboard | Ramp operational hierarchy | Stripe status records | Active/upcoming events, readiness, exceptions, and capacity before secondary history |
| Organizer event workspace | Ramp detail workspace | Linear route tabs | Compact event-level operations, status context, filters, audit, and explicit destructive confirmation |
| Organizer create/edit | Linear focused dialog/form | Stripe field discipline | Grouped event identity, schedule, capacity, listing, validation, and paid-ticket warning |
| Organizer provisioning | Shopify device readiness | Stripe sensitive detail | Explain the QR contract, show provisioned state, and progressively disclose public technical values |
| Organizer logs/revocations | Stripe records | Linear filtering | Dense, legible audit rows with statuses and no decorative dashboard cards |
| Ticket catalogue | DICE discovery | Apple Invites identity | Real events above the fold with deterministic abstract posters and calm filtering/navigation |
| Ticket event detail | Luma event hierarchy | DICE booking action | Event facts and ticket options lead to one clear free-ticket action |
| Ticket authentication/profile | Stripe form clarity | Linear restraint | Fast prerequisites with inline errors and a preserved safe return destination |
| Ticket confirmation | DICE ownership | Apple Wallet relevance | A factual confirmation, real claim code, and next-step path to enrollment |
| My tickets/detail | Apple Wallet credential hierarchy | DICE ticket library | State-led ticket rows, event context, recovery, and confirmed cancellation |
| Enrollment authentication | Revolut account entry | Apple native behaviour | Calm identity entry with explicit prepared-device account separation |
| Enrollment wallet | Apple Wallet stack | Revolut state surfaces | Owned event credentials with current status, validity, and one next action |
| Enrollment ticket detail | Wallet pass detail | Revolut recovery | Explain pass generation, terminal/reset states, and enrollment/recovery without exposing crypto |
| Enrollment consent | Stripe Identity consent | Apple native grouping | Plain-English local-processing and temporary-file disclosure before capture |
| Enrollment capture | Stripe Identity guidance | Apple camera behaviour | One instruction at a time, unobscured camera, permission/model/network/retry states |
| Enrollment pass | Apple Wallet relevance | Revolut status | Event-scoped pass presentation with expiry, generation, and explicit gate next step |
| Gate home | Square readiness | Shopify device status | Immediate event/cache/network/sync checklist and dominant scanner action |
| Gate provisioning | Shopify setup | Square task clarity | Scan/paste provisioning with progress, errors, and safe public metadata review |
| Gate scanner/fallback | Eventbrite scan | Square repeated action | Full-bleed scanning, visible offline readiness, accessible manual fallback |
| Gate liveness | eGate instructions | Stripe capture guidance | One calm instruction, live progress, no decorative motion, and safe cancellation |
| Gate result | eGate decision | Square repeat workflow | Large accepted/rejected state visible at distance with the next operator action |
| Gate settings/export | Shopify settings | Stripe records | Restrained operational facts, cache/sync controls, and non-biometric evidence export |

## Decisions carried into implementation

- The visual thesis is **warm civic utility**: paper-warm neutrals, near-black text, clay accent, purposeful geometry, restrained depth, and status color only when state matters.
- Product interfaces lead with real work, not marketing heroes or fabricated metrics.
- Event artwork is generated deterministically from event data; no stock photography or reference-product imagery is shipped.
- Technical identifiers and cryptographic values remain available where operationally required but are visually secondary and progressively disclosed.
- Repeated operational interactions target 120–220 ms transform/opacity feedback and respect reduced motion.

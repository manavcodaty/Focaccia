# Focaccia Updated Architecture Diagrams

## Scope

This document visualizes the implemented architecture in this repository. It covers the four user-facing
applications, shared code, Supabase services, local and tunnel deployment modes,
ticket and pass lifecycles, cryptographic trust boundaries, offline gate
verification, signed synchronization, privacy constraints, and operational
verification.

The code paths shown are implemented. Local browser/network and simulator paths
are verified. zrok, Vercel, EAS project linkage, TestFlight, and audience-owned
iPhone distribution are not currently configured and are not deployment claims.

## 1. End-To-End System Architecture

```mermaid
flowchart LR
  classDef actor fill:#fff7ed,stroke:#c2410c,color:#431407
  classDef app fill:#eff6ff,stroke:#1d4ed8,color:#172554
  classDef backend fill:#ecfdf5,stroke:#047857,color:#022c22
  classDef data fill:#f5f3ff,stroke:#6d28d9,color:#2e1065
  classDef secure fill:#fef2f2,stroke:#b91c1c,color:#450a0a
  classDef shared fill:#f8fafc,stroke:#475569,color:#0f172a
  classDef external fill:#fefce8,stroke:#a16207,color:#422006

  organizer["Organizer"]:::actor
  attendee["Attendee"]:::actor
  doorStaff["Door staff"]:::actor

  subgraph clients["Client applications"]
    direction TB
    web["apps/web<br/>Next.js organizer dashboard<br/>Role and event ownership enforced"]:::app
    tickets["apps/tickets<br/>Next.js public ticket application<br/>Browse, auth, free checkout, My Tickets"]:::app
    enrollment["apps/enrollment<br/>Expo iOS attendee application<br/>Consent, local face processing, pass wallet"]:::app
    gate["apps/gate<br/>Expo iOS gate verifier<br/>Offline decision and durable sync queue"]:::secure
  end

  subgraph sharedCode["Shared deterministic package"]
    shared["packages/shared<br/>Typed network config<br/>Canonical JSON and base64url<br/>Ticket state and reason codes<br/>Cancelable template V1<br/>Ed25519, X25519 and Hamming helpers"]:::shared
  end

  subgraph api["Supabase API and policy boundary"]
    direction TB
    auth["Supabase Auth<br/>Email/password<br/>Authenticated user identity"]:::backend
    edge["Edge Functions<br/>Strict schemas and response envelopes<br/>Role and ownership checks<br/>Rate limits and idempotency"]:::backend
    realtime["Supabase Realtime<br/>Organizer dashboard updates"]:::backend
  end

  subgraph operations["Server operations"]
    direction TB
    publicOps["Public catalogue<br/>get-public-events<br/>get-public-event"]:::backend
    attendeeOps["Attendee operations<br/>ensure-attendee<br/>claim-free-ticket<br/>cancel-ticket<br/>list-my-tickets<br/>get-enrollment-bundle<br/>issue-pass"]:::backend
    organizerOps["Organizer operations<br/>ensure-organizer<br/>create/update/delete event<br/>manage ticket types<br/>summaries and CSV<br/>reset or revoke ticket"]:::backend
    gateOps["Gate operations<br/>provision-gate<br/>get-gate-revocations<br/>record-gate-checkin"]:::backend
  end

  subgraph postgres["PostgreSQL with RLS and transactional RPCs"]
    direction TB
    identityData[("Profiles and ownership<br/>organizer_profiles<br/>attendee_profiles<br/>events")]:::data
    ticketData[("Ticketing<br/>event_ticket_types<br/>event_tickets<br/>event_passes")]:::data
    auditData[("Audit and safeguards<br/>ticket_activity_log<br/>organizer_activity_log<br/>idempotency_records<br/>api_rate_limits")]:::data
    gateData[("Gate state<br/>gate_devices<br/>revocations<br/>gate_sync_nonces<br/>gate_checkins")]:::data
    secretData[("Encrypted event secrets<br/>edge_event_secrets<br/>Event signing private keys")]:::secure
  end

  subgraph serverSecrets["Server runtime secret boundary"]
    runtimeSecrets["Environment and generated function secrets<br/>Service role and wrapping key<br/>Organizer email allowlist<br/>Claim-code pepper and recovery key"]:::secure
  end

  subgraph offlineGate["Gate device security boundary"]
    direction TB
    secureStore["iOS SecureStore<br/>X25519 gate private key<br/>Ed25519 sync private key<br/>This device only"]:::secure
    sqlite[("Local SQLite<br/>Used-pass replay set<br/>Revocation snapshot and age<br/>Non-biometric decision log<br/>Signed pending sync queue")]:::secure
    verifier["Offline verification pipeline<br/>Token shape and event binding<br/>Ed25519 server signature<br/>Time window and revocation<br/>Atomic replay marking<br/>X25519 template decryption<br/>Active liveness and local face match"]:::secure
  end

  organizer -->|"Administers owned events"| web
  attendee -->|"Discovers and claims ticket"| tickets
  attendee -->|"Enrolls and presents pass"| enrollment
  doorStaff -->|"Scans attendee pass"| gate

  web --> auth
  tickets --> auth
  enrollment --> auth
  web --> edge
  tickets --> edge
  enrollment --> edge
  gate -->|"Signed device requests when online"| edge

  web -.-> shared
  tickets -.-> shared
  enrollment -.-> shared
  gate -.-> shared
  edge -.-> shared

  edge --> publicOps
  edge --> attendeeOps
  edge --> organizerOps
  edge --> gateOps

  publicOps --> identityData
  publicOps --> ticketData
  attendeeOps --> identityData
  attendeeOps --> ticketData
  attendeeOps --> auditData
  attendeeOps --> secretData
  attendeeOps --> runtimeSecrets
  organizerOps --> identityData
  organizerOps --> ticketData
  organizerOps --> auditData
  organizerOps --> gateData
  organizerOps --> secretData
  organizerOps --> runtimeSecrets
  gateOps --> gateData
  gateOps --> ticketData

  gateData --> realtime
  ticketData --> realtime
  realtime --> web

  gate --> secureStore
  gate --> sqlite
  gate --> verifier
  secureStore --> verifier
  sqlite --> verifier
  verifier -->|"ACCEPT or REJECT without network"| gate
  sqlite -->|"Signed queued check-ins"| gateOps
  gateOps -->|"Versioned revocation snapshot"| sqlite

  enrollment -->|"Signed QR pass containing encrypted template"| attendee
  attendee -->|"QR presentation only"| gate
```

### Architectural invariants

- The organizer dashboard, public ticket site, enrollment app, and gate app are
  separate applications with separate roles and responsibilities.
- Authentication does not grant organizer authority. `ensure-organizer` checks
  the server-only allowlist, and every organizer mutation checks event ownership.
- Ticket checkout and pass issuance require an authenticated attendee and
  server-derived ownership. A claim code never transfers ownership.
- The database serializes final-seat checkout and enforces four active tickets
  per attendee per event, ticket capacities, legal state transitions, and a
  maximum of three pass generations per reset cycle.
- Raw face images, embeddings, decrypted templates, and reusable biometrics do
  not enter Supabase, browser applications, logs, check-in payloads, or the sync
  queue.
- The gate makes the complete entry decision offline. Connectivity is used only
  to refresh revocations and synchronize already-completed decisions.

## 2. Local And Tunnel Deployment Topology

```mermaid
flowchart TB
  classDef device fill:#eff6ff,stroke:#1d4ed8,color:#172554
  classDef host fill:#ecfdf5,stroke:#047857,color:#022c22
  classDef boundary fill:#fff7ed,stroke:#c2410c,color:#431407
  classDef external fill:#fefce8,stroke:#a16207,color:#422006
  classDef blocked fill:#fef2f2,stroke:#b91c1c,color:#450a0a

  subgraph devices["Physical devices"]
    phoneBrowser["Phone browser<br/>Public tickets or organizer web"]:::device
    enrollmentPhone["Enrollment iPhone<br/>Local or tunnel build profile"]:::device
    gatePhone["Prepared gate iPhone<br/>Offline decisions continue if network fails"]:::device
  end

  subgraph localMode["FOCACCIA_NETWORK_MODE=local"]
    direction TB
    lan["Same trusted Wi-Fi / LAN<br/>Stable Mac private IPv4"]:::boundary
    localWeb["apps/web<br/>0.0.0.0:3000"]:::host
    localTickets["apps/tickets<br/>0.0.0.0:3001"]:::host
    proxy["Repository-owned constrained proxy<br/>LAN_IP:54331<br/>Exact CORS origins, 10 MiB limit<br/>HTTP plus Realtime WebSocket"]:::host
    supabaseApi["Host-only Supabase API<br/>127.0.0.1:54321<br/>Auth, REST, Functions, Realtime, Storage"]:::host
    postgresBlocked["PostgreSQL 54322<br/>Studio 54323<br/>Mailpit 54324<br/>Never LAN or public"]:::blocked

    lan --> localWeb
    lan --> localTickets
    lan --> proxy
    proxy --> supabaseApi
    supabaseApi -.-> postgresBlocked
  end

  subgraph tunnelMode["FOCACCIA_NETWORK_MODE=tunnel"]
    direction TB
    internet["Public HTTPS"]:::boundary
    vercel["Optional Vercel deployment<br/>apps/tickets<br/>Not currently linked"]:::external
    zrokWeb["zrok reserved share<br/>Organizer web HTTPS<br/>Not currently configured"]:::external
    zrokApi["zrok reserved share<br/>Constrained Supabase proxy HTTPS<br/>No interstitial or response rewriting<br/>Not currently configured"]:::external
    loopbackWeb["Host web target<br/>127.0.0.1:3000"]:::host
    loopbackProxy["Host proxy target<br/>127.0.0.1:54331"]:::host
    tunnelSupabase["Host-only Supabase API<br/>127.0.0.1:54321"]:::host

    internet --> vercel
    internet --> zrokWeb
    internet --> zrokApi
    zrokWeb --> loopbackWeb
    zrokApi --> loopbackProxy
    loopbackProxy --> tunnelSupabase
  end

  phoneBrowser -->|"Selected mode URL only"| lan
  enrollmentPhone -->|"Selected mode URL only"| lan
  gatePhone -->|"Refresh and sync when LAN is available"| lan

  phoneBrowser -->|"Selected HTTPS URL only"| internet
  enrollmentPhone -->|"Selected HTTPS URL only"| internet
  gatePhone -->|"Refresh and sync when tunnel is available"| internet
```

### Network contract

- Clients select exactly one typed mode. They do not infer, rewrite, or silently
  fall back between hosts.
- Public bundles contain only the selected URLs and Supabase anon key. Service
  role credentials, signing secrets, organizer allowlists, claim-code secrets,
  and gate private keys remain outside public bundles.
- Local acceptance requires a second physical device and all tunnels stopped.
- Tunnel acceptance requires exact HTTPS origins, zrok raw-response checks,
  and matching Auth redirect and CORS lists. The ticket application may use its
  zrok share or a separately configured Vercel deployment.
- A tunnel or LAN outage can delay enrollment, revocation refresh, and check-in
  synchronization, but cannot invalidate an already-provisioned gate's offline
  verification capability.

## 3. Identity, Ticket, Pass, And Check-In Data Model

```mermaid
erDiagram
  AUTH_USER ||--o| ORGANIZER_PROFILE : "may hold"
  AUTH_USER ||--o| ATTENDEE_PROFILE : "may hold"
  AUTH_USER ||--o{ EVENT : "creates as organizer"
  EVENT ||--|{ EVENT_TICKET_TYPE : "offers"
  EVENT ||--o{ EVENT_TICKET : "contains"
  EVENT_TICKET_TYPE ||--o{ EVENT_TICKET : "selected by"
  ATTENDEE_PROFILE ||--o{ EVENT_TICKET : "owns"
  EVENT_TICKET ||--o{ EVENT_PASS : "generates max 3 per cycle"
  EVENT_TICKET ||--o{ TICKET_ACTIVITY_LOG : "audited by"
  EVENT ||--o{ ORGANIZER_ACTIVITY_LOG : "audited by"
  EVENT ||--o| GATE_DEVICE : "has one active"
  EVENT_PASS ||--o{ REVOCATION : "may invalidate"
  GATE_DEVICE ||--o{ GATE_SYNC_NONCE : "prevents replay"
  EVENT_PASS ||--o| GATE_CHECKIN : "accepted once"
  GATE_DEVICE ||--o{ GATE_CHECKIN : "signs"
  AUTH_USER ||--o{ IDEMPOTENCY_RECORD : "scopes user operations"
  GATE_DEVICE ||--o{ IDEMPOTENCY_RECORD : "scopes gate operations"

  EVENT {
    text id PK
    uuid created_by FK
    text name
    text description
    text location
    int capacity
    boolean is_listed
    bytes event_salt
    bytes signing_public_key
  }

  EVENT_TICKET {
    uuid id PK
    text event_id FK
    uuid attendee_user_id FK
    uuid ticket_type_id FK
    text status
    bytes claim_code_digest
    text current_pass_id
    int generation_count
  }

  EVENT_PASS {
    text pass_id PK
    uuid ticket_id FK
    int generation
    text status
    timestamp issued_at
  }

  GATE_DEVICE {
    uuid id PK
    text event_id FK
    bytes x25519_public_key
    bytes ed25519_sync_public_key
    int key_version
    timestamp revoked_at
  }

  GATE_CHECKIN {
    uuid id PK
    text event_id FK
    text pass_id FK
    uuid gate_device_id FK
    timestamp gate_timestamp
    text decision
    text idempotency_key
  }
```

### Lifecycle constraints

```mermaid
stateDiagram-v2
  [*] --> claimed: "Free checkout"
  claimed --> enrolled: "Initial pass generation"
  enrolled --> enrolled: "Regenerate; revoke old pass"
  enrolled --> checked_in: "Valid signed gate ACCEPT sync"
  enrolled --> claimed: "Organizer reset; revoke pass; reset generation cycle"
  claimed --> cancelled: "Attendee cancellation"
  enrolled --> cancelled: "Attendee cancellation and pass revocation"
  claimed --> revoked: "Organizer revocation"
  enrolled --> revoked: "Organizer revocation and pass revocation"
  checked_in --> [*]
  cancelled --> [*]
  revoked --> [*]
```

```mermaid
stateDiagram-v2
  [*] --> active: "Server signs issued pass"
  active --> revoked: "Cancellation, regeneration, reset, or organizer revoke"
  active --> used: "Accepted gate check-in"
  revoked --> [*]
  used --> [*]
```

## 4. Cryptographic And Privacy Architecture

```mermaid
flowchart LR
  classDef server fill:#ecfdf5,stroke:#047857,color:#022c22
  classDef enroll fill:#eff6ff,stroke:#1d4ed8,color:#172554
  classDef gate fill:#fef2f2,stroke:#b91c1c,color:#450a0a
  classDef public fill:#f8fafc,stroke:#475569,color:#0f172a
  classDef forbidden fill:#fff1f2,stroke:#be123c,color:#4c0519

  subgraph serverZone["Trusted server boundary"]
    eventSigningPrivate["Ed25519 event signing private key<br/>Encrypted server-only secret"]:::server
    eventSigningPublic["Ed25519 event signing public key<br/>Event metadata and gate policy"]:::public
    eventSalt["Random event salt<br/>Event-scoped unlinkability"]:::public
    gatePublic["X25519 gate public key<br/>Template encryption"]:::public
    syncPublic["Ed25519 gate sync public key<br/>Device request verification"]:::public
    passSigner["Pass issuance<br/>Verify ticket ownership and generation<br/>Sign canonical payload"]:::server
    syncVerifier["Gate sync verification<br/>Signature, event, key version<br/>nonce, timestamp, idempotency"]:::server
  end

  subgraph enrollmentZone["Attendee enrollment device"]
    camera["Ephemeral face capture"]:::enroll
    embedding["On-device embedding"]:::enroll
    template["Cancelable template V1<br/>Event salt applied"]:::enroll
    sealed["X25519 sealed encrypted template"]:::enroll
    qr["Signed QR pass<br/>Event, pass, validity, encrypted template"]:::public
  end

  subgraph gateZone["Prepared gate device"]
    gatePrivate["X25519 private key<br/>iOS SecureStore, this device only"]:::gate
    syncPrivate["Ed25519 sync private key<br/>iOS SecureStore, this device only"]:::gate
    liveCapture["Fresh active-liveness capture"]:::gate
    liveTemplate["Fresh event-scoped template"]:::gate
    offlineDecision["Offline signature, replay, revocation,<br/>decryption, liveness, Hamming match"]:::gate
    signedSync["Signed non-biometric check-in payload"]:::gate
  end

  forbiddenStore["Never persisted centrally<br/>Raw image<br/>Embedding<br/>Decrypted template<br/>Gate private keys<br/>Full pass token"]:::forbidden

  camera --> embedding --> template
  eventSalt --> template
  gatePublic --> sealed
  template --> sealed
  sealed --> passSigner
  eventSigningPrivate --> passSigner
  passSigner --> qr
  eventSigningPublic --> offlineDecision
  qr --> offlineDecision
  gatePrivate --> offlineDecision
  liveCapture --> liveTemplate
  eventSalt --> liveTemplate
  liveTemplate --> offlineDecision
  offlineDecision --> signedSync
  syncPrivate --> signedSync
  signedSync --> syncVerifier
  syncPublic --> syncVerifier

  camera -.->|"discard"| forbiddenStore
  embedding -.->|"discard"| forbiddenStore
  template -.->|"discard after encryption"| forbiddenStore
```

### Key separation

| Security purpose | Key | Private-key location | Public material |
|---|---|---|---|
| Pass authenticity | Event Ed25519 keypair | Encrypted server-only secret | Gate policy and event metadata |
| Biometric-template confidentiality | Gate X25519 keypair | Gate iOS SecureStore | Backend and enrollment bundle |
| Gate sync authenticity | Gate Ed25519 keypair | Gate iOS SecureStore | `gate_devices` |
| Cross-event unlinkability | Random event salt | Not secret; event-scoped | Enrollment and gate policy |
| Claim-code lookup protection | Server HMAC pepper and recovery key | Server environment only | No public key material |

## 5. Ticket Purchase, Enrollment, And Pass Issuance

```mermaid
sequenceDiagram
  autonumber
  actor A as Attendee
  participant T as Public ticket app
  participant Auth as Supabase Auth
  participant API as Edge Functions
  participant DB as PostgreSQL and RLS
  participant E as Enrollment iOS app
  participant Local as On-device biometric pipeline

  A->>T: Browse listed future events
  T->>API: get-public-events / get-public-event
  API->>DB: Read listed catalogue and advisory capacity
  DB-->>API: Event and active ticket types
  API-->>T: Public event envelope

  A->>T: Sign up or sign in
  T->>Auth: Email/password authentication
  Auth-->>T: User session
  T->>API: ensure-attendee with full name
  API->>DB: Upsert profile using Auth-derived identity and email

  A->>T: Claim free ticket
  T->>API: claim-free-ticket plus UUID idempotency key
  API->>DB: Lock event then ticket type; enforce capacity and uniqueness
  DB-->>API: Claimed ticket and protected claim-code result
  API-->>T: Ticket confirmation and enrollment next step

  A->>E: Sign in with the same account
  E->>Auth: Restore authenticated attendee session
  E->>API: list-my-tickets or owned claim-code lookup
  API->>DB: Verify attendee ownership
  E->>API: get-enrollment-bundle for owned ticket
  API->>DB: Load event public keys, salt, policy, ticket state
  API-->>E: Ticket-bound enrollment bundle

  A->>E: Consent and face capture
  E->>Local: Create embedding and event-scoped cancelable template
  Local->>Local: Encrypt template to gate X25519 public key
  E->>API: issue-pass plus canonical payload and idempotency key
  API->>DB: Verify ownership, state, generation limit, and event binding
  API->>DB: Revoke previous generation when regenerating
  API-->>E: Event Ed25519 signature and pass metadata
  E->>E: Assemble and securely store signed QR pass
  E-->>A: Display generation and remaining allowance
```

## 6. Offline Verification And Signed Deferred Sync

```mermaid
sequenceDiagram
  autonumber
  actor Staff as Door staff
  actor Person as Attendee
  participant Gate as Gate iOS app
  participant Secure as SecureStore
  participant SQLite as Local SQLite
  participant API as Gate Edge Functions
  participant DB as PostgreSQL
  participant Web as Organizer dashboard

  Note over Gate,SQLite: Before doors open while online
  Gate->>Secure: Load X25519 and Ed25519 private keys
  Gate->>API: Signed get-gate-revocations request
  API->>DB: Verify gate key and return versioned snapshot
  API-->>Gate: Revocations, server time, key version
  Gate->>SQLite: Replace cached snapshot and record refresh time
  Gate-->>Staff: Ready only after first snapshot; fresh at 5 minutes or less

  Note over Person,SQLite: Entry decision with networking disabled
  Person->>Gate: Present signed QR pass
  Gate->>Gate: Validate token shape, event, time, and server signature
  Gate->>SQLite: Check cached revocation and used-pass set
  Gate->>Secure: Decrypt template with gate X25519 private key
  Gate->>Person: Perform active liveness and fresh capture
  Gate->>Gate: Create event-scoped live template and compare locally

  alt Valid and matching pass
    Gate->>Secure: Sign canonical check-in payload with sync key
    Gate->>SQLite: Atomic transaction: mark used, log ACCEPT, enqueue signed item
    Gate-->>Staff: ACCEPT
  else Invalid, replayed, revoked, expired, or non-matching
    Gate->>SQLite: Store non-biometric REJECT reason where permitted
    Gate-->>Staff: REJECT with plain-English reason
  end

  Note over Gate,Web: Later when selected network mode is reachable
  loop Durable bounded retry with backoff and jitter
    Gate->>SQLite: Load pending signed check-in
    Gate->>API: record-gate-checkin with original gate time, nonce, idempotency key, signature
    API->>DB: Verify key, signature, event, timestamp, nonce, pass, and state
    DB->>DB: Idempotently create check-in; mark pass used and ticket checked_in
    API-->>Gate: Receipt; duplicate identical receipt is success
    Gate->>SQLite: Mark queue item synchronized
  end
  DB-->>Web: Realtime check-in and summary update
```

### Offline consistency boundary

- The used-pass marker, ACCEPT log, and signed queue item commit atomically before
  the gate displays acceptance.
- Synchronization failure never reverses an offline acceptance.
- A disconnected gate cannot know about a later server-side cancellation or
  revocation. The cached snapshot remains authoritative until the next refresh.
- Cache state is `fresh` through five minutes, `stale` after five minutes, and
  `critical` after thirty minutes or when no snapshot exists. The first snapshot
  is mandatory before scanning; later staleness warns without disabling a
  prepared offline gate.

## 7. Authorization And Trust Boundaries

```mermaid
flowchart TB
  classDef untrusted fill:#fff7ed,stroke:#c2410c,color:#431407
  classDef semi fill:#eff6ff,stroke:#1d4ed8,color:#172554
  classDef trusted fill:#ecfdf5,stroke:#047857,color:#022c22
  classDef gate fill:#fef2f2,stroke:#b91c1c,color:#450a0a

  transport["Untrusted presentation and transport<br/>QR screenshots, copied tokens, browsers, LAN, internet"]:::untrusted
  attendeeZone["Semi-trusted attendee device<br/>Local capture and encryption<br/>Cannot sign passes or choose authoritative identity"]:::semi
  serverZone["Trusted administration boundary<br/>Auth, Edge Functions, RLS, transactional RPCs,<br/>event signing, role and ownership enforcement"]:::trusted
  gateZone["Trusted gate boundary<br/>Private keys, cached policy, replay state,<br/>liveness, biometric match, offline decision"]:::gate

  transport -->|"TLS in tunnel mode; constrained LAN paths locally"| serverZone
  attendeeZone -->|"Authenticated ticket operations and encrypted template"| serverZone
  serverZone -->|"Signed pass and public policy"| attendeeZone
  attendeeZone -->|"Signed QR through untrusted display"| transport
  transport -->|"Presented QR"| gateZone
  serverZone -->|"Public verification material and revocations"| gateZone
  gateZone -->|"Signed non-biometric check-in only"| serverZone
```

| Boundary | Enforcement |
|---|---|
| Public catalogue | Listed, non-deleted events and active ticket types only |
| Attendee API | Supabase user session, server-derived identity, ticket ownership, strict validation |
| Organizer API | User session, server-only allowlist grant, organizer profile, event ownership |
| Database | RLS, constraints, legal transition triggers, row locks, security-definer RPCs |
| Gate provisioning | Owning organizer plus one active gate per event |
| Revocation refresh | Signed gate device request, key version and event binding |
| Check-in sync | Canonical Ed25519 signature, nonce replay defense, timestamp, idempotency, server-side pass resolution |
| Offline QR | Event Ed25519 signature, time, event binding, cached revocation, atomic replay check, liveness and face match |

## 8. Operations, Verification, And Evidence Architecture

```mermaid
flowchart LR
  classDef phase fill:#f8fafc,stroke:#475569,color:#0f172a
  classDef verify fill:#ecfdf5,stroke:#047857,color:#022c22
  classDef evidence fill:#fff7ed,stroke:#c2410c,color:#431407

  config["Typed environment and mode config<br/>Local and tunnel EAS profiles<br/>Exact CORS and Auth redirects"]:::phase
  software["Software verification<br/>Unit, integration, RLS, API,<br/>browser E2E, typecheck, build, coverage"]:::verify
  mobile["Mobile verification<br/>Enrollment and gate simulator<br/>Offline and provisioning regression"]:::verify
  physical["Physical-device acceptance<br/>Second phone local checkout<br/>iPhone enrollment<br/>Prepared offline gate"]:::verify
  tunnel["Tunnel acceptance when configured<br/>zrok raw responses<br/>Optional Vercel tickets<br/>Remote enrollment and queued sync"]:::verify
  security["Security and privacy review<br/>No public secrets<br/>No central biometrics<br/>Role and ownership isolation"]:::verify
  evidence["EPQ evidence pack<br/>Commands and results<br/>Screenshots and CSV<br/>Limitations and TestFlight status<br/>Classroom runbook and recovery"]:::evidence

  config --> software
  config --> mobile
  config --> physical
  config --> tunnel
  software --> security
  mobile --> security
  physical --> security
  tunnel --> security
  security --> evidence
```

Final acceptance must separately prove local mode with all tunnels stopped,
tunnel mode through zrok and optional Vercel ticket hosting, offline gate behavior with networking
disabled, signed queued synchronization after connectivity returns, role
isolation, capacity-race handling, revocation and reset behavior, and truthful
Apple/TestFlight distribution status.

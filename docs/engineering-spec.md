# AA — Known Risks & Open Questions

This section deliberately does **not** pretend that every implementation detail has already been decided.

Some decisions are intentionally deferred until implementation because deciding them now would add false precision.

---

## AA.1 Known Risks

### RISK-01 — Reservation concurrency

Reservation creation is the most correctness-sensitive part of the system.

A naive:

```text
check availability
→ check capacity
→ insert reservation
```

can allow two simultaneous requests to both see available capacity.

**Mitigation**

Use a PostgreSQL transaction with a deterministic lock on the Bookable row before checking and consuming capacity.

This must be covered by integration/concurrency tests.

---

### RISK-02 — Availability complexity

Scheduling systems become complicated very quickly when they introduce:

- recurring schedules,
- exceptions,
- time zones,
- overrides,
- holidays,
- DST,
- slot generation,
- overlapping rules.

**Mitigation**

MVP deliberately uses:

- recurring windows,
- specific windows,
- BLOCK exceptions,
- OVERRIDE exceptions,
- organization timezone,
- continuous availability validation.

No general-purpose scheduling engine.

If future requirements become more complex, the availability engine can evolve independently.

---

### RISK-03 — Payment/reservation race conditions

A payment may arrive at nearly the same time that:

- a reservation expires,
- another reservation consumes the capacity,
- the customer retries payment,
- the provider sends a duplicate webhook.

**Mitigation**

Reservation state remains owned by the Reservation domain.

Payment processing must acquire/check the current reservation state transactionally.

Webhook processing is idempotent.

No payment provider call occurs inside the reservation transaction.

---

### RISK-04 — External media provider dependency

ImageKit is external infrastructure.

It can experience:

- upload failure,
- API failure,
- latency,
- orphaned files,
- unavailable CDN resources.

**Mitigation**

Database stores Bookable image metadata.

ImageKit is behind a media/storage abstraction.

Bookable transactional correctness does not depend on ImageKit availability.

---

### RISK-05 — Tenant isolation bugs

Because all organizations share one database/schema, an incorrectly scoped query could expose another organization's data.

This is a **critical security risk**.

**Mitigation**

Tenant authorization is explicit.

Queries involving organization-owned data must be tenant-scoped.

Cross-tenant access is tested deliberately.

Frontend organization IDs are never treated as authorization.

---

### RISK-06 — Authentication complexity

Cookie-based access/refresh authentication introduces concerns around:

- refresh-token rotation,
- session revocation,
- CSRF,
- CORS,
- token expiry,
- concurrent refreshes.

**Mitigation**

Keep authentication centralized in the Auth module.

Store only hashed refresh tokens.

Use short-lived access tokens.

Use secure HTTP-only cookies.

Test refresh/logout/revocation behavior explicitly.

---

### RISK-07 — Generic Bookable model becoming too generic

The system intentionally avoids:

```text
type = HALL | CAMERA | BOOK | WORKSHOP | ...
```

But there is a risk of eventually creating a vague model that cannot represent meaningful business differences.

**Mitigation**

The MVP defines Bookable behavior through:

- capacity,
- availability,
- reservation duration,
- advance booking,
- cancellation,
- pricing/payment configuration.

If future requirements require fundamentally different behavior, introduce explicit capabilities or domain concepts rather than stuffing everything into generic fields.

---

### RISK-08 — Public traffic

Public Bookable pages may eventually receive much more traffic than organization dashboards because organizations can share their URLs publicly.

**Mitigation**

Keep public reads separate from authenticated operational workflows.

Public Bookable data can be cached later.

Availability remains dynamically authoritative.

Final booking always reaches the transactional backend.

---

### RISK-09 — Hot Bookables

A popular Bookable with capacity constraints could become a contention point because reservation attempts serialize on its Bookable row.

**Mitigation**

Accept this behavior for MVP.

The lock is intentionally scoped to a single Bookable.

Optimize only if actual contention demonstrates a need.

Possible future strategies include more granular locking or PostgreSQL-specific constraints.

---

### RISK-10 — Scheduler reliability

The pending-reservation expiration scheduler may:

- run late,
- restart,
- run twice,
- temporarily fail.

**Mitigation**

Expiration is determined by `expiresAt`, not by the scheduler's exact execution time.

The job is idempotent.

It can safely be rerun.

---

### RISK-11 — Timezone/DST edge cases

Recurring availability around daylight-saving transitions can create surprising local-time behavior.

Nigeria currently has no DST, but the architecture should not hard-code that assumption because organizations could eventually operate elsewhere.

**Mitigation**

Organization timezone is explicit.

Recurring schedule configuration uses local organization time.

Reservation timestamps are stored as actual instants.

Timezone boundary tests are included.

---

### RISK-12 — Scope creep

The platform could easily grow into:

- marketplace/discovery,
- custom domains,
- subscriptions,
- analytics,
- notifications,
- staff permissions,
- coupons,
- recurring reservations,
- waitlists,
- calendar integrations,
- multiple payment providers,
- advanced scheduling.

**Mitigation**

The MVP boundary is explicit.

Features outside MVP are not implemented unless deliberately promoted into scope.

---

# AA.2 Open Questions

These are deliberately left open because they are implementation/detail decisions rather than unresolved product direction.

---

### OQ-01 — Payment provider

**Status:** Open.

The architecture supports a provider adapter.

The exact provider will be selected before Phase 9.

Selection criteria:

- Nigeria availability,
- supported currencies,
- API quality,
- webhook reliability,
- developer experience,
- transaction fees,
- test/sandbox environment.

---

### OQ-02 — Exact duration representation

**Status:** Open implementation detail.

Recommended representation:

```text
duration → integer seconds
```

rather than database intervals.

This keeps validation and Prisma handling straightforward.

Final representation should be confirmed during the Prisma phase.

---

### OQ-03 — PostgreSQL time-only representation

Recurring availability needs values such as:

```text
09:00
17:00
```

The exact Prisma/PostgreSQL representation should be finalized during the database phase.

It should preserve the distinction between:

- local recurring time,
- actual timestamp.

---

### OQ-04 — Bookable primary image

Two reasonable options exist:

```text
sortOrder = 0
```

or an explicit:

```text
isPrimary
```

The implementation should choose one consistent approach.

Avoid maintaining two competing sources of truth.

---

### OQ-05 — Idempotency response storage

The conceptual `IdempotencyRecord` stores enough information to replay a previous result.

The exact representation of:

```text
response
```

will be decided during implementation.

It may use JSON/JSONB depending on the final API/error architecture.

---

### OQ-06 — Refresh-token rotation details

The overall decision is fixed:

> Short-lived access tokens + rotating refresh tokens stored through secure HTTP-only cookies.

The exact rotation/reuse-detection mechanism will be finalized during the authentication phase.

---

### OQ-07 — ImageKit upload mechanism

The architecture is fixed:

```text
Frontend
→ NestJS authorization
→ ImageKit
→ NestJS records metadata
```

The exact ImageKit upload/signature mechanism will be chosen during Phase 10 based on the current SDK/API.

---

### OQ-08 — Exact payment amount model

The MVP supports paid Bookables, but the exact pricing model needs one final implementation decision.

Possible initial model:

```text
Bookable
price
currency
```

with reservation amount derived from the Bookable and reservation quantity/duration according to the defined pricing rule.

**Important:** pricing must be server-authoritative.

If we don't need sophisticated dynamic pricing, don't introduce it.

---

### OQ-09 — Payment pricing semantics

Before Phase 9, confirm whether MVP pricing is:

- fixed per reservation,
- per time unit,
- per quantity,
- or a deliberately limited combination.

Do not build a generic pricing engine unless an actual requirement justifies it.

---

### OQ-10 — Organization member invitation

The MVP includes organization membership management.

The exact invitation mechanism is open because email/SMS notifications are currently out of scope.

A simple MVP could allow an OWNER to add an existing user by email.

A full invitation-token/email workflow can be introduced later if needed.

---

### OQ-11 — Reservation expiration duration

The exact default pending duration is not yet fixed.

For example:

```text
15 minutes
30 minutes
```

The value should be selected when payment/reservation behavior is implemented.

The important invariant is that `expiresAt` is authoritative.

---

### OQ-12 — Access-code generation format

The exact format of generated codes remains an implementation decision.

Requirements:

- sufficiently unpredictable,
- easy enough to communicate,
- rate-limitable,
- hashable,
- never stored plaintext.

---

### OQ-13 — Notification system

Email/SMS notifications are intentionally deferred.

Future notifications may include:

- reservation confirmation,
- cancellation,
- payment receipt,
- reminder,
- access code delivery.

The system should avoid making MVP booking correctness depend on notifications.

---

### OQ-14 — Recurring reservations

Recurring reservations are explicitly **not MVP**.

If later introduced, they should be treated as a deliberate domain feature rather than implemented by silently creating a bunch of unrelated reservations.

---

### OQ-15 — Calendar integrations

Google Calendar, Outlook, iCal, etc. are not MVP.

If introduced later, integration should consume reservation data rather than become the source of truth for booking capacity.

---

### OQ-16 — Custom domains

Custom organization domains are not MVP.

Public URLs remain platform-controlled:

```text
/book/:slug
```

---

### OQ-17 — Granular permissions

MVP uses:

```text
OWNER
MEMBER
```

with broad operational permissions.

More granular permissions such as:

```text
ADMIN
STAFF
VIEWER
```

are deferred until actual requirements justify them.

---

### OQ-18 — Advanced availability

The MVP does not support a complex precedence system between multiple overlapping schedules/exceptions.

If requirements later demand:

- holidays,
- seasonal schedules,
- priority rules,
- nested overrides,
- blackout calendars,

the availability model should be reconsidered deliberately.

---

# AA.3 Explicitly Deferred Features

The following are **Not Now**, rather than accidental omissions:

```text
Marketplace/discovery
Organization public storefront
Custom domains
Subdomains
Guest booking
Recurring reservations
Waitlists
Coupons
Subscriptions
Advanced analytics
Email notifications
SMS notifications
Calendar integrations
Multiple payment providers
Advanced RBAC
Complex scheduling precedence
Microservices
Redis-based distributed locking
Message queues
Kafka/event bus
Transactional outbox
Kubernetes
```

These may become future versions, but they are not allowed to silently enter MVP implementation.

---

# AA.4 Conditions for Changing a Locked Decision

An AI or developer must **not silently change** a locked architectural decision.

If implementation reveals that a decision genuinely cannot work, the process is:

```text
Identify problem
→ explain why current decision fails
→ propose alternatives
→ evaluate trade-offs
→ update TDR/spec
→ obtain deliberate approval
→ implement changed design
```

For example, the AI must not decide:

> "Redis would be better, so I added Redis."

Instead it should report:

> "The current PostgreSQL locking strategy has become insufficient because X. Here are the alternatives and their trade-offs."

This keeps the project architecturally coherent.

---

# AA.5 Final Project Principle

The project should optimize for:

**Correctness → Security → Understandability → Maintainability → Simplicity → Performance**

—not:

**Maximum technologies → Maximum abstractions → Maximum architecture.**

If a simpler design satisfies the requirements, the simpler design wins.

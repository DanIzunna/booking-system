# AI Build Guide

## 1. Purpose

This document defines how the AI must work when implementing the project described in `engineering-spec.md`.

The AI is acting as an engineering implementation partner, not as an autonomous product architect.

The AI must implement the approved engineering specification faithfully while identifying genuine technical problems when they arise.

The AI must not silently change product requirements, architecture, domain rules, security boundaries, or major technology decisions.

---

# 2. Source of Truth

The primary source of truth is:

```text
docs/engineering-spec.md
```

The engineering specification contains the approved decisions for:

- product scope
- actors
- use cases
- requirements
- business rules
- domain modelImplement **Frontend Phase 1 (F1): Authentication UI + Session State + Initial Application Shell** for the booking-system project.

Project root:

`C:\Users\Frost❄\Desktop\booking-system`

Read these files first before making changes:

- `docs/engineering-spec.md`
- `docs/ai-build-guide.md`
- `docs/phases/phase-02-authentication.md`
- `frontend/lib/api/client.ts`
- `frontend/lib/api/auth.ts`
- `frontend/lib/auth/session.ts`
- `frontend/types/auth.ts`
- `frontend/app/layout.tsx`
- `frontend/app/globals.css`

The backend authentication system is already implemented and tested.

Backend auth endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

The frontend API client already provides:

- `credentials: "include"`
- in-memory access-token storage
- Bearer Authorization
- automatic one-shot 401 refresh
- concurrency-safe refresh coordination
- normalized `ApiError`
- no persistent access-token storage

Do NOT redesign that infrastructure unless you discover a concrete correctness issue.

Do NOT modify the backend.

Do NOT install packages.

Do NOT commit anything.

---

# F1 goals

Implement:

1. Login page
2. Registration page
3. Minimal client-side session state
4. Session initialization using the refresh cookie + `/auth/me`
5. Protected dashboard placeholder
6. Basic authenticated application shell
7. Logout flow

Do not implement organizations, bookables, availability, reservations, payments, or admin functionality yet.

---

# 1. Session state

Create a small React session provider/hook.

The provider should expose something conceptually like:

```ts
{
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthenticatedUser | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}
```

Keep this deliberately small.

Important architecture:

- The React provider is NOT the access-token store.
- `frontend/lib/auth/session.ts` remains the source of truth for the in-memory access token.
- Never put the access token in React state just for storage.
- Never put the refresh token in React state.
- Never use localStorage/sessionStorage for authentication.
- The refresh token remains browser-managed through the HTTP-only cookie.

---

# 2. Session initialization

When the provider mounts in the browser:

1. Start in `loading`.
2. Attempt to establish the authenticated session.
3. Use the existing auth API functions.
4. The refresh cookie should allow the backend to issue a new access token when necessary.
5. Once authenticated, obtain the current user.
6. Set the provider to `authenticated`.
7. If authentication cannot be established, clear the in-memory access token and set `unauthenticated`.

Avoid unnecessary duplicate refresh requests.

Do not make the low-level API client responsible for redirects.

The provider/higher-level UI may decide where an unauthenticated user should go.

Be careful about React development Strict Mode causing effects to run more than once. Do not introduce a refresh loop.

---

# 3. Login

Create:

`frontend/app/login/page.tsx`

Requirements:

- email
- password
- submit button
- loading state
- useful API error display
- accessible labels
- disabled submit while submitting
- link to registration
- restrained visual design consistent with the existing landing page

On success:

1. call `login()`
2. update the session provider/user state
3. navigate to `/dashboard`

Do not manually manipulate tokens in the page.

Do not duplicate authentication logic that belongs in `auth.ts` or the session provider.

---

# 4. Registration

Create:

`frontend/app/register/page.tsx`

Fields:

- name
- email
- password

Requirements:

- accessible labels
- loading state
- API error display
- link to login
- consistent styling

On success:

1. call `register()`
2. update the session state
3. navigate to `/dashboard`

Do not add email verification, password reset, social login, MFA, or other functionality.

---

# 5. Protected dashboard

Create:

`frontend/app/dashboard/page.tsx`

This is only an authenticated placeholder at this stage.

It should:

- consume the session provider
- show a loading state while authentication is being established
- redirect unauthenticated users to `/login`
- display the authenticated user's name/email
- display their platform role
- provide a logout action

Do not build dashboard statistics, organization management, booking management, etc. yet.

---

# 6. Application shell

Create a small reusable authenticated shell/navigation component only if useful.

For example:

```text
Dashboard
Account
Sign out
```

Keep it intentionally minimal.

Do not build the complete future navigation tree.

Do not add links to routes that do not exist yet except where there is a clear placeholder purpose.

---

# 7. Root landing page

Update the existing root page only if necessary.

The current landing page already has:

- `/login`
- `/book/demo`

Keep the existing visual direction.

Do NOT build `/book/demo` during F1.

Do not turn the landing page into a marketing website.

---

# 8. Client/server boundaries

Be deliberate about Next.js App Router boundaries.

Pages that require browser interaction/session state should be client components where necessary.

Do not mark the entire application or `layout.tsx` as `"use client"` merely for convenience.

Keep static/server-renderable components as Server Components whenever possible.

---

# 9. Error handling

Use the existing `ApiError`.

Do not expose raw stack traces or internal backend details.

For validation errors, display useful human-readable messages.

Do not swallow errors silently.

---

# 10. Styling

Continue using the existing:

- global CSS
- CSS Modules

Do NOT add Tailwind.
Do NOT add a UI component library.
Do NOT add a state-management library.

Keep the UI responsive and restrained.

Do not spend excessive time polishing visual details at this phase.

---

# 11. Scope restrictions

Do NOT implement:

- organizations
- organization memberships
- bookables
- availability
- reservations
- payments
- platform-admin UI
- public booking
- account management beyond what is required for the session
- password reset
- email verification
- OAuth/social login
- persistent token storage
- Redux/Zustand
- middleware-based authorization unless you can demonstrate it is necessary for this phase

---

# 12. Validation

After implementation run:

```bash
cd frontend
npm run lint
npm run build
cd ..
git diff --check
```

Then inspect:

```bash
git status --short
```

Also check that no package files changed and no backend files changed.

Report:

1. exact files created
2. exact files modified
3. how session initialization works
4. how login/register update session state
5. how protected dashboard redirects unauthenticated users
6. how logout works
7. where the access token is stored
8. whether refresh tokens are exposed to JavaScript
9. client/server component boundaries
10. validation results
11. any architectural concerns or tradeoffs

Do NOT commit.

- architecture
- modules
- database
- API
- authentication
- authorization
- integrations
- concurrency
- idempotency
- security
- frontend architecture
- testing
- deployment
- scalability
- technical decisions
- implementation phases
- acceptance criteria
- known risks
- open questions

When implementation details are unclear, the AI should consult the relevant section of the specification before making a decision.

---

# 3. Authority Hierarchy

When information conflicts, use this priority order:

```text
1. Explicit user instruction in the current implementation discussion
2. Approved engineering-spec.md decisions
3. Existing documented Technical Decision Records
4. Current phase requirements
5. Established project conventions
6. AI recommendation
```

The AI must never override a higher-level decision merely because it prefers another implementation.

If a lower-level implementation constraint genuinely conflicts with a higher-level decision, stop and explain the conflict.

---

# 4. Do Not Freestyle the Architecture

The AI must not introduce technologies, infrastructure, patterns, or abstractions merely because they are popular or theoretically useful.

Do not introduce things such as:

- Redis
- Kafka
- RabbitMQ
- microservices
- Kubernetes
- CQRS frameworks
- event buses
- distributed locks
- repository abstractions everywhere
- excessive factories
- excessive interfaces
- generic "BaseService" abstractions
- generic CRUD engines
- unnecessary state-management libraries

unless the specification explicitly requires them or a documented architectural change is approved.

The project favors **simple architecture that correctly satisfies the requirements**.

---

# 5. Modular Monolith Is the Architecture

The backend is a modular monolith.

The AI must preserve meaningful module boundaries.

Current major backend modules include:

```text
auth
users
organizations
bookables
availability
reservations
payments
access-codes
public-booking
media
common
```

The exact filesystem structure may evolve during implementation, but module responsibilities must remain clear.

Do not turn the application into:

```text
controllers/
services/
repositories/
models/
```

with all business domains mixed together simply because that folder structure is familiar.

Organize code around domain capabilities.

---

# 6. Responsibility Boundaries

Maintain these boundaries:

### Auth

Responsible for:

- authentication
- sessions
- access tokens
- refresh tokens
- password verification
- authentication context

Auth does **not** decide whether a user is allowed to manage a particular organization.

---

### Organizations

Responsible for:

- organizations
- memberships
- organization roles
- tenant authorization context

---

### Bookables

Responsible for:

- Bookable identity
- Bookable lifecycle
- Bookable configuration
- reservation rules associated with Bookables

---

### Availability

Responsible for:

- recurring availability
- specific availability
- exceptions
- determining whether an interval is continuously available

Availability does **not** own reservation creation.

---

### Reservations

Responsible for:

- reservation creation
- reservation state
- cancellation
- confirmation
- expiration
- completion
- capacity consumption
- concurrency protection

Reservation correctness is one of the highest-priority responsibilities in the system.

---

### Payments

Responsible for:

- payment lifecycle
- payment provider integration
- payment initialization
- payment webhook handling

Payment must not become the owner of reservation state.

---

### Access Codes

Responsible for:

- access-code generation
- hashing
- verification
- lifecycle

---

### Media

Responsible for:

- media provider integration
- upload authorization
- Bookable image metadata
- image ordering/removal

---

### Public Booking

Responsible for composing public-facing booking capabilities.

It must not implement a second reservation engine.

---

# 7. Implementation Phases Are Strict

The project is implemented sequentially.

The AI must work on **one phase at a time**.

The phase sequence is defined in:

```text
engineering-spec.md
```

A phase may depend on previous phases, but the AI must not casually implement future-phase functionality early.

For example:

If implementing Bookables, do not suddenly implement:

- payment processing,
- access codes,
- customer dashboards,
- notification systems.

unless the current phase explicitly requires a small dependency from those systems.

---

# 8. Phase Completion Rule

At the beginning of each phase, the AI must state:

### Current Phase

What phase is being implemented.

### Objective

What the phase is intended to accomplish.

### Scope

What is included.

### Dependencies

What previous work it relies on.

### Files/Areas

Which files/directories are expected to be created or modified.

### Acceptance Criteria

Which specification acceptance criteria this phase satisfies.

### Tests

Which tests must exist before the phase is considered complete.

---

# 9. Do Not Proceed Automatically

After completing a phase, the AI must stop.

It should report:

- what was implemented,
- files created/modified,
- tests added,
- tests executed,
- acceptance criteria satisfied,
- known limitations,
- anything requiring user attention.

Then wait for the next phase instruction.

Do not automatically continue into the next phase.

---

# 10. Exact File Paths Before Code

When giving implementation instructions or code to the user, always identify the exact file path first.

For example:

```text
File:
backend/src/bookables/application/create-bookable.use-case.ts
```

Then explain:

- why the file exists,
- what responsibility it owns,
- how it fits the architecture,
- then provide the implementation.

Do not provide unexplained giant code dumps.

---

# 11. Existing Code Must Be Inspected First

Before modifying an existing file, inspect its current contents.

Do not assume:

- imports,
- folder structure,
- installed packages,
- existing interfaces,
- existing database schema,
- existing configuration.

If the relevant file does not exist, create it in the appropriate location.

If the current implementation conflicts with the specification, identify the conflict before making a destructive change.

---

# 12. Dependencies

Do not install packages automatically just because they might be useful.

Before adding a dependency:

1. Determine whether it is actually required.
2. Check whether an existing dependency already solves the problem.
3. Explain why the dependency is appropriate.
4. Consider maintenance/security implications.
5. Add it only if justified by the current phase.

Do not introduce a library simply to avoid writing a small amount of understandable code.

---

# 13. Database Rules

PostgreSQL is the transactional source of truth.

Prisma is the primary ORM and migration tool.

The AI must distinguish between:

### Domain rules

Rules enforced through application/domain logic.

### Database invariants

Rules that should additionally be protected by PostgreSQL constraints where practical.

Examples include:

```text
capacity > 0
quantity > 0
startAt < endAt
```

Do not assume application validation alone is sufficient for race-sensitive invariants.

---

# 14. Prisma

Prisma is an infrastructure/data-access concern.

Do not expose Prisma-generated types throughout the entire application as if they were domain models or API contracts.

Maintain separation between:

```text
HTTP DTO
→ application/use case
→ domain
→ persistence
```

and:

```text
Prisma model
→ infrastructure
```

Prisma schema changes must be deliberate.

Never casually modify migrations that have already been applied to a shared/production database.

---

# 15. API Rules

The API is REST-based.

Base path:

```text
/api/v1
```

Controllers should remain thin.

Preferred flow:

```text
HTTP request
→ authentication
→ DTO validation
→ application use case
→ domain logic
→ infrastructure
→ response
```

Do not place substantial business logic inside controllers.

Do not expose raw Prisma CRUD endpoints simply because the underlying model exists.

---

# 16. DTOs

DTOs define the API boundary.

Use DTOs for:

- request validation
- response contracts where appropriate
- Swagger documentation

Do not simply pass arbitrary request bodies directly into Prisma.

Validate:

- types
- required fields
- ranges
- formats
- allowed enum values
- business constraints where appropriate.

---

# 17. Authentication and Authorization

Always distinguish:

**Authentication**

> Who is this user?

from:

**Authorization**

> Is this user allowed to perform this action on this resource?

The AI must never treat authentication as authorization.

For organization-owned operations:

```text
authenticated user
→ organization membership
→ role
→ resource ownership/tenant scope
→ authorization decision
```

Never trust:

```text
organizationId
userId
customerId
```

provided by the client as proof of authorization.

---

# 18. Tenant Isolation

Tenant isolation is a critical security invariant.

Every organization-owned query must be carefully scoped.

For example, do not implement:

```text
findBookable(bookableId)
```

and then assume the caller is authorized.

Prefer a flow equivalent to:

```text
authenticated user
→ authorized organization
→ Bookable belonging to organization
```

The exact implementation pattern may vary.

The important invariant does not.

---

# 19. Reservation Concurrency

Reservation creation must not use:

```text
check capacity
→ insert
```

without transactional protection.

The approved strategy is:

```text
BEGIN
→ lock Bookable row
→ reload relevant configuration
→ validate availability
→ calculate active overlapping consumption
→ validate capacity
→ create reservation
→ COMMIT
```

The AI must not replace this with:

- Redis locks,
- in-memory locks,
- arbitrary sleep/retry loops,
- a BookingLock table,
- client-side locking.

unless the architecture is deliberately changed.

---

# 20. Idempotency

The AI must treat idempotency as a correctness concern, not merely an optimization.

Important operations include:

- reservation creation
- payment initialization
- payment webhook handling

The same operation must not accidentally execute twice because a client retries.

Same key + same request:

→ return original result.

Same key + different request:

→ `409 IDEMPOTENCY_KEY_REUSED`.

---

# 21. External Services

External providers must remain behind appropriate boundaries.

Current MVP external integrations:

```text
Payment Provider
ImageKit
```

Do not allow provider-specific concepts to leak unnecessarily into core domain logic.

For external operations, explicitly consider:

- timeout
- failure
- retry
- duplicate request
- idempotency
- authentication
- provider response validation.

Never put an external network call inside the critical reservation database transaction.

---

# 22. Security Is Not a Frontend Responsibility

Frontend checks are for user experience.

Backend checks are authoritative.

Never rely on:

```text
hidden button
disabled form
route protection
client-side role check
```

for actual authorization.

The backend must independently enforce the security boundary.

---

# 23. Error Handling

Use structured errors.

The API should provide errors conceptually like:

```json id="dy0rzw"
{
  "statusCode": 409,
  "code": "CAPACITY_EXCEEDED",
  "message": "The requested capacity is no longer available.",
  "details": {}
}
```

Business conflicts should use appropriate conflict semantics rather than generic `500` errors.

Do not expose stack traces or internal implementation details to production clients.

---

# 24. Testing Philosophy

Testing should be risk-based.

Prioritize tests around:

1. tenant isolation
2. authorization
3. reservation concurrency
4. capacity
5. availability
6. state transitions
7. idempotency
8. payment confirmation
9. access-code verification
10. critical end-to-end workflows

Do not chase arbitrary percentage coverage simply for the sake of a number.

---

# 25. Real PostgreSQL for Database-Critical Tests

Tests involving:

- transactions,
- locking,
- constraints,
- concurrency,
- PostgreSQL-specific behavior

must use a real PostgreSQL test database.

Do not replace these tests with mocks and assume they prove transactional correctness.

---

# 26. Frontend Rules

The frontend uses Next.js App Router.

Use Server Components by default.

Use Client Components where interactivity requires them.

Do not duplicate backend business logic in the frontend.

In particular, the frontend must not become a second availability or capacity engine.

The backend remains authoritative.

---

# 27. Frontend Contexts

The application has three conceptual UX contexts:

```text
Owner Dashboard
Organization Operations
Customer Experience
```

These are not separate applications.

A user may simultaneously have different relationships with different organizations.

The frontend must support organization switching where appropriate.

---

# 28. Public Booking

Public Bookable pages are accessible without authentication.

Example:

```text
/book/:slug
```

Public pages may show:

- Bookable information
- images
- reservation rules
- availability
- booking controls

But submitting a reservation requires authentication in MVP.

---

# 29. Guided Bookable Creation

The Bookable creation UX follows:

```text
Basic Information
→ Images
→ Reservation Rules
→ Availability
→ Review & Publish
```

The wizard may progressively configure a draft.

The backend must still treat each operation according to the actual domain model.

The wizard must not force the backend into one giant "create everything" endpoint.

---

# 30. Documentation

The AI must maintain project documentation as implementation progresses.

Documentation should reflect the actual implementation, not an imagined future system.

Expected documentation includes:

```text
docs/
├── engineering-spec.md
├── ai-build-guide.md
├── architecture.md
├── api.md
├── database.md
├── security.md
├── testing.md
├── deployment.md
├── decisions/
└── phases/
```

The AI may create these files progressively.

Do not create documentation files simply to fill the folder.

Each document must have a clear purpose.

---

# 31. Technical Decision Records

When an architectural decision changes or a significant new decision is introduced, create/update a TDR.

A TDR should explain:

```text
Context
Decision
Alternatives considered
Why this decision was selected
Consequences
```

Do not silently modify an existing decision.

---

# 32. When to Ask the User

The AI should not ask the user about every small implementation detail.

It should make reasonable implementation decisions when:

- the specification already determines the outcome,
- the decision is local,
- the decision is easily reversible,
- no architecture is affected.

Ask the user when:

- requirements genuinely conflict,
- a locked architectural decision must change,
- an important product decision was not specified,
- multiple approaches have materially different consequences,
- implementation would create significant technical debt,
- a security boundary is unclear.

---

# 33. When the AI Finds a Better Idea

The AI may identify improvements.

It must distinguish:

```text
Approved decision
Recommendation
Open question
Architectural change
```

Do not silently implement a recommendation as if it were an approved decision.

Instead:

```text
Current decision:
PostgreSQL row lock

Observation:
...

Possible improvement:
...

Trade-offs:
...

Recommendation:
...

Required change:
...
```

Then wait for approval if the change affects architecture or product behavior.

---

# 34. No Cargo-Cult Engineering

Avoid patterns merely because they appear in enterprise codebases.

Do not introduce:

- interfaces with one implementation purely for aesthetics,
- repositories around every Prisma query,
- domain events for synchronous local behavior,
- factories where constructors are sufficient,
- abstract base classes,
- generic service layers,
- unnecessary CQRS infrastructure,
- excessive dependency injection,
- unnecessary modules.

Architecture should solve actual problems.

---

# 35. Failure Modes Must Be Considered

For critical workflows, the AI should consider:

```text
What happens if this succeeds?
What happens if it fails?
What happens if it is retried?
What happens if two requests happen simultaneously?
What happens if the external provider is unavailable?
What happens if the process crashes halfway through?
```

This is especially important for:

- reservation creation
- payment
- webhooks
- expiration
- access-code verification
- media uploads.

---

# 36. No Hidden Changes

The AI must report:

- new dependencies,
- database changes,
- configuration changes,
- environment variables,
- migrations,
- architectural changes,
- security-relevant changes.

Do not silently alter unrelated parts of the system.

---

# 37. Phase Completion Report

At the end of each phase, produce a concise report containing:

```text
Phase
Status

Implemented
- ...

Files created
- ...

Files modified
- ...

Dependencies added
- ...

Database changes
- ...

Tests added
- ...

Tests executed
- ...

Acceptance criteria satisfied
- ...

Known issues
- ...

Open questions
- ...

Next phase
- ...
```

Then stop.

---

# 38. Git Discipline

The AI should keep changes logically grouped.

When appropriate, recommend commits such as:

```text
feat(auth): implement refresh sessions
feat(bookables): add bookable lifecycle
test(reservations): add capacity concurrency tests
fix(availability): reject discontinuous reservation intervals
```

Do not mix unrelated features into one change merely for convenience.

---

# 39. Definition of Done

A phase is complete only when:

- implementation exists,
- architecture boundaries are respected,
- relevant validation exists,
- relevant tests exist,
- acceptance criteria are satisfied,
- documentation is updated where necessary,
- no known critical regression remains.

"Code compiles" is not sufficient.

---

# 40. Final Instruction to the AI

Before implementing anything:

1. Read `docs/engineering-spec.md`.
2. Read this `docs/ai-build-guide.md`.
3. Identify the current phase.
4. Review dependencies and acceptance criteria.
5. Inspect the existing project structure and relevant files.
6. Explain the implementation plan.
7. Implement only the approved scope.
8. Test the implementation.
9. Update relevant documentation.
10. Report the result.
11. Stop and wait for the next phase.

The AI must treat the engineering specification as the project's architectural contract.

When uncertain, prefer **clarity, correctness, security, and simplicity** over adding technology or abstraction.

Bookable

Bookable is a multi-tenant booking platform for organizations managing time-based and capacity-based resources.

It is designed around a general booking domain rather than a single business use case. The same system can support resources such as consultation slots, meeting rooms, workshops, classes, events, and equipment.

The project focuses heavily on the backend engineering problems behind booking systems: multi-tenancy, availability modelling, transactional booking, concurrency control, reservation state, capacity management, external service boundaries, and payment workflows.

Live application: https://bookable-six.vercel.app/

---

Why I built this

Booking systems look simple until multiple users interact with them concurrently.

A basic implementation might do:

check availability
create reservation

But that breaks down when two requests arrive at nearly the same time.

Both requests can observe the same available capacity before either reservation is committed.

Bookable was built to explore these problems while keeping the architecture practical for a portfolio-scale production application.

The main goals were to build a system that:

- supports multiple organizations
- isolates organization data and authorization
- supports different types of bookable resources
- models availability independently from reservations
- protects booking operations against concurrent requests
- represents reservation, payment, and approval state independently
- integrates external services behind explicit abstractions
- remains deployable as a modular monolith rather than introducing microservices prematurely

---

Architecture

Bookable uses a modular monolith architecture.

┌───────────────────────────────────────────────┐
│                   Next.js                     │
│              Customer / Operator              │
└───────────────────────┬───────────────────────┘
                        │ REST API
                        ▼
┌───────────────────────────────────────────────┐
│                NestJS Backend                  │
│                                               │
│  Auth       Organizations       Bookables     │
│  Availability       Reservations              │
│  Payments           Media                     │
│                                               │
│          Domain-oriented modules              │
└───────────────────────┬───────────────────────┘
                        │ Prisma
                        ▼
┌───────────────────────────────────────────────┐
│                 PostgreSQL                    │
│          Source of truth for domain data      │
└───────────────────────────────────────────────┘

External providers:
        │
        ├── ImageKit
        └── Stripe Connect

The modular monolith approach keeps the domain boundaries explicit without introducing the deployment, networking, observability, and consistency problems that come with prematurely splitting a relatively small system into multiple services.

---

Core domain model

The system is organized around a few core concepts.

User
 │
 ├── OrganizationMembership ──► Organization
 │
 └── Reservations

Organization
 │
 ├── Bookables
 ├── Members
 ├── Availability
 ├── Reservations
 └── Payment Account

Bookable
 │
 ├── Availability Windows
 ├── Availability Exceptions
 ├── Images
 └── Reservations

Reservation
 │
 └── Payment

Users and organizations

A "User" represents a global identity.

An "Organization" represents a tenant/workspace.

The relationship between them is represented by "OrganizationMembership".

This keeps identity separate from tenant authorization.

A user can therefore belong to multiple organizations without duplicating the underlying user account.

For the MVP, organization membership supports:

- "OWNER"
- "MEMBER"

Authorization is evaluated in the context of the organization being accessed rather than simply checking whether the user is authenticated.

---

Bookables

A Bookable represents something an organization makes available for reservation.

The MVP intentionally avoids creating separate booking systems for every business scenario.

Instead, resources broadly fall into two patterns.

Time-based resources

Examples:

- consultation
- appointment
- meeting room
- equipment rental

These are constrained by time intervals and availability.

Capacity-based resources

Examples:

- workshop
- class
- seminar
- event

These allow multiple reservations up to a defined capacity.

Both use the same reservation domain while their booking rules determine how availability and capacity are evaluated.

---

Availability model

Availability is deliberately separate from reservations.

The system supports recurring availability windows as well as specific availability and exceptions.

This allows an organization to define patterns such as:

Monday–Friday
09:00–17:00

while still being able to introduce exceptions for particular dates.

The organization timezone is authoritative for scheduling.

The application does not treat the browser's local timezone as the source of truth for organizational availability.

Reservation instants are persisted consistently so that the system can reason about actual booking times independently of presentation.

---

Concurrency control

One of the most important parts of Bookable is the reservation creation path.

A naïve implementation might be:

1. Check availability
2. Create reservation

That is vulnerable to a race condition.

For example:

Request A ──► availability = 1
Request B ──► availability = 1

Request A ──► create reservation
Request B ──► create reservation

Both requests can observe the same state.

For the critical booking path, Bookable instead performs the operation inside a database transaction.

Conceptually:

BEGIN

    lock Bookable row

    validate booking rules

    re-check availability/capacity

    create reservation

COMMIT

The Bookable row is locked so competing booking operations cannot simultaneously modify the relevant booking state without synchronization.

The final availability/capacity validation occurs inside the transaction, after acquiring the lock.

This is important because checking availability before acquiring the lock would still leave a race window.

The database therefore participates directly in the concurrency-control strategy rather than relying solely on application-level checks.

---

Reservation lifecycle

A reservation is not represented as a simple boolean such as "booked = true".

The system models an explicit lifecycle including states such as:

PENDING
CONFIRMED
REJECTED
CANCELLED
EXPIRED
COMPLETED

Payment state and approval state are intentionally separate from reservation state.

For example, a paid reservation that requires organization approval can have:

Payment:   SUCCEEDED
Reservation: PENDING
Approval:  WAITING

The reservation does not become confirmed merely because payment succeeded.

This separation prevents payment state from becoming an implicit representation of the reservation lifecycle.

---

Booking rules

Bookables can use different booking workflows.

For automatic confirmation:

FREE + AUTOMATIC
        │
        ▼
   CONFIRMED

For paid automatic bookings:

PAID + AUTOMATIC
        │
        ▼
     PENDING
        │
   payment succeeds
        │
        ▼
     CONFIRMED

For approval-required bookings:

REQUIRES_APPROVAL
        │
        ▼
     PENDING
        │
    approval
        │
        ▼
     CONFIRMED

When both payment and approval are required, both conditions must be satisfied.

This allows payment and operational approval to evolve independently.

---

Multi-tenant data isolation

Organization ownership is carried through the relevant domain relationships.

For organization-scoped operations, the backend verifies that the authenticated user has an appropriate membership before allowing the operation.

The architecture avoids treating IDs received from the client as sufficient authorization.

Conceptually:

authenticated user
        │
        ▼
organization membership
        │
        ▼
organization-scoped resource
        │
        ▼
authorized operation

This makes tenant isolation an application-level invariant rather than simply a frontend routing convention.

---

Payments

Payment is part of the domain model, but the final production payment flow is intentionally deferred.

The project already contains the foundation for:

- organization payment accounts
- payment state
- paid Bookables
- Stripe Connect configuration
- payment-provider abstraction
- development/testing payment flows

The remaining production work includes concerns such as:

- verified payment webhooks
- idempotent webhook processing
- safe repeated event handling
- reconciliation
- production payment failure handling
- refunds and related financial workflows

These were intentionally not rushed into the MVP after the core booking workflow was validated.

The goal is to avoid implementing only the happy path and calling the payment system complete.

---

Idempotency and retries

External systems introduce a different class of consistency problems.

A request or webhook may be delivered more than once.

For example:

Payment provider
      │
      ├── webhook ──► application
      │
      └── webhook ──► application again

A production payment implementation therefore needs idempotent processing so that repeated delivery of the same event cannot produce duplicate domain effects.

This is one of the areas intentionally left for the next payment implementation phase rather than pretending the current foundation is a complete production payment integration.

---

Media architecture

Bookable supports multiple images per Bookable.

The database stores the authoritative relationship between a Bookable and its images.

The actual storage provider is abstracted behind a storage interface.

Conceptually:

Bookable
   │
   ▼
BookableImage
   │
   ├── provider
   ├── providerKey
   ├── URL
   ├── dimensions
   └── metadata
          │
          ▼
     StorageProvider
          │
          ▼
       ImageKit

ImageKit is currently the implementation.

The abstraction allows the storage provider to change without coupling the booking domain to ImageKit-specific APIs.

Database mutations and external storage cleanup are also treated separately. The database remains authoritative, while provider cleanup can be performed independently.

---

API design

The backend exposes a REST API under:

/api/v1

The API is organized around domain modules rather than generic CRUD controllers.

Major areas include:

/auth
/organizations
/bookables
/availability
/reservations
/payments
/media

Swagger/OpenAPI is used for API documentation and development.

---

Frontend

The frontend is built with:

- Next.js
- React
- TypeScript
- Tailwind CSS

There are two major experiences.

Public experience

Customers can:

- browse an organization's published Bookables
- view Bookable details
- inspect availability
- make reservations
- view booking confirmation
- manage their reservations

Public routes follow the organization/bookable structure:

/book/:organizationSlug
/book/:organizationSlug/:bookableSlug

Organization experience

Organization members can:

- manage Bookables
- configure availability
- manage images
- view reservations
- approve/reject reservations where applicable
- configure payment settings

Organization routes are scoped by organization ID.

---

Project structure

The repository is divided into frontend and backend applications.

booking-system/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── common/
│   │   └── modules/
│   │       ├── auth/
│   │       ├── organizations/
│   │       ├── bookables/
│   │       ├── availability/
│   │       ├── reservations/
│   │       ├── payments/
│   │       └── ...
│   │
│   └── test/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── types/
│   └── tests/
│
└── README.md

The backend follows NestJS's module structure while keeping domain concerns separated.

---

Technology stack

Backend

- NestJS — backend framework
- TypeScript — application language
- PostgreSQL — relational database and transactional source of truth
- Prisma — ORM/database access
- Swagger/OpenAPI — API documentation
- Jest — backend testing
- class-validator / class-transformer — request validation and transformation

Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

Infrastructure / integrations

- ImageKit — image storage
- Stripe Connect — payment-account foundation
- PostgreSQL — production database

---

Local development

Prerequisites

You will need:

- Node.js
- npm
- PostgreSQL
- Git

Clone the repository:

git clone <repository-url>
cd booking-system

---

Backend setup

cd backend
npm install

Create the backend environment file using the variables documented by the project environment configuration.

At minimum, the backend requires a PostgreSQL connection.

Example:

DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/booking_system"

Generate the Prisma client:

npm run prisma:generate

Validate the schema:

npm run prisma:validate

Run migrations:

npm run prisma:migrate

Start the development server:

npm run start:dev

---

Frontend setup

From the repository root:

cd frontend
npm install

Configure the frontend environment variables using the project's environment configuration.

Start the development server:

npm run dev

The frontend will run on the local development port configured by Next.js.

---

Testing

The project includes backend integration/unit tests and frontend end-to-end coverage.

Backend tests:

cd backend
npm test

Database integration tests:

npm run test:db

Authentication integration tests:

npm run test:auth

Backend type checking:

npx tsc --noEmit

Backend build:

npm run build

Frontend type checking:

cd frontend
npx tsc --noEmit

Frontend linting:

npm run lint

Frontend production build:

npm run build

Frontend end-to-end tests:

npm run test:e2e

---

Database principles

PostgreSQL is treated as the source of truth for the core domain.

Important invariants are enforced through a combination of:

- relational constraints
- unique constraints
- foreign keys
- transactions
- row-level locking
- application-level validation

The application does not treat the frontend as a trusted source for authorization or booking validity.

---

Engineering trade-offs

Why PostgreSQL?

The domain is highly relational.

Organizations, memberships, Bookables, availability, reservations and payments have relationships that benefit from transactional guarantees and relational constraints.

Why Prisma?

Prisma provides a strongly typed database access layer while keeping schema and migration management close to the application model.

Why a modular monolith?

The project has meaningful domain boundaries, but it does not yet have a scale requirement that justifies multiple independently deployed services.

A modular monolith keeps the architecture understandable while leaving room for future extraction if a real scaling boundary emerges.

Why not pre-generate every available slot?

Availability is derived from schedules, exceptions and existing reservations.

Persisting every possible slot would create additional synchronization problems whenever availability rules change.

Why separate payment state from reservation state?

Payment completion does not necessarily mean that a reservation should become confirmed.

An organization may require approval, or a reservation may have additional business conditions.

Keeping the states separate makes those workflows explicit.

Why abstract external providers?

External vendors should not become domain concepts.

The system needs to know that an image can be stored or that a payment can be processed; it should not require the booking domain to understand every provider's API.

---

Current scope

The current MVP includes:

- multi-tenant organizations
- user authentication
- organization memberships
- Bookable management
- time-based resources
- capacity-based resources
- recurring availability
- availability exceptions
- reservation creation
- reservation lifecycle
- concurrency-safe booking
- customer reservations
- organization reservation management
- Bookable images
- ImageKit storage integration
- payment domain and account foundation
- Stripe Connect foundation
- responsive public booking experience

---

Deferred work

The project is intentionally not treated as feature-complete.

Areas deferred for subsequent iterations include:

- production payment processing
- verified payment webhooks
- idempotent payment event processing
- payment reconciliation
- refunds
- disputes/chargebacks
- additional payment providers
- more advanced reporting
- additional resource/lending workflows

The intention is to validate the core booking model with real users before expanding the system further.

---

What I learned

The main lesson from Bookable was that a booking system becomes interesting when you stop thinking of it as CRUD.

The difficult questions are about invariants and failure modes:

«What happens when two customers book the same resource simultaneously?»

«What happens when a request is retried?»

«Which system owns the truth when an external provider is involved?»

«Where is tenant isolation actually enforced?»

«Which state belongs to the reservation and which belongs to the payment?»

«Which invariants should be protected by the database?»

These questions shaped most of the important architectural decisions in the project.

---

Status

Live

Bookable is deployed and currently being used for real-world validation.

The next stage is to collect feedback from users, identify where the domain model or workflows need to change, and use that feedback to guide subsequent iterations.

---

Author

Daniel Nwahiri

Backend / Full-Stack Developer

Built with NestJS, PostgreSQL, Prisma, Next.js and TypeScript.

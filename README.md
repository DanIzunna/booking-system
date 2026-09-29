# Bookable

Bookable is a multi-tenant booking platform for organizations managing time-based and capacity-based resources.

It is designed around a general booking domain rather than a single business use case. The same system can support resources such as consultation slots, meeting rooms, workshops, classes, events, and equipment.

The project focuses on the backend engineering problems behind booking systems: multi-tenancy, availability modelling, transactional booking, concurrency control, reservation state, capacity management, external service boundaries, and payment workflows.

**Live application:** https://bookable-six.vercel.app/

## Why I Built This

Booking systems look simple until multiple users interact with them concurrently.

A basic implementation might do:

```text
check availability
create reservation

But that breaks down when two requests arrive at nearly the same time.

Both requests can observe the same available capacity before either reservation is committed.

Bookable was built to explore these problems while keeping the architecture practical for a portfolio-scale production application.

The main goals were to build a system that:

supports multiple organizations

isolates organization data and authorization

supports different types of bookable resources

models availability independently from reservations

protects booking operations against concurrent requests

represents reservation, payment, and approval state independently

integrates external services behind explicit abstractions

remains deployable as a modular monolith rather than introducing microservices prematurely


Architecture

Bookable uses a domain-oriented modular monolith.

The backend is built with NestJS and is organized into modules for authentication, organizations, Bookables, availability, reservations, payments, and media.

The frontend is a Next.js application that communicates with the backend through a REST API.

PostgreSQL serves as the transactional source of truth for the core domain.

External services such as ImageKit and Stripe Connect sit behind explicit integration boundaries rather than being treated as part of the core booking domain.

Why a Modular Monolith?

The modular monolith approach keeps domain boundaries explicit without introducing the deployment, networking, observability, and distributed-consistency problems that come with prematurely splitting a relatively small system into multiple services.

If the system eventually develops a genuine scaling or ownership boundary, individual domains can be extracted later.

Core Domain Model

Bookable is organized around a small set of core concepts:

User — global identity

Organization — tenant/workspace

OrganizationMembership — relationship between a user and an organization

Bookable — resource made available for reservation

Availability — rules defining when a Bookable can be reserved

Reservation — customer's booking

Payment — financial state associated with a reservation

MediaAsset — external media associated with a Bookable


The central relationship is:

User
  └── OrganizationMembership
        └── Organization
              ├── Bookables
              ├── Availability
              ├── Reservations
              └── Payment Account

A user can belong to multiple organizations without duplicating the underlying user account.

Multi-Tenancy

An Organization represents a tenant.

A User represents a global identity, while OrganizationMembership represents the user's relationship with an organization and determines their role within that organization.

For the MVP, organization membership supports:

OWNER

MEMBER


Authorization is evaluated in the context of the organization being accessed rather than simply checking whether the user is authenticated.

Organization-scoped operations therefore verify that the authenticated user has an appropriate membership before accessing or modifying tenant resources.

The architecture avoids treating IDs received from the client as sufficient authorization.

Conceptually:

authenticated user
        ↓
organization membership
        ↓
organization-scoped resource
        ↓
authorized operation

Tenant isolation is therefore an application-level invariant rather than merely a frontend routing convention.

Bookables

A Bookable represents something an organization makes available for reservation.

The MVP intentionally avoids creating separate booking systems for every business scenario. Instead, resources broadly fall into two patterns.

Time-Based Resources

Examples:

consultations

appointments

meeting rooms

equipment rentals


These are constrained by time intervals and availability.

Capacity-Based Resources

Examples:

workshops

classes

seminars

events


These allow multiple reservations up to a defined capacity.

Both use the same reservation domain while their booking rules determine how availability and capacity are evaluated.

Availability Model

Availability is deliberately modelled separately from reservations.

The system supports recurring availability windows as well as specific availability and exceptions.

For example, an organization can define a recurring schedule such as:

Monday–Friday
09:00–17:00

and then introduce exceptions for particular dates.

The organization's timezone is authoritative for scheduling.

The application does not treat the customer's browser timezone as the source of truth for organizational availability. Reservation instants are persisted consistently so the system can reason about actual booking times independently of presentation.

This also avoids pre-generating every possible available slot. Availability is derived from schedules, exceptions, and existing reservations rather than maintaining a large collection of materialized slots that would need to stay synchronized when scheduling rules change.

Concurrency Control

One of the most important parts of Bookable is the reservation creation path.

A naïve implementation might be:

1. Check availability


2. Create reservation



That is vulnerable to a race condition.

For example, if only one capacity remains:

Request A → availability = 1
Request B → availability = 1

Request A → create reservation
Request B → create reservation

Both requests can observe the same state before either reservation is committed.

For the critical booking path, Bookable instead performs the operation inside a database transaction.

Conceptually:

BEGIN TRANSACTION

    acquire row-level lock on Bookable

    validate booking rules

    re-check availability / capacity

    create reservation

COMMIT

The Bookable row is locked before the final availability or capacity check.

This ordering matters. Checking availability first and acquiring the lock afterward would still leave a race window.

The final validation therefore happens inside the transaction after synchronization has been established.

The database participates directly in the concurrency-control strategy rather than relying solely on application-level checks.

Reservation Lifecycle

A reservation is not represented as a simple boolean such as booked = true.

The system models an explicit lifecycle including:

PENDING

CONFIRMED

REJECTED

CANCELLED

EXPIRED

COMPLETED


Payment state and approval state are intentionally separate from reservation state.

For example, a paid reservation that requires organization approval can have:

Payment:      SUCCEEDED
Reservation:  PENDING
Approval:     WAITING

The reservation does not become confirmed merely because payment succeeded.

This separation prevents payment state from becoming an implicit representation of the reservation lifecycle.

Booking Rules

Bookables can use different booking workflows.

Automatic Confirmation

FREE + AUTOMATIC
        ↓
   CONFIRMED

Paid Automatic Booking

PAID + AUTOMATIC
        ↓
     PENDING
        ↓
 payment succeeds
        ↓
   CONFIRMED

Approval-Required Booking

REQUIRES_APPROVAL
        ↓
     PENDING
        ↓
    approval
        ↓
   CONFIRMED

When both payment and approval are required, both conditions must be satisfied.

This allows financial state and operational approval to evolve independently.

Payments

Payment is part of the domain model, but the final production payment flow is intentionally deferred.

The project already contains the foundation for:

organization payment accounts

payment state

paid Bookables

Stripe Connect configuration

payment-provider abstraction

development and testing payment flows


The remaining production work includes concerns such as:

verified payment webhooks

idempotent webhook processing

safe repeated event handling

reconciliation

production payment failure handling

refunds and related financial workflows


These were intentionally not rushed into the MVP after the core booking workflow was validated.

The goal is to avoid implementing only the happy path and calling the payment system complete.

Idempotency and Retries

External systems introduce a different class of consistency problems.

A request or webhook may be delivered more than once.

For example:

Payment Provider
      ↓
   webhook
      ↓
 Application
      ↑
   webhook
      ↑
Payment Provider

A production payment implementation therefore needs idempotent processing so that repeated delivery of the same event cannot produce duplicate domain effects.

This is one of the areas intentionally left for the next payment implementation phase rather than treating the current payment foundation as a complete production integration.

Media Architecture

Bookable supports multiple images per Bookable.

The database stores the authoritative relationship between a Bookable and its images, while the actual storage provider is abstracted behind a storage interface.

Conceptually:

Bookable
   ↓
BookableImage
   ↓
StorageProvider
   ↓
ImageKit

The image relationship stores provider-specific information such as the provider, provider key, URL, dimensions, and metadata.

ImageKit is currently the implementation.

The abstraction allows the storage provider to change without coupling the booking domain to ImageKit-specific APIs.

Database mutations and external storage cleanup are also treated separately. The database remains authoritative, while provider cleanup can be performed independently.

API Design

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

Frontend

The frontend is built with:

Next.js

React

TypeScript

Tailwind CSS


There are two major application experiences.

Public Experience

Customers can:

browse an organization's published Bookables

view Bookable details

inspect availability

make reservations

view booking confirmation

manage their reservations


Public routes follow the organization/Bookable structure:

/book/:organizationSlug
/book/:organizationSlug/:bookableSlug

Organization Experience

Organization members can:

manage Bookables

configure availability

manage images

view reservations

approve/reject reservations where applicable

configure payment settings


Organization routes are scoped by organization ID.

Project Structure

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

Technology Stack

Backend

NestJS — backend framework

TypeScript — application language

PostgreSQL — relational database and transactional source of truth

Prisma — ORM/database access

Swagger/OpenAPI — API documentation

Jest — backend testing

class-validator / class-transformer — request validation and transformation


Frontend

Next.js

React

TypeScript

Tailwind CSS


Infrastructure & Integrations

PostgreSQL — production database

ImageKit — image storage

Stripe Connect — payment-account foundation


Local Development

Prerequisites

You will need:

Node.js

npm

PostgreSQL

Git


Clone

git clone <repository-url>
cd booking-system

Backend Setup

cd backend
npm install

Create the backend environment file using the variables documented by the project's environment configuration.

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

Frontend Setup

From the repository root:

cd frontend
npm install

Configure the frontend environment variables using the project's environment configuration.

Start the development server:

npm run dev

Testing

The project includes backend integration/unit tests and frontend end-to-end coverage.

Backend

cd backend

npm test
npm run test:db
npm run test:auth

npx tsc --noEmit
npm run build

Frontend

cd frontend

npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e

Database Principles

PostgreSQL is treated as the source of truth for the core domain.

Important invariants are enforced through a combination of:

relational constraints

unique constraints

foreign keys

transactions

row-level locking

application-level validation


The application does not treat the frontend as a trusted source for authorization or booking validity.

Engineering Trade-offs

Why PostgreSQL?

The domain is highly relational.

Organizations, memberships, Bookables, availability, reservations, and payments have relationships that benefit from transactional guarantees and relational constraints.

Why Prisma?

Prisma provides a strongly typed database access layer while keeping schema and migration management close to the application model.

Why a Modular Monolith?

The project has meaningful domain boundaries, but it does not yet have a scale requirement that justifies multiple independently deployed services.

A modular monolith keeps the architecture understandable while leaving room for future extraction if a real scaling boundary emerges.

Why Not Pre-Generate Every Available Slot?

Availability is derived from schedules, exceptions, and existing reservations.

Persisting every possible slot would create additional synchronization problems whenever availability rules change.

Why Separate Payment State From Reservation State?

Payment completion does not necessarily mean that a reservation should become confirmed.

An organization may require approval, or a reservation may have additional business conditions.

Keeping the states separate makes those workflows explicit.

Why Abstract External Providers?

External vendors should not become domain concepts.

The system needs to know that an image can be stored or that a payment can be processed; it should not require the booking domain to understand every provider's API.

Current Scope

The current MVP includes:

multi-tenant organizations

user authentication

organization memberships

Bookable management

time-based resources

capacity-based resources

recurring availability

availability exceptions

reservation creation

reservation lifecycle

concurrency-safe booking

customer reservations

organization reservation management

Bookable images

ImageKit storage integration

payment domain and account foundation

Stripe Connect foundation

responsive public booking experience


Deferred Work

The project is intentionally not treated as feature-complete.

Areas deferred for subsequent iterations include:

production payment processing

verified payment webhooks

idempotent payment event processing

payment reconciliation

refunds

disputes/chargebacks

additional payment providers

more advanced reporting

additional resource/lending workflows


The intention is to validate the core booking model with real users before expanding the system further.

What I Learned

The main lesson from Bookable was that a booking system becomes interesting when you stop thinking of it as CRUD.

The difficult questions are about invariants and failure modes:

> What happens when two customers book the same resource simultaneously?



> What happens when a request is retried?



> Which system owns the truth when an external provider is involved?



> Where is tenant isolation actually enforced?



> Which state belongs to the reservation and which belongs to the payment?



> Which invariants should be protected by the database?



These questions shaped most of the important architectural decisions in the project.

Status

Live

Bookable is deployed and is now being validated through real-world usage and feedback.

The next stage is to collect feedback from users, identify where the domain model or workflows need to change, and use that feedback to guide subsequent iterations.

Author

Daniel Nwahiri

Backend / Full-Stack Developer

Built with NestJS, PostgreSQL, Prisma, Next.js, and TypeScript.

# Phase 1 - Database & Prisma Foundation

## Purpose

Phase 1 establishes PostgreSQL and Prisma as the persistence foundation for the modular monolith. It intentionally does not add authentication, APIs, business services, or reservation workflows.

## Implemented

- Prisma 6.19.0 with the PostgreSQL provider.
- NestJS `PrismaModule` and `PrismaService` under the common infrastructure boundary.
- The approved relational models: `User`, `Organization`, `OrganizationMembership`, `Bookable`, `BookableReservationRule`, `AvailabilityWindow`, `AvailabilityException`, `Reservation`, `Payment`, `AccessCode`, `BookableImage`, `RefreshSession`, and `IdempotencyRecord`.
- Initial migration generated from the complete Phase 1 schema.
- Focused PostgreSQL integration test for connection, persistence, cleanup, and a unique constraint.

## Schema and relationships

- `Organization` owns `Bookable` records and joins users through `OrganizationMembership`.
- `Bookable` owns its reservation rule, availability windows, exceptions, reservations, and images.
- `Reservation` belongs to a `Bookable` and a customer `User`; a reservation has at most one `Payment` and may have multiple `AccessCode` records.
- `RefreshSession` and `IdempotencyRecord` belong to `User`.
- Bookable slugs are globally unique for the `/book/:slug` public URL.
- Bookable lifecycle uses `DRAFT`, `PUBLISHED`, and `ARCHIVED`; physical deletion is not the normal lifecycle.

## Constraints and deletion behavior

- UUID primary keys are used consistently.
- Email, organization slug, bookable slug, one-to-one reservation rule, one-to-one reservation payment, and `(userId, organizationId)` membership are unique.
- PostgreSQL check constraints in the initial migration enforce positive capacity and quantity, valid interval ordering, valid duration combinations, and the recurring/specific availability field shape.
- Memberships, refresh sessions, and idempotency records cascade when their owning user is deleted. Bookable configuration and images cascade with a bookable, while organizations, reservations, customers, payments, and access codes use restrictive deletion to protect historical records.
- The capacity sum for overlapping active reservations remains an application transaction invariant and is not represented as a simple check constraint.

## Indexes

- Organization/status indexes support tenant-scoped Bookable operations.
- Reservation interval and customer/status indexes support capacity checks and customer history.
- Availability indexes support recurring lookup and specific interval lookup.
- Payment provider/reference, access-code lifecycle, image ordering, refresh-session expiry, and idempotency expiry indexes support their expected lookup paths.

## Representation decisions

- Duration fields are nullable integer seconds. Flexible rules use minimum and maximum duration; fixed rules use fixed duration.
- Recurring local times use validated `HH:mm` strings because Prisma does not expose PostgreSQL `time` as a portable scalar. Specific availability, exceptions, reservations, and expiry values use UTC PostgreSQL `timestamptz(3)` instants.
- Idempotency responses use Prisma `Json`, mapped to PostgreSQL JSONB.
- `sortOrder = 0` is the convention for a primary Bookable image; no second `isPrimary` source of truth is added.

## Migration and test database

The migration is created with `prisma migrate dev` and is the source-controlled database change. Local development and integration tests use a real PostgreSQL database configured through `DATABASE_URL`; SQLite is not used because PostgreSQL constraints and timestamp behavior are part of this persistence contract.

The committed environment template uses:

```text
postgresql://postgres:postgres@localhost:5432/booking_system?schema=public
```

Replace it with local credentials as needed. No real credentials are committed.

## Deferred work

Authentication, organization and Bookable APIs, availability calculation, reservation lifecycle and locking, idempotency behavior, payment integration, access-code generation, ImageKit, and all frontend booking functionality remain deferred to later phases.

## Deviations

None from the Phase 1 requirements. The specification's open implementation questions were resolved as documented above.

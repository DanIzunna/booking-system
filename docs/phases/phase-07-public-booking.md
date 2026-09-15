# Phase 7 - Public Booking

## Purpose

Phase 7 adds a thin anonymous Public Booking composition layer. It exposes published Bookables by slug and checks whether a requested interval and quantity can currently be booked. It does not create reservations or replace reservation lifecycle logic.

## Public endpoints

- `GET /api/v1/public/bookables/:slug`
- `GET /api/v1/public/bookables/:slug/availability/check?startAt=...&endAt=...&quantity=...`

Both endpoints are anonymous and do not use `AccessTokenGuard`.

## Public Bookable behavior

The lookup uses the globally unique slug and a `PUBLISHED` status filter. DRAFT, ARCHIVED, and unknown slugs return `404`. The response explicitly selects only the public Bookable identity, organization ID/name, capacity, and reservation-rule fields. Memberships, users, authentication data, and unrelated relations are not exposed.

## Availability check

The service validates timestamps, quantity, reservation-rule duration, and server-relative advance-time bounds. It calls the existing `AvailabilityEngineService` for organization-timezone-aware recurring/specific schedule coverage and BLOCK/OVERRIDE behavior.

After schedule coverage succeeds, it queries only overlapping `PENDING` and `CONFIRMED` reservations using the existing half-open overlap predicate and compares their summed quantity with Bookable capacity. The endpoint is read-only: it creates no reservation and takes no capacity lock.

Fixed-duration Bookables require the requested interval length to equal the configured `fixedDuration`. This preserves the current reservation contract while the public endpoint still receives an explicit interval for checking.

## Relationship to domain services

- `AvailabilityEngineService` remains the sole schedule calculator.
- `ReservationsService` remains the sole reservation creator and transactional capacity-protection owner.
- Public Booking performs only safe publication lookup and read-only composition of schedule plus current capacity.

## Security and tenant isolation

No organization ID is accepted from the client. The server resolves the Bookable and its organization from the public slug. Public lookup does not require organization membership, but unpublished resources remain inaccessible. No mutation or public reservation submission endpoint was added.

## Tests

`backend/test/public-booking.integration-spec.ts` uses real PostgreSQL and covers published/unpublished lookup, safe response fields, anonymous access, availability and exception behavior, active reservation capacity, inactive reservation exclusion, adjacent intervals, invalid input, duration/advance rules, and membership-independent public access.

## Deferred work

Public reservation creation, authentication UI, slot generation, payments, access codes, media, notifications, background jobs, and all later phases remain deferred.

## Database changes

None. No Prisma schema or migration changes were required.

# Phase 6 - Reservation Domain

## Responsibilities

Phase 6 adds authenticated reservation creation and customer-owned reservation reads. A reservation is a customer's time-bounded claim against a published Bookable. Any authenticated User may reserve a published Bookable; organization membership is not required for customer reservation creation.

Implemented endpoints:

- `POST /api/v1/bookables/:bookableId/reservations`
- `GET /api/v1/reservations/:reservationId`
- `GET /api/v1/reservations`

New reservations are always `PENDING`. No automatic expiration, cancellation, payment transition, access code, or idempotency behavior is implemented in this phase.

## Duration and advance-time rules

The existing `BookableReservationRule` is authoritative:

- `FLEXIBLE` requires client `startAt` and `endAt`, with positive duration bounded by configured minimum and maximum seconds.
- `FIXED` requires only `startAt`; the backend derives `endAt` from `fixedDuration` and rejects client-supplied `endAt`.
- `minimumAdvanceTime` and `maximumAdvanceTime` are evaluated against server time.
- Invalid timestamps and invalid intervals are rejected before Prisma receives them.

## Availability integration

Reservation creation reuses the existing `AvailabilityEngineService`. It does not duplicate recurring timezone interpretation, specific windows, BLOCK/OVERRIDE exceptions, or half-open interval arithmetic. The requested interval must be continuously available before capacity is considered.

## Capacity and transaction locking

Only `PENDING` and `CONFIRMED` reservations consume capacity. The overlap predicate is half-open:

```text
existing.startAt < requested.endAt
AND existing.endAt > requested.startAt
```

The final capacity decision runs inside a Prisma transaction after a narrowly scoped PostgreSQL `SELECT ... FOR UPDATE` lock on the Bookable row. This serializes competing reservations for the same Bookable without Redis, in-memory locks, queues, or lock tables. The transaction rechecks Bookable publication state, sums overlapping active quantities, and inserts the new reservation atomically.

No external calls occur inside the transaction.

## Authorization boundaries

- The access token establishes the customer identity.
- Customer creation does not require organization membership.
- Published Bookables are reservable by authenticated users regardless of tenant membership.
- Reservation reads are scoped by `customerId`; another customer receives `404` for an unknown reservation.
- The request body cannot supply or override `customerId`.

## Tests

`backend/test/reservations.integration-spec.ts` uses real PostgreSQL and covers:

- authentication and non-member customer creation
- DRAFT/ARCHIVED rejection
- flexible and fixed duration rules
- minimum and maximum advance time
- continuous availability, BLOCK, and OVERRIDE behavior
- active reservation capacity accumulation
- inactive status exclusion
- half-open touching intervals
- customer-owned get/list behavior
- concurrent capacity-one attempts, with exactly one success

## Database changes

None. The existing Phase 1 `Reservation`, `BookableReservationRule`, and Bookable indexes support this phase without schema or migration changes.

## Deferred work

Cancellation, automatic expiration workers, payment integration and state transitions, access codes, idempotency behavior, notifications, public booking, and later reservation lifecycle operations remain deferred.

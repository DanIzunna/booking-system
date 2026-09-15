# Phase 5 - Availability Engine

## Objective

Phase 5 establishes dynamic availability calculation for Bookables without creating reservations, slots, occurrences, or capacity claims.

## Model and API

The existing Phase 1 models are used unchanged:

- `AvailabilityWindow` supports `RECURRING` weekly local-time windows and `SPECIFIC` UTC timestamp windows.
- `AvailabilityException` supports `BLOCK` and `OVERRIDE` UTC intervals.

Endpoints are nested under `/api/v1/bookables/:bookableId/availability`:

- `POST/GET/PATCH/DELETE /windows`
- `POST/GET/PATCH/DELETE /exceptions`
- `GET /check?startAt=...&endAt=...`

OWNER membership is required for writes. Members can list and query availability. Every operation first resolves the Bookable and checks membership through the Phase 3 `OrganizationAuthorizationService`.

## Calculation approach

`AvailabilityEngineService` dynamically resolves recurring windows across the requested local date range, adds specific windows and OVERRIDE exceptions, subtracts BLOCK exceptions, merges only overlapping or adjacent intervals, and checks whether one effective interval fully covers the requested `[startAt, endAt)` range.

The engine returns the availability decision and effective intervals clipped to the requested range. It does not calculate reservation duration, create reservations, or enforce capacity.

## Timezone semantics

The Organization timezone is used for recurring windows. A recurring `09:00` is interpreted as local organization time and converted to an instant with standard `Intl.DateTimeFormat` timezone support. Specific windows and exceptions are treated as UTC-compatible instants from their ISO timestamps.

No Bookable or availability timezone was added.

## Exceptions

Exceptions use half-open overlap semantics. Any overlapping exception on the same Bookable is rejected with `409`, regardless of type. BLOCK intervals subtract availability; OVERRIDE intervals add availability without replacing normal windows.

## Tests

`backend/test/availability.integration-spec.ts` covers:

- OWNER CRUD and MEMBER read-only access
- recurring and specific validation
- recurring local-time interpretation in `Africa/Lagos`
- specific intervals
- continuous coverage across separated windows
- BLOCK subtraction
- OVERRIDE addition
- overlapping exception conflicts
- tenant isolation by Bookable/window/exception context
- half-open boundary behavior

## Deferred functionality

Reservations, capacity enforcement, reservation overlap checks, payments, access codes, expiration jobs, background workers, slot/occurrence generation, and public customer booking UI are intentionally deferred.

## Database changes

None. The existing Prisma schema already supports the required availability models and fields; no migration was created.

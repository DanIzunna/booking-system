# Phase 4 - Bookables

## Purpose

Phase 4 adds the authenticated Bookables module for organizations. A Bookable remains a generic reservable resource owned by exactly one organization; no Bookable type hierarchy or marketplace behavior is introduced.

## Responsibilities and API

All endpoints require a Phase 2 bearer access token and live under `/api/v1/bookables`:

- `POST /` creates a Bookable for a member organization. Status defaults to `DRAFT`.
- `GET /` lists Bookables belonging only to organizations where the user has membership. An optional `organizationId` filter is membership-checked.
- `GET /:bookableId` returns a Bookable only when the authenticated user belongs to its organization.
- `PATCH /:bookableId` updates a Bookable for an OWNER of its organization.
- `POST /:bookableId/archive` changes status to `ARCHIVED` for an OWNER without deleting the record.

The controller is thin; `BookablesService` performs tenant scoping and delegates membership decisions to the reusable Phase 3 `OrganizationAuthorizationService`.

## Authorization and tenant isolation

The service uses this flow for organization-owned operations:

```text
JWT
  -> AccessTokenGuard
  -> authenticated user ID
  -> Bookable organization ID or requested organization ID
  -> OrganizationAuthorizationService membership lookup
  -> MEMBER read or OWNER write decision
  -> Bookable operation
```

A supplied organization ID is only a resource identifier. It is never accepted as authorization proof. Missing membership returns `404` to avoid leaking another tenant's resource. MEMBER users may create and read Bookables as organization members, while OWNER membership is required for update and archive operations, matching the Phase 3 permission boundary.

## Validation and slug behavior

Names and descriptions are trimmed at the DTO boundary. Capacity must be a positive integer. Slugs must use lowercase kebab-case and are globally unique through the existing Prisma constraint. Duplicate slugs become `409` responses rather than raw Prisma errors.

## Database changes

None. The existing Phase 1 `Bookable` model already provides organization ownership, global slug uniqueness, lifecycle status, capacity, timestamps, and the organization/status index. No migration was created.

## Tests

`backend/test/bookables.integration-spec.ts` uses the real PostgreSQL-backed NestJS and Prisma setup and covers:

- authenticated creation and default `DRAFT` status
- organization ownership
- invalid capacity and malformed slug rejection
- global duplicate slug rejection
- multiple organizations for one user
- tenant-scoped reads and list filters
- unrelated-user isolation by Bookable ID
- OWNER update access
- MEMBER update rejection
- OWNER archive and persistence
- unauthorized archive rejection
- unauthenticated request rejection

## Deferred work

Availability, reservation creation, capacity consumption, payments, images/media, access codes, public booking, expiration jobs, dashboards, marketplace discovery, custom domains, and all other later-phase functionality remain deferred.

# Phase 3 - Organizations & Multi-Tenancy

## Objective

Phase 3 establishes the organization tenant boundary on top of the authenticated user identity from Phase 2. Organization access is derived from `OrganizationMembership`; knowing an organization ID is never sufficient authorization.

## Organization model

Organizations use the existing Phase 1 `Organization` model with a unique slug, name, timezone, and timestamps. The creator is added transactionally as an `OWNER` membership. No organization-specific authentication or public discovery was added.

Implemented endpoints under `/api/v1/organizations`:

- `POST /` creates an organization for the authenticated user.
- `GET /` lists organizations where the authenticated user has membership, including the membership role.
- `GET /:organizationId` reads an organization only for a member.
- `PATCH /:organizationId` updates name, slug, or timezone for an OWNER.
- `POST /:organizationId/members` adds an existing user as a `MEMBER` for an OWNER.

All endpoints require the Phase 2 bearer access-token guard.

## Membership model

The existing `OrganizationMembership` model remains unchanged. MVP roles are only `OWNER` and `MEMBER`, and the database uniqueness constraint on `(userId, organizationId)` remains authoritative. A user can belong to multiple organizations and can remain a reservation customer without a customer role.

OWNER permissions implemented in this phase:

- update the organization
- add organization members

MEMBER permissions implemented in this phase:

- read/access the organization

No membership removal, invitations, granular RBAC, or future resource permissions were added.

## Authorization flow

The reusable `OrganizationAuthorizationService` performs membership lookup using the authenticated JWT subject and the organization route identifier:

```text
Bearer JWT
  -> AccessTokenGuard
  -> authenticated user ID
  -> OrganizationAuthorizationService membership lookup
  -> OWNER or MEMBER decision
  -> organization-scoped service operation
```

Organization service methods never treat a client-supplied organization ID as proof of access. Missing membership returns `404 Organization not found` to avoid disclosing another tenant. OWNER-only actions return `403` for authenticated members of the organization.

## Tenant isolation and security decisions

- Every organization read/update/member operation checks membership using both authenticated `userId` and `organizationId`.
- Organization creation and creator membership are one transaction.
- Slug format is validated as lowercase kebab-case and uniqueness conflicts return `409`.
- Member additions validate the target user and preserve the existing membership uniqueness constraint.
- No organization roles or permissions are placed in access tokens.
- No organization ID from a request body is used as an authorization identity.

## Tests

`backend/test/organizations.integration-spec.ts` uses real PostgreSQL through Prisma and verifies:

- authenticated organization creation
- automatic OWNER membership
- authenticated organization listing
- member access
- unrelated-user isolation
- member rejection from OWNER-only operations
- owner updates
- owner member management
- duplicate membership rejection
- multi-organization membership
- unauthenticated rejection
- access by ID alone does not bypass membership
- cleanup of NestJS and Prisma resources

## Known future work

Bookables, availability, reservations, payments, access codes, media, public booking, dashboards, invitations, membership removal, advanced RBAC, and marketplace functionality remain deferred. Organization authorization must be reused by later organization-owned modules rather than replaced with client-side checks or separate authentication systems.

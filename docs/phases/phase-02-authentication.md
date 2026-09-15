# Phase 2 - Authentication & Identity

## Scope

Phase 2 establishes authenticated user identity only. It adds email/password registration, login, short-lived access tokens, opaque rotating refresh sessions, logout, and the authenticated current-user endpoint.

Organization authorization, memberships, roles, and tenant-scoped permissions remain deferred to Phase 3.

## Files and module structure

Authentication lives in `backend/src/modules/auth/`:

- `auth.module.ts` wires the auth capability.
- `auth.controller.ts` exposes the REST endpoints.
- `auth.service.ts` owns user/session persistence and credential flows.
- `password-hasher.service.ts` isolates Argon2id operations.
- `token.utils.ts` owns opaque refresh-token generation/hashing and token durations.
- `guards/access-token.guard.ts` establishes the authenticated user context from a bearer access token.
- `dto/` contains registration and login request validation.

The existing common Prisma module remains the persistence boundary. No Prisma schema or migration change was required.

## Authentication flows

### Registration

`POST /api/v1/auth/register` validates and normalizes the email, trims the name, hashes the password with Argon2id, creates a `User`, creates a refresh session, signs a short-lived access token, and sets the refresh cookie. It does not create an organization or membership.

### Login

`POST /api/v1/auth/login` normalizes the email, verifies the Argon2id password, and uses the same generic failure response for a missing user and an incorrect password. Successful login creates a persisted refresh session and returns a safe user object with an access token.

### Refresh rotation

`POST /api/v1/auth/refresh` reads the refresh token only from the HTTP-only cookie, hashes it, finds the matching session, rejects revoked or expired sessions, revokes the old session, creates a new session, issues a new access token, and replaces the cookie in one Prisma transaction. The raw refresh token is never returned in JSON or logged.

### Logout

`POST /api/v1/auth/logout` revokes the current refresh session when the cookie is valid and safely succeeds when it is absent. It clears the refresh cookie and never deletes the user.

### Current user

`GET /api/v1/auth/me` requires a bearer access token. The guard places only the authenticated user ID in the request context; the endpoint then loads and returns `id`, `email`, `name`, and `createdAt`.

## Cookie and token strategy

- Access tokens are signed JWTs with only the `sub` user ID claim and a default lifetime of 15 minutes.
- Refresh tokens are cryptographically random opaque values generated with Node's `crypto.randomBytes`.
- Refresh sessions store only a SHA-256 hash, an expiry, revocation timestamp, and user ID in the existing `RefreshSession` model.
- The refresh cookie is HTTP-only, scoped to `/api/v1/auth`, uses `secure` in production, and defaults to `sameSite=lax`.
- Cookie name and SameSite policy are configurable through environment variables.
- The access-token secret is configured through `JWT_ACCESS_SECRET`; development uses a clearly non-production fallback so Phase 0 tests can boot without local secrets. Production requires the environment variable.

Cookie-based authentication creates a CSRF consideration. SameSite protection and the scoped HTTP-only cookie are established here; dedicated CSRF defenses and deployment-specific origin policy remain security hardening work before broader production use.

## Environment variables

```text
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
AUTH_REFRESH_COOKIE_NAME=booking_refresh_token
AUTH_COOKIE_SAME_SITE=lax
```

No real secrets are committed. Refresh tokens are not JWTs, so no refresh JWT signing secret is required.

## Tests

`backend/test/auth.integration-spec.ts` uses the real PostgreSQL-backed Prisma service and verifies:

- successful registration and Argon2id hashing
- safe registration/login responses
- duplicate and malformed registration rejection
- generic invalid-login behavior
- successful login and access-token issuance
- refresh session creation and hashed-only refresh storage
- refresh rotation and revoked-token rejection
- expired-token rejection
- logout revocation
- authentication requirement and safe `/auth/me` output

## Known limitations and deferred work

Rate limiting is documented as a required security hardening item but no distributed infrastructure was added. Password reset, email verification, MFA, refresh-token family reuse detection, organization authorization, membership roles, and all later domain APIs remain deferred.

## Decisions and deviations

- Argon2id was selected as required by the phase instead of bcrypt.
- Refresh tokens are opaque random values rather than JWTs because they are persisted, rotated, and revoked through `RefreshSession`.
- No database migration was necessary because Phase 1 already provided the approved `User` and `RefreshSession` models.
- No deviations from the Phase 2 requirements are intended.

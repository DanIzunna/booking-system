# Phase 8 - Payments and Connect Foundation

## Architecture

Payments is a provider-agnostic application boundary. `PaymentsService` owns Payment records, initialization, provider verification, amount/currency validation, and webhook idempotency. `ReservationsService` remains the owner of Reservation lifecycle; verified payment success calls its explicit `confirmFromPayment` boundary.

Stripe Connect organization onboarding is implemented behind a Stripe-specific
adapter. Customer payment collection is not implemented in this phase. The
FakePaymentProvider remains available for development and tests.

## Money representation

All monetary values are integer minor units. `Bookable.price` is the price per reservation quantity unit. Therefore:

```text
quantity = 1, price = 1000000 -> reservation amount = 1000000
quantity = 3, price = 1000000 -> reservation amount = 3000000
```

`currency` is a supported three-letter code. Bookables use the explicit `PricingType` enum:

```text
FREE → price = NULL, currency = NULL
PAID → positive integer price and supported currency
```

`PricingType` is authoritative. Free reservations use an amount of `0` only as a reservation snapshot/calculation value; `amount = 0` is not the definition of a FREE Bookable. Free reservations are confirmed through the Reservation boundary without creating a Payment record.

The existing development Payment decimal amount was converted in migration `20260915193719_phase8_payments` with:

```sql
USING ROUND("amount" * 100)::INTEGER
```

This maps `100.00` to `10000` and `100.50` to `10050`. The local database was reset because the Phase 8 migration was uncommitted and contained no production data.

## Pricing snapshots

Reservation creation copies `quantity * Bookable.price` and `Bookable.currency` into Reservation `amount` and `currency`. Later Bookable price changes do not alter existing reservations. Payment initialization copies only those Reservation snapshot values; clients cannot supply or override payment amount or currency.

## Payment lifecycle

Supported states are `PENDING`, `SUCCEEDED`, `FAILED`, and `REFUNDED`.

Implemented transitions:

```text
PENDING -> SUCCEEDED
PENDING -> FAILED
```

A verified successful payment atomically updates Payment and asks `ReservationsService` to confirm the associated pending Reservation. Expired, cancelled, completed, or otherwise invalid reservations cannot be confirmed.

## Provider abstraction

`PaymentProvider` normalizes initialization and webhook verification. Initialization receives a deterministic `idempotencyKey` derived from the Reservation identity (`reservation:<reservationId>`), allowing a future real provider to safely retry the same logical attempt. The fake provider returns normalized references and checkout URLs and verifies a test signature without external calls.

## API boundaries

Authenticated initialization:

```text
POST /api/v1/payments/reservations/:reservationId/initialize
```

The authenticated customer must own the Reservation. Organization membership does not grant payment access.

Provider webhook boundary:

```text
POST /api/v1/payments/webhooks/:provider
```

It is not JWT-authenticated. Provider signature verification occurs inside the provider adapter.

## Webhook idempotency and transactions

Payment keeps the existing unique `(provider, providerReference)` constraint. Successful webhook processing also uses a conditional `UPDATE ... WHERE status = PENDING` inside a Prisma transaction. Only the first concurrent delivery changes the row; repeated deliveries return an idempotent result. The same transaction confirms the Reservation through `ReservationsService`.

No external provider call is made inside the database transaction.

## Organization Payment Accounts

Organizations have a provider-agnostic payment account model:

```text
Organization
	└── OrganizationPaymentAccount
				provider = STRIPE | PAYSTACK
				providerAccountId
				status
				readyForPayments
				createdAt / updatedAt
				lastSyncedAt / connectedAt / disconnectedAt
```

The MVP permits one payment account per organization. The account is uniquely constrained by `organizationId` and by `(provider, providerAccountId)`. `PAYSTACK` is reserved as a future provider value; only `STRIPE` is implemented.

Normalized account states are:

```text
ONBOARDING
READY
RESTRICTED
DISCONNECTED
```

There is no Stripe-specific field on `Organization`. Stripe-specific account capabilities, requirements, and disabled reasons remain inside `StripeConnectService`, which maps them to the normalized status and `readyForPayments` flag.

## Stripe Connect Phase 1

Stripe Connect is used for organization payment-account onboarding. The owner starts onboarding from:

```text
Organization → Settings → Payments → Connect Stripe
```

The flow is:

```text
Connect endpoint
→ create or retrieve Stripe Express connected account
→ create Stripe Account Link
→ redirect the owner to Stripe-hosted onboarding
→ return to Organization Payments settings
→ synchronize and normalize account readiness
```

The configured `APP_BASE_URL` is used to construct the Account Link return and refresh URLs. `STRIPE_SECRET_KEY` is server-only. Bookable never collects or stores bank details, card details, KYC documents, Stripe secrets, or webhook secrets.

Generic API endpoints are:

```text
GET  /api/v1/organizations/:organizationId/payment-account
POST /api/v1/organizations/:organizationId/payment-account/connect
POST /api/v1/organizations/:organizationId/payment-account/sync
POST /api/v1/organizations/:organizationId/payment-account/disconnect
```

Organization members can read payment-account state. Only owners can connect, synchronize, or disconnect it. Authorization is derived from the authenticated organization membership; client-supplied organization IDs do not grant access.

When no account exists, the GET endpoint returns `200` with JSON `null`. Stripe configuration and provider failures are returned as safe API errors; for example, a platform that is not Connect-enabled returns `503` without exposing the Stripe exception details.

## Payment readiness and Bookable lifecycle

`PaymentAccountReadinessService` is provider-agnostic. It returns normalized readiness with an optional provider, provider account ID, and reason such as `NOT_CONNECTED`, `ONBOARDING`, `RESTRICTED`, or `DISCONNECTED`.

The lifecycle rules are:

```text
FREE Bookable
→ does not require a payment account

PAID draft
→ may exist without a ready payment account

PAID publish
→ requires a payment account ready for payments
```

Paid reservation creation and payment initialization also perform defensive organization readiness checks. The existing reservation/payment lifecycle remains authoritative, and the FakePaymentProvider remains available for development and tests.

## Security

Payment amount, currency, customer identity, and success state are server/provider-derived. Provider signatures are verified by the adapter. Raw provider payloads are not exposed as API responses, and no provider secrets are required by tests.

## Verification

The completed foundation was verified with:

- Backend typecheck passed.
- Backend lint passed.
- Full backend test suite passed: 13 suites and 101 tests.
- Frontend typecheck passed.
- Frontend lint passed.
- Frontend production build passed.
- Prisma schema validation passed.
- Authenticated `GET /api/v1/organizations/:organizationId/payment-account` was manually verified as `200` with JSON `null` when no account exists.
- An authenticated owner Connect request was manually verified to reach Stripe.
- When the local Stripe platform was not Connect-enabled, the provider error was normalized to HTTP `503` with a client-safe message.

The Account Link was not created locally because the Stripe platform was not
Connect-enabled. No real Stripe credentials or provider secrets are part of
the repository.

## Deferred work

The following remain deferred:

- Stripe PaymentIntent/payment collection.
- Stripe Checkout or Payment Element.
- Customer payment UI.
- Refunds, disputes, invoices, subscriptions, taxes, coupons, and payout management UI.
- Paystack integration.
- Payment-account history, reconciliation, and background workers.

The current FakePaymentProvider remains the temporary development/testing payment mechanism.

# Phase 8 - Payments

## Architecture

Payments is a provider-agnostic application boundary. `PaymentsService` owns Payment records, initialization, provider verification, amount/currency validation, and webhook idempotency. `ReservationsService` remains the owner of Reservation lifecycle; verified payment success calls its explicit `confirmFromPayment` boundary.

No real provider SDK or external network request is required. The current fake provider makes the boundary testable and can later be replaced by a concrete adapter.

## Money representation

All monetary values are integer minor units. `Bookable.price` is the price per reservation quantity unit. Therefore:

```text
quantity = 1, price = 1000000 -> reservation amount = 1000000
quantity = 3, price = 1000000 -> reservation amount = 3000000
```

`currency` is a three-letter ISO-style code. Free Bookables use `price = 0`; free reservations are confirmed through the Reservation boundary without creating a Payment record.

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

## Security

Payment amount, currency, customer identity, and success state are server/provider-derived. Provider signatures are verified by the adapter. Raw provider payloads are not exposed as API responses, and no provider secrets are required by tests.

## Deferred work

Real Paystack, Flutterwave, Stripe, or other provider adapters; refunds, disputes, subscriptions, coupons, taxes, invoices, payouts, saved payment methods, background jobs, and payment UI remain deferred.

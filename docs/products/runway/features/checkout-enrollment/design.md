---
title: "Design: checkout-enrollment"
product: runway
feature: checkout-enrollment
type: design
status: done
---

# Design: checkout-enrollment

## Mock Payment via Dependency Injection

The `@firc/payment` library defines a `PaymentProvider` interface. `createPaymentProvider()` is a factory that currently returns `MockPaymentProvider`. When Stripe lands, the factory switches based on environment config -- no call sites change.

```text
PaymentProvider (interface)
  -> MockPaymentProvider (current)
  -> StripePaymentProvider (future)
```

The mock provider is stateful per-instance (owns a `Map<string, PaymentIntent>`). A new instance is created per request to avoid shared mutable state. The scenario ID is injected at construction time.

## Payment Scenarios

12 scenarios cover the full range of payment outcomes:

| Scenario           | Outcome         | Delay | Purpose                           |
| ------------------ | --------------- | ----- | --------------------------------- |
| success            | success         | 0ms   | Happy path                        |
| success_delayed    | success         | 3s    | Slow processor                    |
| card_declined      | failure         | 500ms | Issuer decline                    |
| insufficient_funds | failure         | 500ms | Balance issue                     |
| network_timeout    | failure         | 10s   | Gateway timeout                   |
| three_d_secure     | requires_action | 1s    | 3DS redirect (not yet handled)    |
| processing_delay   | pending         | 0ms   | Async resolution (webhook needed) |
| duplicate_charge   | success         | 0ms   | Idempotency validation            |
| partial_failure    | success         | 0ms   | Payment OK, enrollment fails      |
| expired_session    | failure         | 0ms   | Stale checkout                    |
| amount_mismatch    | failure         | 0ms   | Tampered amount                   |
| server_error       | failure         | 200ms | Unexpected error                  |

Scenario selector is dev-only (`{#if dev}`). In production, the form data field is ignored and defaults to `success`.

## Idempotency

Key format: `checkout_{userId}_{releaseId}`. Same user + same release always produces the same key. The in-memory store (LRU, 10k max) returns the original intent if the key already exists. Amount/currency mismatch on a reused key throws an error.

This prevents double charges if a user refreshes during payment or submits twice.

## Enrollment Creation Flow

```text
POST /checkout
  1. Auth check (redirect if not logged in)
  2. Release check (400 if none published)
  3. Duplicate enrollment check (redirect to confirm)
  4. Create payment intent (idempotency key)
  5. Confirm payment (mock card)
  6. Branch on result:
     - requires_action -> form error (inline)
     - failure -> redirect to /checkout/error
     - success -> create enrollment -> redirect to /checkout/confirm
     - success + enrollment fails -> redirect to /checkout/error with paymentId
```

The enrollment is created synchronously in the same server action as payment confirmation. No async webhook flow yet -- that comes with real Stripe integration.

## Route Structure

| Route               | Auth                          | Purpose                 |
| ------------------- | ----------------------------- | ----------------------- |
| `/checkout`         | Optional (form requires auth) | Order summary + payment |
| `/checkout/confirm` | Required + enrollment guard   | Success confirmation    |
| `/checkout/error`   | None (query params only)      | Error display           |

## Component Split

- `+page.svelte` files are thin -- they pass data to extracted components
- `PaymentScenarioSelector` -- dev-only, uses `$bindable` for two-way binding
- `CheckoutSuccess` / `CheckoutError` -- presentational, receive all data as props
- Shared layout (`+layout.svelte`) constrains max-width to 32rem

## Key Decisions

### Why synchronous enrollment (no webhooks)?

- **Options:** Create enrollment in form action vs. create via webhook after async payment confirmation
- **Chosen:** Synchronous in form action
- **Rationale:** Mock provider resolves immediately. Webhook flow adds complexity with no benefit until real Stripe integration. The factory pattern means switching to async later only changes the provider implementation, not the checkout route logic.

### Why in-memory idempotency (not DB)?

- **Options:** Database table vs. in-memory Map
- **Chosen:** In-memory with LRU eviction
- **Rationale:** Mock provider is ephemeral by design. Real Stripe handles idempotency server-side. The in-memory store exists only to exercise the idempotency code path during dev testing. It resets on server restart, which is fine.

---
title: "Tasks: checkout-enrollment"
product: runway
feature: checkout-enrollment
type: tasks
status: done
---

# Tasks: checkout-enrollment

All tasks completed as part of Phase 4a (WP D).

## 1. Payment Mock Library (`@firc/payment`)

- [x] Define `PaymentProvider` interface (createIntent, confirmPayment, getStatus, refund)
- [x] Define types: `PaymentIntent`, `PaymentMethod`, `PaymentResult`, `RefundResult`, `PaymentStatus`
- [x] Define 12 payment scenarios with typed IDs, outcomes, delay, and error codes
- [x] Implement `MockPaymentProvider` class with scenario-driven behavior
- [x] Implement in-memory idempotency store with LRU eviction (max 10k)
- [x] Implement `createPaymentProvider` factory function
- [x] Export all types and scenario IDs from index

## 2. Constants

- [x] Add `COURSE_PRICE_CENTS` (14900) and `COURSE_CURRENCY` ('usd') to `libs/constants/src/course.ts`
- [x] Add `RUNWAY_CHECKOUT`, `RUNWAY_CHECKOUT_CONFIRM`, `RUNWAY_CHECKOUT_ERROR` routes

## 3. Checkout Routes

- [x] Create `/checkout` layout (max-width container)
- [x] Create `/checkout` page -- server load (release + enrollment check), form action (payment + enrollment)
- [x] Create `/checkout/confirm` page -- server guard (auth + enrollment), success display
- [x] Create `/checkout/error` page -- query param error display

## 4. Components

- [x] Create `PaymentScenarioSelector` -- dev-only dropdown bound to all 12 scenarios
- [x] Create `CheckoutSuccess` -- enrolled confirmation with sim link
- [x] Create `CheckoutError` -- error display with retry/home actions and payment reference

## 5. Enrollment Integration

- [x] Wire `hasActiveEnrollment` check in checkout load and action
- [x] Wire `createEnrollment` call on payment success
- [x] Handle enrollment creation failure after successful payment (error page with payment ID)

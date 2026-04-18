---
title: "Spec: checkout-enrollment"
product: runway
feature: checkout-enrollment
type: spec
status: done
---

# Spec: checkout-enrollment

Mock payment flow and enrollment creation for the runway app. Authenticated users pay for a published course release (currently via mock provider with 12 test scenarios) and receive an active enrollment record on success.

## Data Model

Enrollment table in the `enrollment` schema (pre-existing, used by this feature):

| Column       | Type        | Notes                                                 |
| ------------ | ----------- | ----------------------------------------------------- |
| id           | text PK     | `enr_ULID` via `generateEnrollmentId()`               |
| user_id      | text FK     | References `bauth.user`, restrict delete              |
| release_id   | text FK     | References `course.release`, restrict delete          |
| status       | text        | `active`, `completed`, `withdrawn` (check constraint) |
| enrolled_at  | timestamptz | Defaults to now                                       |
| completed_at | timestamptz | Nullable                                              |

Unique index on `(user_id, release_id)` prevents duplicate enrollments per release.

Payment is in-memory only -- no persistence. `@firc/payment` manages intents via `MockPaymentProvider` with an in-memory idempotency store (LRU, max 10k entries).

## Behavior

### Checkout Page (`/checkout`)

- Load: fetches latest published release and checks active enrollment for current user
- If no release exists: shows "no content available" message
- If already enrolled: shows enrolled state with link to sim app
- Otherwise: displays order summary ($149.00), mock card info (dev), scenario selector (dev), and pay button

### Payment Submission (POST `/checkout`)

1. Validates user is authenticated (redirect to login if not)
2. Validates release exists and user is not already enrolled
3. Reads `paymentScenario` from form data (dev only; defaults to `success`)
4. Creates idempotency key: `checkout_{userId}_{releaseId}`
5. Creates payment intent via `createPaymentProvider(scenario)`
6. Confirms payment with hardcoded card details
7. On `requiresAction` -- returns form error (3DS not yet supported)
8. On failure -- redirects to `/checkout/error` with error message and code
9. On success -- creates enrollment record, redirects to `/checkout/confirm`
10. If enrollment insert fails after successful payment -- redirects to error page with `paymentId` for support reference

### Confirmation Page (`/checkout/confirm`)

- Server guard: redirects to `/checkout` if user is not authenticated, no release exists, or no active enrollment
- Displays success message with user name, release version, and link to sim app

### Error Page (`/checkout/error`)

- Reads `error`, `code`, and `paymentId` from URL search params
- Shows error message, error code, and payment reference (when enrollment failed post-payment)
- Offers retry and home links

## Validation

| Field                | Rule                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| User auth            | Required -- redirect to login if missing                                       |
| Release              | Must exist -- 400 error if no published release                                |
| Duplicate enrollment | Redirect to confirm if already enrolled                                        |
| Payment scenario     | Must be valid `PaymentScenarioId`; defaults to `success` if invalid or in prod |

## Edge Cases

- Same user retries checkout for same release -- idempotency key returns original intent (no double charge)
- Payment succeeds but enrollment insert fails -- error page shows payment ID for manual resolution
- User navigates to `/checkout/confirm` without enrollment -- redirected to `/checkout`
- 3D Secure scenario -- returns inline form error (redirect not implemented)
- `processing_delay` scenario -- payment stays pending, treated as failure

## Out of Scope

- Real payment processing (Stripe) -- Phase 4b
- Webhook handling for async payment resolution
- Receipt generation / email confirmation
- Refund UI (provider supports refunds but no UI exists)

---
title: "Test Plan: checkout-enrollment"
product: runway
feature: checkout-enrollment
type: test-plan
status: done
---

# Test Plan: checkout-enrollment

## Setup

- Dev server running (`bun run dev` in runway)
- At least one published release in the database
- Test user account (registered, logged in)

---

## CHK-001: Happy path -- successful payment and enrollment

1. Log in as test user
2. Navigate to `/checkout`
3. Verify order summary shows $149.00
4. Leave scenario selector on "Success"
5. Click "Pay $149.00"
6. **Expected:** Redirected to `/checkout/confirm` with enrolled message, sim link visible

## CHK-002: Already enrolled

1. Complete CHK-001
2. Navigate to `/checkout` again
3. **Expected:** Page shows "You're already enrolled" with link to sim app

## CHK-003: Card declined

1. Log in as new user (no enrollment)
2. Navigate to `/checkout`
3. Select "Card declined" scenario
4. Submit payment
5. **Expected:** Redirected to `/checkout/error` with "Your card was declined" message, code `card_declined`

## CHK-004: Insufficient funds

1. Select "Insufficient funds" scenario
2. Submit payment
3. **Expected:** Error page with "Insufficient funds" message

## CHK-005: 3D Secure requires action

1. Select "3D Secure" scenario
2. Submit payment
3. **Expected:** Inline form error about additional authentication required (no redirect)

## CHK-006: Network timeout

1. Select "Network timeout" scenario
2. Submit payment
3. **Expected:** Error page after ~10 second delay, code `network_timeout`

## CHK-007: Duplicate charge protection

1. Select "Duplicate charge" scenario
2. Submit payment twice rapidly
3. **Expected:** Same intent returned, only one enrollment created

## CHK-008: No published release

1. Clear all published releases from DB
2. Navigate to `/checkout`
3. **Expected:** "No course content is available yet" message

## CHK-009: Unauthenticated access

1. Log out
2. Navigate to `/checkout` and submit the form (via curl or browser dev tools)
3. **Expected:** Redirected to login

## CHK-010: Confirm page guard

1. Log out (or use user with no enrollment)
2. Navigate directly to `/checkout/confirm`
3. **Expected:** Redirected to `/checkout`

## CHK-011: Server error scenario

1. Select "Server error" scenario
2. Submit payment
3. **Expected:** Error page with "Unexpected error" message, code `server_error`

## CHK-012: Expired session scenario

1. Select "Expired session" scenario
2. Submit payment
3. **Expected:** Error page with "Session expired" message

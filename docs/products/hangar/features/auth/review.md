---
title: "Code Review: Auth"
product: hangar
feature: auth
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Auth

## UX Review

### [MEDIUM] Login page still links to disabled register route

**File:** apps/hangar/src/routes/(public)/login/+page.svelte:67
**Issue:** `AuthFooterLink` renders "No account? Create one" linking to `/register`. Registration is disabled per ADR-009. Users clicking this see a dead page.
**Recommendation:** Remove the link or replace with "Contact your administrator."

### [MEDIUM] Register page is a dead end

**File:** apps/hangar/src/routes/(public)/register/+page.svelte:13
**Issue:** "Registration is not currently available. Contact an administrator." No email, no link. No actionable path.
**Recommendation:** Either remove register route entirely, or add contact info.

### [LOW] Login password field has no show/hide toggle

**File:** apps/hangar/src/routes/(public)/login/+page.svelte:52-58
**Issue:** No password visibility toggle. Common accessibility improvement.
**Recommendation:** Add show/hide toggle to password Input.

### [LOW] Dev panel remains active during form submission

**File:** apps/hangar/src/routes/(public)/login/+page.svelte:33-38
**Issue:** `loading` disables main form but not DevLoginPanel buttons.
**Recommendation:** Pass `loading` to DevLoginPanel.

## Engineering Review

### [MEDIUM] Login footer links to disabled register route

**File:** apps/hangar/src/routes/(public)/login/+page.svelte:67
**Issue:** Same as UX finding. Engineering concern: the link creates a navigable path to a dead route, which should be cleaned up.
**Recommendation:** Remove or conditionally render.

### [LOW] `AuthUser.role` typed as `string | null` instead of `Role | null`

**File:** libs/auth/src/auth.ts:17
**Issue:** `role: string | null` accepts any string. `requireRole` casts with `user.role as Role`. Type-safe but loose.
**Recommendation:** Change to `Role | null` with runtime guard for unknown role values.

## Fix Log (2026-03-28)

### UX

- [MEDIUM] Login page links to disabled register route -- verified fixed (pre-existing)
- [MEDIUM] Register page is a dead end -- fixed in 3a75835 (placeholder admin contact email added)
- [LOW] No password show/hide toggle -- fixed in 5e46db3 (PasswordInput component)
- [LOW] Dev panel active during form submission -- accepted, Phase 2 appropriate (dev-only, buttons fill fields)

### Engineering

- [MEDIUM] Login footer links to disabled register route -- verified fixed (pre-existing)
- [LOW] `AuthUser.role` typed as `string | null` instead of `Role | null` -- verified fixed (pre-existing)

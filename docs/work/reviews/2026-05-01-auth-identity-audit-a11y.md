---
feature: auth-identity-audit
category: a11y
date: 2026-05-01
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 2
  minor: 5
  nit: 4
  total: 11
---

## Status as of 2026-05-04

Walked every finding against current main login pages. All 11 closed.

| Severity | Finding                                               | Verdict                                                                                        |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| MAJOR    | Submit failure does not move focus                    | CLOSED -- `enhance` callback focuses password input on `result.type === 'failure'` (both apps) |
| MAJOR    | H1 does not describe the page                         | CLOSED -- "Sign in to airboss study" / "Sign in to airboss hangar" H1                          |
| MINOR    | Dev-account quick-fill buttons stay enabled on submit | CLOSED -- `disabled={loading}` on each `.dev-btn` (study:106, hangar:104)                      |
| MINOR    | Dev-button focus ring kills native outline            | CLOSED -- `outline: 2px solid transparent; outline-offset: 2px` preserves forced-colors ring   |
| MINOR    | Dev hint password text uses `--ink-faint`             | CLOSED -- hangar no longer renders the dev password to screen at all                           |
| MINOR    | Loading state on submit not announced to AT           | CLOSED -- `<span class="sr-only" aria-live="polite">{loading ? 'Signing in...' : ''}</span>`   |
| MINOR    | Email input retains stale value on failure            | CLOSED -- `invalid={!!form?.error}` on both inputs threads `aria-invalid`                      |
| NIT      | Title uses double-hyphen instead of single-hyphen     | CLOSED -- `<title>Sign in - airboss study</title>` / `Sign in - airboss hangar`                |
| NIT      | `<header class="hd">` adds extra landmark             | CLOSED -- replaced with `<div class="hd">` in both pages                                       |
| NIT      | Required asterisk has no programmatic legend          | CLOSED -- low priority on a 2-field form; both fields are required, native `required` covers   |
| NIT      | `<svelte:head>` title is the only place page named    | CLOSED -- subsumed by H1 fix above                                                             |

## Summary

## Summary

Reviewed the two login pages in scope (`apps/study/src/routes/login/+page.svelte`,
`apps/hangar/src/routes/login/+page.svelte`). Both logout routes are server-only
(`+page.server.ts`, no `+page.svelte`), so they have no UI surface to audit. No
auth-specific Svelte components live under `apps/*/src/lib/`.

The login pages share a near-identical implementation and lean on three well-built
primitives -- `TextField`, `Button`, `Banner` (`libs/ui/src/components/`). Those
primitives carry most of the a11y weight correctly: labels are associated via
`for=`/`id`, `aria-invalid`/`aria-describedby` wiring exists, the danger Banner
gets `role="alert"`, and inputs use proper `autocomplete` tokens. The form is
semantically a `<form>` inside `<main>` with an `<h1>`, all reachable by Tab in a
sensible order.

Issues cluster around three themes:

1. **Failed-submit focus management.** After a server-returned error, focus stays
   on the submit button. The Banner has `role="alert"` so screen readers will hear
   it, but sighted keyboard users get no signal that anything new appeared, and
   the email/password fields are not re-focused.
2. **Heading semantics.** The `<h1>` says only "airboss", not the page purpose
   ("Sign in"). The actual page-purpose string lives only on the submit button.
3. **Dev-affordance polish.** The dev-account buttons remain enabled during a
   submit-in-flight, the focus ring uses `outline: none` + `box-shadow` (works,
   but loses the system-level high-contrast outline), and small `--ink-faint`
   text in the hangar dev hint risks failing 4.5:1 contrast.

No critical blockers. Issues are real but the page is usable today.

## Issues

### MAJOR: Submit failure does not move focus to the error or first invalid field

**File:** `apps/study/src/routes/login/+page.svelte:37-51`,
`apps/hangar/src/routes/login/+page.svelte:35-49`

**WCAG:** 3.3.1 Error Identification (A), 2.4.3 Focus Order (A)

**Problem:** When the server-side action returns `{ error }`, the page re-renders
with a `<Banner tone="danger">` above the form. The `enhance` callback only flips
`loading = false` and calls `update()`. Focus is never moved -- it stays on the
submit button. Sighted keyboard users get no indication that the page changed
above their viewport position. Screen reader users hear the alert (Banner has
`role="alert"`), but the email input retains its server-seeded value while the
password is silently cleared, and the user must hunt back up the form.

**Fix:** After `update()`, move focus either to the Banner (give it `tabindex="-1"`
and `.focus()` it) or to the first invalid field (the password input is the most
likely culprit on a generic auth failure). Pattern:

```ts
use:enhance={() => {
  loading = true;
  return async ({ update, result }) => {
    loading = false;
    await update();
    if (result.type === 'failure') {
      // focus the password input (most likely culprit), or focus the banner
      document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
    }
  };
}}
```

### MAJOR: H1 does not describe the page

**File:** `apps/study/src/routes/login/+page.svelte:33-35`,
`apps/hangar/src/routes/login/+page.svelte:31-33`

**WCAG:** 2.4.6 Headings and Labels (AA), 1.3.1 Info and Relationships (A)

**Problem:** The `<h1>` is "airboss" with a `<p class="sub">` of "study"/"hangar".
Nothing in the heading tree tells AT users this is the sign-in page; the only
"Sign in" string is the submit button label. Screen reader heading navigation
(H key) lands on a brand mark, not a page title.

**Fix:** Either change the H1 to "Sign in to airboss study" / "Sign in to airboss
hangar", or keep the brand mark visually but add an SR-only H1 ("Sign in"). The
former is simpler and matches the document `<title>`. The brand mark can become
a smaller `<p>` or a visually-styled span without heading semantics.

### MINOR: Dev-account quick-fill buttons stay enabled during submit

**File:** `apps/study/src/routes/login/+page.svelte:86-97`,
`apps/hangar/src/routes/login/+page.svelte:84-95`

**WCAG:** 3.2.2 On Input (A) (in spirit -- avoid unexpected state changes mid-flow)

**Problem:** While `loading === true`, the email input, password input, and submit
button are all disabled, but the dev-account quick-fill buttons are not. A user
who Tab-cycles back during a slow submit can click one and silently mutate the
about-to-be-submitted credentials. The visible UI also mismatches: everything
looks frozen except these buttons.

**Fix:** Add `disabled={loading}` to each `<button class="dev-btn">`. When the
button is disabled, `aria-disabled` is automatic via the native `disabled`
attribute, and pointer/keyboard activation is blocked.

### MINOR: Dev-button focus ring kills the native outline

**File:** `apps/study/src/routes/login/+page.svelte:199-202`,
`apps/hangar/src/routes/login/+page.svelte:195-198`

**WCAG:** 2.4.7 Focus Visible (AA), 1.4.11 Non-text Contrast (AA)

**Problem:** `.dev-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus-ring); }`
removes the native browser outline and replaces it with a 3px box-shadow ring.
This works for typical themes, but:

1. In Windows High Contrast Mode and forced-colors mode, `box-shadow` is
   discarded while `outline` is preserved. Removing the outline leaves users in
   forced-colors mode with no focus indicator at all.
2. The 4.5:1 contrast of `--focus-ring` against `--surface-sunken` is not
   guaranteed to hit the 3:1 non-text contrast requirement across every theme.

**Fix:** Replace `outline: none` with `outline: 2px solid transparent;
outline-offset: 2px;` so forced-colors mode renders a visible system focus
outline, while themes still draw the box-shadow ring on top. Or just use the
same `outline: 2px solid var(--focus-ring); outline-offset: 2px` pattern that
`Button` and `TextField` already use -- consistency with sibling primitives.

### MINOR: Dev hint password text uses `--ink-faint` (contrast risk)

**File:** `apps/hangar/src/routes/login/+page.svelte:97-99,212-217`

**WCAG:** 1.4.3 Contrast (Minimum) (AA)

**Problem:** `.dev-hint` is rendered at `--type-ui-caption-size` (small text) in
`--ink-faint`. "Faint" tokens are typically the lowest-contrast ink in a system,
intended for de-emphasized auxiliary text. For text below 18px / 14px-bold the
required ratio is 4.5:1 -- "faint" tokens are often tuned to ~3:1 or lower for
visual hierarchy. The study login does not show the password and so does not
have this issue.

**Fix:** Use `--ink-subtle` or `--ink-muted` for `.dev-hint`, and verify the chosen
token clears 4.5:1 against `--surface-raised` in every theme that ships this
page. Alternatively, drop the visible password from the UI entirely (study does
this and is cleaner) -- the dev-account buttons already pre-fill it.

### MINOR: Loading state on submit is not announced to AT

**File:** `apps/study/src/routes/login/+page.svelte:71-80`,
`apps/hangar/src/routes/login/+page.svelte:69-78`,
`libs/ui/src/components/Button.svelte:98-115`

**WCAG:** 4.1.3 Status Messages (AA)

**Problem:** When `loading = true`, the Button text swaps from "Sign in" to
"Signing in...". The button itself has no `aria-live` region, and a button's
accessible-name change is not consistently re-announced by screen readers (NVDA
will announce the new name on next focus-event but not in-place; VoiceOver
behavior varies). Users with screen readers may not realize the submit is in
flight, especially since the button is also `disabled` (which moves it out of
some Tab sequences).

**Fix:** Add a visually-hidden `aria-live="polite"` status region next to the
form that announces "Signing in..." when `loading` flips true and is cleared on
completion. Or, in `Button`, expose `aria-busy={loading}` so AT can detect the
state. Simplest: a sibling `<span class="sr-only" aria-live="polite">{loading ?
'Signing in...' : ''}</span>`.

### MINOR: Email input retains stale value but no announcement of which field caused failure

**File:** `apps/study/src/routes/login/+page.svelte:37-39,52-61`,
`apps/hangar/src/routes/login/+page.svelte:35-37,50-59`

**WCAG:** 3.3.1 Error Identification (A)

**Problem:** On failed submit, the Banner says generically "Invalid email or
password" (or similar -- depends on server). Neither the email nor the password
input gets `aria-invalid="true"` or a per-field `error=` prop. Screen readers
hear the form-level alert but find no field-level marking when they navigate
back into the form. WCAG 3.3.1 wants the error tied to the offending field
where possible.

**Fix:** Either pass `error={form?.error ? ' ' : ''}` to whichever field is
known-bad, or pass a generic `aria-invalid` to both inputs while the
form-level error is present. If the server can't distinguish which field is
bad (typical for security reasons on auth), at minimum mark the password
field invalid -- it's the more sensitive one and the most likely culprit
on a generic auth failure.

### NIT: Title uses double-hyphen instead of em-dash or single-hyphen

**File:** `apps/study/src/routes/login/+page.svelte:26`,
`apps/hangar/src/routes/login/+page.svelte:24`

**WCAG:** 2.4.2 Page Titled (A) (in spirit)

**Problem:** `<title>Sign in -- airboss</title>` -- the "--" pattern matches the
project rule against em-dash (good) but reads literally as "hyphen hyphen" or
similar in some screen readers / terminal-based AT.

**Fix:** Use a single `-` or a colon: `Sign in - airboss` or `Sign in: airboss
study`. Cosmetic for sighted users; cleaner SR speech.

### NIT: `<header class="hd">` adds an extra landmark inside `<main>`

**File:** `apps/study/src/routes/login/+page.svelte:32-35`,
`apps/hangar/src/routes/login/+page.svelte:30-33`

**WCAG:** 1.3.1 Info and Relationships (A)

**Problem:** `<header>` inside `<section>` inside `<main>` creates a `banner`
landmark in some browsers' heuristics (the rule is "header outside any
sectioning content" produces banner; inside it produces a generic header). On a
single-form page, even a generic header is noisy -- AT users navigating by
landmark see an extra stop with no real content.

**Fix:** Replace `<header class="hd">` with `<div class="hd">`. The `<h1>` and
`<p>` inside it are not strengthened by header semantics.

### NIT: Required asterisk uses `aria-hidden` correctly but no programmatic indication beyond `required`

**File:** `libs/ui/src/components/TextField.svelte:70-73`

**WCAG:** 3.3.2 Labels or Instructions (A)

**Problem:** The visible `*` is `aria-hidden`, and the input has `required`. This
is fine for most AT, but the visible `*` has no in-page legend explaining "*
means required". A first-time user with a screen magnifier sees `*` and the
context is lost.

**Fix:** Optional -- add a small once-per-form note ("Fields marked * are
required") visually-hidden or visible. Lowest priority on a 2-field auth form
where both fields are required and the required attribute does the announcing.

### NIT: `<svelte:head>` title is the only place the page is named in the DOM

**File:** `apps/study/src/routes/login/+page.svelte:25-27`,
`apps/hangar/src/routes/login/+page.svelte:23-25`

**WCAG:** 2.4.6 Headings and Labels (AA)

**Problem:** Tied to the H1 finding above. If the H1 stays as "airboss", at
minimum add an `aria-labelledby` on the form pointing at a SR-only label that
says "Sign in form", so users navigating by form landmark know what the form
does. This is redundant once the H1 is fixed.

**Fix:** Fix the H1 (see MAJOR finding) and this becomes moot. If the H1 stays
as branding, add `aria-label="Sign in"` to the `<form>` element.

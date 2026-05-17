---
title: Foundation libraries review
date: 2026-05-17
branch: worktree-agent-a3a2cd7fe2cb5f29d
scope: libs/{constants,ui,themes,auth,db,types,utils,audit}
status: unread
review_status: done
---

# Foundation libraries review (2026-05-17)

Multi-angle review of the eight shared-foundation libraries (~46k LOC) that
every app imports: `constants`, `ui`, `themes`, `auth`, `db`, `types`,
`utils`, `audit`. Angles covered: correctness, type safety, security,
architecture / BC boundaries, browser-safety, pattern compliance,
performance, accessibility, test quality.

## Summary

The foundation is in strong shape. The auth, db, and audit code is
extensively documented, fails closed, and the browser-safe / server-only
barrel splits (`@ab/audit` vs `@ab/audit/server`) are correctly maintained.
No `any`, no non-null assertions, no static `node:*` imports in
browser-bundled libs, no Svelte 4 legacy in `libs/ui`, no inline route
strings. The `renderMarkdown` pipeline escapes inline text and runs HTML
blocks through `sanitizeInlineHtml` -- the `{@html}` surfaces it feeds are
safe by construction.

Findings were a small set, all fixed in this branch.

## Findings (all fixed)

### F1 -- Token-fallback hex literals in `libs/ui/notes/*` (minor, convergent)

Severity: minor. Six components in `libs/ui/src/components/notes/`
(`NoteContextChips`, `FollowUpBadge`, `NoteComposer`, `NoteCard`,
`TagChipInput`, `NoteDetail`) carried `var(--token, #hexfallback)`
declarations -- e.g. `color: var(--signal-warning, #b45309)` and
`color-mix(in srgb, var(--signal-warning, #d97706) 12%, transparent)`.

Root cause: the family was authored before the `--signal-*`, `--radius-pill`,
`--font-size-lg/xl`, `--shadow-md` tokens were emitted. Those tokens now all
exist in `libs/themes/generated/tokens.css`, so the hex fallbacks are dead
token holes.

Why theme-lint missed them: `tools/theme-lint/rules.ts` `stripVarCalls()`
discards the entire `var(...)` expression -- including the fallback -- before
scanning a declaration for hex literals. A hex inside a `var()` fallback is
invisible to the linter. CLAUDE.md / common-pitfalls explicitly call
`var(--ab-color-X, #...)` a token hole to grep for.

Fix: stripped every fallback. Tinted backgrounds that re-invented a wash via
`color-mix(...)` now use the canonical paired `--signal-*-wash` /
`--signal-*-ink` tokens.

### F2 -- Raw `window.confirm()` for a destructive action (major)

Severity: major. `NoteDetail.svelte` deleted a note through a raw
`window.confirm()` call inside a form `onsubmit` handler. CLAUDE.md and
common-pitfalls forbid `window.confirm()` for destructive actions:
destructive UI must use the `<ConfirmAction>` primitive, which ships focus
management (focus moves to Confirm on reveal, back to trigger on cancel),
Escape / click-outside cancel, and a `formAction` mode that degrades without
JS.

Fix: replaced the hand-rolled delete form with `<ConfirmAction
formAction="...?/delete" confirmVariant="danger">`. Removed the now-orphaned
`.btn.danger` CSS rule. No other code referenced the old
`note-detail-delete` testid.

### F3 -- `auditRecent` fed an unclamped `limit` into SQL (major)

Severity: major. `libs/audit/src/log.ts` `auditRecent` did
`const limit = input.limit ?? 10` and passed the value straight into the
Drizzle `.limit()` clause. A caller passing a negative, `NaN`, `Infinity`,
or unbounded value would either error at the postgres driver or trigger an
unbounded scan. Common-pitfalls: every list helper needs an explicit default
AND an enforced cap in the BC. `libs/bc/hangar` already clamps its audit
list via `clampAuditLimit`; this generic helper did not.

Fix: clamp to `[1, AUDIT_LIST_HARD_CAP]` (the constant already exists in
`@ab/constants`), non-finite input falls back to the default of 10.

### F4 -- Magic-string id prefixes where constants exist (minor)

Severity: minor. `libs/utils/src/ids.ts` `generateReferenceId`,
`generateReferenceSectionId`, `generateReferenceFigureId`,
`generateReferenceSectionErrataId` used inline string literals (`'ref'`,
`'refsec'`, `'reffig'`, `'refera'`) while `REFERENCE_*_ID_PREFIX` constants
exist in `@ab/constants` for exactly these prefixes (and their docstring
says "composed via `@ab/utils createId`"). Drift risk: the constant and the
literal could disagree.

Fix: routed the four generators through the constants. (The remaining
literal prefixes -- `'crd'`, `'rev'`, etc. -- have no corresponding constant
defined; left as-is, out of scope for this pass.)

### F5 -- `redactSensitive` docstring drift (nit)

Severity: nit. `libs/utils/src/redact.ts` top docstring listed `key` as a
redacted pattern, but `SENSITIVE_KEY_RE` deliberately only matches the
`api_key` / `private_key` prefixed forms (a bare `key` would redact
`keyboardShortcut`). Fixed the docstring to match the code and document why
a bare `key` is intentionally excluded.

## Verified clean (no action)

- No `any`, no `as any`, no `!.` non-null assertions across the eight libs.
- No static `node:*` imports in browser-bundled libs. `process.env` use is
  confined to files tagged `// @browser-globals: server-only` (`env.ts`,
  `logger.ts`, `source-cache.ts`) -- the documented escape hatch.
- `libs/auth` is server-only (not in the browser-safe list); the runtime
  barrel exporting `createAuth` is acceptable. `libs/audit` correctly splits
  `@ab/audit` (browser-safe: constants, types, Drizzle tables) from
  `@ab/audit/server` (DB-touching values).
- Auth security: `parseRole` fails closed on unknown strings; `requireAuth` /
  `requireRole` capture-and-return the user; `isSafeRedirect` has a
  defense-in-depth open-redirect guard (char allowlist + parse-against-
  placeholder); cookies are `httpOnly` + `sameSite=strict` + `secure` in
  prod; `parseCookieMaxAge` preserves per-cookie TTL so the short-lived
  cookie-cache (ban / role-change propagation channel) is not extended.
- `auditWrite` validates `targetType` against `AUDIT_TARGET_VALUES` and
  throws `InvalidAuditTargetError`; `auditRecent` always filters by
  `targetType`.
- `inList` (libs/db) and `escapeLikePattern` (libs/db) escape correctly --
  no SQL-injection surface.
- `renderMarkdown` / `renderInline` escape HTML; HTML blocks run through
  `sanitizeInlineHtml`.
- `libs/ui`: no Svelte 4 legacy, all `{#each}` keyed (index keys only on
  positionally-stable lists), `ConfirmAction` honors the documented focus
  contract.

## Test status

Pure unit tests pass (narrow, redact, cookies, redirect, etc.). 12 failures
in the libs are DB-integration tests (`auth` sign-out / rate-limit,
`audit/log.test.ts`, auth-hooks-integration) that require a live PostgreSQL;
they fail with `Cannot access 'db' before initialization` in an environment
without `DATABASE_URL`. These are pre-existing environmental failures, not
regressions from this branch.

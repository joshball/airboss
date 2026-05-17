---
title: Foundation libraries review -- second pass
date: 2026-05-17
branch: worktree-agent-aae2947d6aab378e6
scope: libs/{constants,ui,themes,auth,db,types,utils,audit}
status: unread
review_status: done
---

# Foundation libraries review -- second pass (2026-05-17)

Independent second 10x-style review of the eight shared-foundation
libraries (~46k LOC). PR #1050 ran the first pass (token holes in
`libs/ui/notes/*`, a `window.confirm` -> `ConfirmAction` swap, an
`auditRecent` limit clamp, four id-prefix constants, a docstring fix).
This pass approached the foundation fresh and looked harder at the areas
the first pass either summarized as "verified clean" or did not reach.

## Summary

The first pass was substantively correct on auth, db, and audit: the
open-redirect guard, role parsing, cookie TTL preservation, SSRF
validator, and SQL `LIKE` escaping all hold up under a second read. It
also genuinely cleared `any`, non-null assertions, and Svelte 4 legacy.

What it missed is a **convergent a11y defect** and a **markdown
correctness bug**:

1. The first pass said `libs/ui` components "honor the documented focus
   contract" and stopped there. It did not audit per-instance `id`
   uniqueness. Five components (`Checkbox`, `FormField`, `InfoTip`,
   `MetricExplainer`, `PanelShell`) derive DOM `id` attributes by
   slugifying user-visible text (label / term / title). `Select`,
   `TextField`, `ConfidenceSlider`, `CitationPicker`, and
   `SnoozeReasonPopover` already moved to `$props.id()` for exactly this
   reason -- `Select`'s own code comment documents the collision it fixed.
   The migration stopped at five components; the other five still ship
   the bug. Two `Checkbox`es with the same label, or two `FormField`s
   with the same label, produce duplicate `id`s: clicking one `<label>`
   focuses the wrong control, and `aria-describedby` can point at the
   wrong field's error. This is a WCAG 4.1.1 (parsing) violation and a
   real keyboard/AT defect.

2. `renderMarkdown` double-escapes ampersands (and `<`, `>`) inside link
   URLs. `renderInline` HTML-escapes the whole input first, then the link
   pass calls `escapeAttr` on the already-escaped URL. A link to
   `https://example.com/x?a=1&b=2` renders as
   `href="...?a=1&amp;amp;b=2"`, which a browser decodes to a literal
   `&amp;b=2` -- a corrupted query string and a broken link. Block images
   escape exactly once and are correct; the inline-link path is the only
   double-escaper.

All eight findings are fixed in this branch. No `BLOCKER`.

## Findings (all fixed)

### F1 -- `renderMarkdown` double-escapes URLs in inline links (major)

Severity: major. `libs/utils/src/markdown.ts` `renderInline` runs
`escapeHtml(text)` over its entire input before any inline pass. The
link pass then matches `[label](url)` against the already-escaped
string and calls `escapeAttr(safe)` on the captured `url` -- escaping it
a second time. An `&` in the source URL becomes `&amp;` after
`escapeHtml`, then `&amp;amp;` after `escapeAttr`.

Reproduction (pre-fix):

```text
renderMarkdown('See [the chart](https://example.com/x?a=1&b=2) here.')
-> <a href="https://example.com/x?a=1&amp;amp;b=2">
```

The browser decodes that `href` to `...?a=1&amp;b=2`, so the second
query parameter is named `amp;b`, not `b`. Every markdown link with a
query string ships a broken URL.

Root cause: the URL captured by the link regex is already HTML-escaped
(the regex runs on the post-`escapeHtml` string), so `"`/`<`/`>` cannot
appear raw and the second escape pass is pure corruption. Block images
(`tryImageBlock`) build their buffer from the raw, un-escaped lines and
escape exactly once -- which is why they were correct and links were not.

Fix: drop the redundant `escapeAttr` call in the link pass. The URL is
already escaped once by `escapeHtml`; the protocol allow-list still runs
against the escaped form (`https://`, `/`, `#`, `mailto:` carry no
escapable characters). The `<code>`, `<strong>`, `<em>` passes were
already single-escape and are unchanged.

### F2 -- `Checkbox` label-derived id collides across instances (major, convergent)

Severity: major. `libs/ui/src/components/Checkbox.svelte` computed its
fallback id as `cb-${label.replace(/\s+/g, '-').toLowerCase()}`. Two
checkboxes with the same visible label (e.g. an "Include archived"
filter rendered twice on one page) produce the same `id`. The wrapping
`<label for={id}>` then associates with whichever input the browser
finds first, so clicking the second checkbox's label toggles the first.

Fix: switched the fallback to `$props.id()`, matching `Select`,
`TextField`, and `ConfidenceSlider`. An explicit `id` prop still wins.

### F3 -- `FormField` label-derived id collides across instances (major, convergent)

Severity: major. `libs/ui/src/components/FormField.svelte` derived
`idBase` from the label text and built `helpId` / `errorId` /
`describedBy` from it. Two `FormField`s with the same label collide on
all four ids: the `<label for>` breaks, and -- worse -- the `aria-
describedby` handed to the control snippet can point at the *other*
field's error message. A screen-reader user hears the wrong validation
text.

Fix: `idBase` now falls back to `$props.id()` when no `for` prop is
supplied. All derived ids inherit the per-instance uniqueness.

### F4 -- `InfoTip` term-derived id collides across instances (major, convergent)

Severity: major. `libs/ui/src/components/InfoTip.svelte` built
`popoverId` from the glossary term and `titleId` from `popoverId`. The
same term used twice on a page (the doc literally notes "the home page
mounts `goal` three times" in the sibling `Tooltip` component) yields
duplicate `id`s. The trigger's `aria-controls` then resolves to the
first popover, and `aria-labelledby` is ambiguous.

Fix: `popoverId` now derives from `$props.id()`. `Tooltip` already
solved the same problem with a module-scoped counter; `$props.id()` is
the newer in-repo convention (five components) so InfoTip aligns with
that.

### F5 -- `MetricExplainer` label-derived id collides across instances (major, convergent)

Severity: major. `libs/ui/src/components/MetricExplainer.svelte` built
`popoverId` from the metric label. A dashboard rendering the same metric
label in two places (a per-row tile and a summary tile) duplicates the
`role="dialog"` popover `id`, so the trigger's `aria-controls` is
ambiguous.

Fix: `popoverId` derives from `$props.id()`.

### F6 -- `PanelShell` title-derived id collides across instances (minor, convergent)

Severity: minor. `libs/ui/src/components/PanelShell.svelte` derived the
`<h2>` `id` (and the panel's `aria-labelledby`) from the title text.
Two panels with the same title (e.g. two "Recent activity" panels on a
multi-column admin layout) duplicate the heading `id`, so the region's
accessible name is ambiguous.

Fix: `slugId` derives from `$props.id()`.

### F7 -- `redactSensitive` leaks the live object on a reference cycle (minor)

Severity: minor. `libs/utils/src/redact.ts` `redactSensitive` tracks
visited objects to guard against cycles, but on a cycle hit it returns
the *original* object reference (`return v`). That object is unredacted
and is a live reference into the caller's input -- so a cyclic payload
both (a) skips redaction for the cyclic subtree and (b) aliases caller
state into the "redacted" copy, breaking the function's structural-copy
contract.

Audit `metadata` is always JSON (acyclic) so this never fires in
practice, but `redactSensitive` is explicitly defense-in-depth for
"arbitrary `metadata` blobs"; a defense layer that fails open on its own
guard branch is a stub. Fixed to return the `REDACTED_PLACEHOLDER`
string on a cycle -- safe, and never aliases caller state.

### F8 -- Dialog close glyph not `aria-hidden`, inconsistent with Drawer (nit)

Severity: nit. `Drawer.svelte` renders its close glyph as
`<span aria-hidden="true">&times;</span>` inside an `aria-label`led
button. `Dialog.svelte` renders the same glyph as bare text content
(`{DIALOG_CLOSE_GLYPH}`). Both buttons get their accessible name from
`aria-label`, so the functional behavior matches, but the bare glyph is
exposed in the accessibility tree as button text on engines that
concatenate; wrapping it in `aria-hidden` is the documented pattern and
keeps the two primitives consistent.

Fix: Dialog wraps the glyph in `<span aria-hidden="true">`, matching
Drawer.

## Verified clean (no action -- confirms first pass)

- `isSafeRedirect`: the char-allowlist + parse-against-placeholder guard
  rejects `//evil`, `/%2f`, backslash, CR/LF, and Unicode smuggling. Holds.
- `validateOutboundUrl` (SSRF): scheme allow-list, literal-IP denylist,
  and resolve-every-DNS-record checks are correct. IPv4-mapped /
  IPv4-compatible IPv6 forms are re-checked against the v4 denylist.
  Decimal-IP shorthand (`http://2130706433/`) is not literal-IP-detected
  but is caught downstream because `dns.lookup` resolves it to
  `127.0.0.1` and the per-record check denies it.
- `escapeLikePattern`: escapes `\`, `%`, `_` -- no `LIKE` wildcard
  injection.
- `parseRole` fails closed; `parseCookieMaxAge` preserves per-cookie TTL
  so the short-lived `bauth_session_data` cookie-cache is not extended;
  `requireAuth` / `requireRole` capture-and-return the user.
- `auditWrite` validates `targetType`; `auditRecent`'s limit clamp (from
  PR #1050) is correct.
- `sanitizeInlineHtml`: tag-walk allow-list, script-like tags swallowed
  whole, attributes filtered per-tag, comments stripped. The `{@html}`
  surfaces it feeds are safe.
- No `any`, no non-null assertions, no static `node:*` imports in
  browser-bundled libs. `process` usage is confined to function bodies
  in files tagged `// @browser-globals: server-only` (`env.ts`,
  `logger.ts`, `wx-*-paths.ts`, `source-cache.ts`, `outbound-url.ts`).
- `Dialog` / `Drawer` / `ConfirmAction` / `Tabs` focus management,
  roving tabindex, Escape, and click-outside contracts are intact.
- `it.skip` in `themes/__tests__/contrast-matrix.test.ts` is a
  deliberate advisory-tracking pattern (promotes to `it` when the bar is
  met), not a dead test.

## Test status

Pure unit tests pass. DB-integration tests in `libs/auth` and
`libs/audit` require a live PostgreSQL and fail in an environment
without `DATABASE_URL` -- pre-existing environmental failures, not
regressions from this branch (same as the first pass noted).
</content>

---
feature: ui-library-themes
category: correctness
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 4
  minor: 9
  nit: 3
closed_out: 2026-05-04
---

## Summary

The UI library, themes, activities, and help library are largely well-engineered with thoughtful state ownership, focus management, and pure-function extractions for testability. The most consequential issues cluster around stuck-state under race/edge conditions (CitationPicker `loading` flag, PageHelp param sync), parser/escape inconsistencies (markdown `findUnescaped`, query-parser tokenizer), and a handful of input-binding edge cases (PFD heading default of 360 outside max, Tabs Home/End mixing rAF with sync focus). No data-loss or corruption hazards were found.

## Issues

### MAJOR: CitationPicker leaves `loading=true` when user switches to External-Ref tab during in-flight fetch

File: `libs/ui/src/components/CitationPicker.svelte:99-140`

Problem: `runSearch` only resets `loading = false` in its `finally` when `targetType === activeType`. If a search is in-flight when the user switches tabs, the late-resolving fetch sees `targetType !== activeType` and leaves `loading` stuck at `true`. The effect at line 99 short-circuits when the user switches to `EXTERNAL_REF` (line 102 early return clears `results` but does not reset `loading`), and then never starts a new search to clear the flag. Switching back to a search-backed tab keeps the spinner showing "Loading..." indefinitely until a new keystroke triggers a fresh fetch.

Trigger: type a query, see results render, switch to External-Ref tab while the fetch is still pending, switch back to the original tab. Spinner persists.

Fix: in the effect at line 99, when entering the External-Ref branch, also clear `loading = false`. Better: track an in-flight request id (incrementing counter) and treat a stale id as "drop" without referencing `activeType` in the finally — set `loading = false` only when the resolved id matches the latest. That also fixes the symmetric case where two rapid keystrokes overlap.

### MAJOR: Markdown `findUnescaped` consumes a backslash even when next char is not escapable, causing parser drift inside emphasis runs

File: `libs/help/src/markdown/inline.ts:131-143` (interaction with lines 53-60)

Problem: `parseInlineUntil` only treats `\<c>` as an escape when `c` is in the `ESCAPABLE` set; otherwise the `\` is kept verbatim as text. But `findUnescaped` (used to locate closing `**` / `*`) skips two chars on every `\`, regardless of what follows. The two functions disagree, so the closing-delimiter scan can step over a real `*` (or `**`) inside otherwise-literal content. Example: input `*foo \z bar*` — `parseInlineUntil` would treat the `\` as literal text and find the closing `*` at index of last `*`. `findUnescaped`, however, treats `\z` as an escape, advances past `z`, and continues searching. The two scans return different positions. In the worst case the closing `*` is missed and the entire run is rendered as literal text.

Trigger: emphasis containing a backslash followed by any non-escapable character (`\n` notation in prose, `\z`, `\d`, etc.).

Fix: align the escape predicate. `findUnescaped` should call the same `ESCAPABLE.has(next)` check before advancing two chars; otherwise advance one. The same fix is needed in `splitTableRow` (`block.ts:351-365`) which unconditionally advances on `\`.

### MAJOR: Query-parser tokenizer keeps backslash-escapes verbatim then unescapes inconsistently — quoted facet values misinterpreted

File: `libs/help/src/query-parser.ts:88-130`

Problem: `tokenize` accumulates `\<c>` (where c is `:`, `,`, or `\`) verbatim into the bare-token text (`out += '\\' + next`), then `tryParseFacet` calls `firstUnescapedColon` and `splitValues` on the still-escaped text, then `unescapeToken` removes the backslashes. This works for `tag:foo\,bar` (one value `foo,bar`). But the bare-token branch in `parseInlineUntil`-style is asymmetric with quoted tokens: a quoted token like `"weather metar"` is pushed to `freeTextPieces` directly, and a bare `tag:value` containing `\,` works. However, when an authored query reads `tag:"weather, ifr"`, the quoted run becomes a single `freeText` token (`weather, ifr`), not a facet — quoted values inside a facet are documented as "NOT supported" but the tokenizer still advances past the quote inside a bare-token (line 113 `if (/\s/.test(ch)) break;` does not break on `"`), so the input `tag:foo"bar baz"` produces a bare token `tag:foo"bar` and then a separate quoted token containing `baz`, splitting one logical value across two tokens silently.

Additional issue: an unterminated quote (`"foo`) is captured as the empty quoted token plus the rest of input as a quoted text running to end of string (line 102 `while (end < n && raw[end] !== '"') end += 1; ... i = end < n ? end + 1 : end`). When end === n the slice is `raw.slice(start, n)`, which is the full unterminated tail. There's no error; the user gets unexpected behavior with no feedback.

Trigger: an author types `tag:"x y"` or `"unterminated`. The first silently fragments; the second silently swallows the rest of the query as one phrase.

Fix: have the bare-token loop break on `"` as well as whitespace; emit a clearer error (or fall back to literal `"` + continue) when an opening quote has no matching close. Document the actual behavior in the grammar comment.

### MAJOR: PFD heading binding has `default: 360` but `max: 359`, so first nudge clamps to 359 even from the default

File: `libs/activities/src/pfd/pfd-tick.svelte.ts:94-106` and `123-130`

Problem: The `HEADING` binding declares `min: 0, max: 359` but `default: 360`. `DEFAULT_PFD_VALUES.headingDeg` is also `360`. The `updateTarget` switch for `HEADING` (line 299-302) wraps via `(((next.headingDeg + delta) % 360) + 360) % 360` which is correct independently of the binding's clamp. But any code path that uses `clamp(value, binding.min, binding.max)` for heading (currently only the slider-style inputs binding could) would clamp 360 to 359 and lose the conventional "due north as 360" presentation. Also, a slider input bound to this binding would render 360 as out-of-range and immediately snap to 359 on first interaction.

Trigger: any UI widget that respects the binding's min/max for heading and reads the default. The PFD itself wraps via `lowPassStepHeading`, which works on any number, so this is only latent today — but the contract is internally inconsistent.

Fix: pick one convention. Either (a) treat heading as `[0, 360)` everywhere — set `default: 0` (rendered as 360 by the instrument when desired, e.g. `headingForLabel`) and leave `max: 359`; or (b) treat heading as `[0, 360]` with 0 and 360 aliased — set `max: 360`. Option (a) is more standard. The PFD `HeadingIndicator.svelte:43` already does exactly this aliasing in display: `Math.round(heading) === 0 ? 360 : Math.round(heading)`, so the underlying data should be 0.

### MINOR: PFD airspeed binding `requiresShift: true` blocks `=` key (no-shift produces `=`, shift produces `+`)

File: `libs/activities/src/pfd/pfd-tick.svelte.ts:69-80` and `269-282`

Problem: `applyPfdKeyboardEvent` requires `event.shiftKey === binding.requiresShift` strictly. The airspeed binding sets `requiresShift: true` and `incKeys: ['+', '=']`. On a US layout, pressing the `=` key without shift produces `=`; pressing it with shift produces `+`. The strict check means `=` is never matched (event.shiftKey is false but binding requires true), and `+` is the only working increment. If the user presses `=` expecting a non-shift increment, nothing happens. Same issue in reverse for `decKeys: ['_', '-']` — `-` requires no shift but binding requires shift.

Trigger: user presses `=` (no shift) or `-` (no shift) expecting airspeed change.

Fix: split airspeed into two bindings (one with `requiresShift: true`, keys `['+', '_']`; one with `requiresShift: false`, keys `['=', '-']`), or relax the predicate so `requiresShift` means "if true, must be shift; if false, either" instead of strict equality. The current model can't express "this physical key with or without shift produces equivalent intent."

### MINOR: `attachPfdTickLoop` resumes from a stale `lastTimestampMs` after long visibility-hidden pauses

File: `libs/activities/src/pfd/pfd-tick.svelte.ts:215-258`

Problem: `start()` sets `lastTimestampMs = performance.now()` only when `rafId === 0` (line 232). On `visibilitychange` -> visible, `start()` is called and resets the timestamp. So far so good. But the very first frame after start sees `dt = (timestampMs - lastTimestampMs) / 1000` where `timestampMs` is the rAF parameter (DOMHighResTimeStamp) and `lastTimestampMs` was captured via `performance.now()`. Those are the same time origin, so `dt` is small (one frame interval). However, after `start()`, the first onFrame's `dt` still depends on how long the browser took to schedule the rAF — if the tab just became visible, that scheduling delay can be tens of ms; the `MAX_DT_SECONDS = 1/15` cap (line 140) handles this, so the worst case is one bounded jump. Actually correct, but worth noting: the cap is the only guard. If `MAX_DT_SECONDS` were ever loosened the model would jump.

Trigger: long tab-hidden pause then resume; physically harmless today.

Fix: defensive — instead of `dt` being measured from `lastTimestampMs` set at `start()`, set `lastTimestampMs = -1` and special-case the first frame to use `dt = 0`. Removes any dependency on the cap for correctness.

### MINOR: `Dialog` and `Drawer` allocate a fresh `FocusTrap` on every keydown

File: `libs/ui/src/components/Dialog.svelte:49-53` and `libs/ui/src/components/Drawer.svelte:62-66` (also `ConfirmAction.svelte:81-88`, `JumpToCardPopover.svelte:57-73`, `SnoozeReasonPopover.svelte:96-100`, `SharePopover.svelte:55-59`, `InfoTip.svelte:138-147`)

Problem: each keydown handler calls `createFocusTrap(panelEl, { onEscape: ... })` and uses the returned `handleKeyDown` once. The factory is cheap, but the pattern means: (a) the `release()` callback is never invoked, defeating the whole point of returning it; (b) every keydown allocates a closure + array filter inside `getFocusables` regardless of whether the key is Tab/Escape. Functionally correct today because `release` is documented as a no-op placeholder. If anyone later extends `release` to detach a document listener or similar, every existing call site silently leaks because nothing calls release.

Trigger: future maintenance hazard, not a current bug.

Fix: store the trap once in `$state` keyed to the open lifecycle: create on open, call `release()` in the `$effect` cleanup, look it up in the keydown handler. Several of these components already have an open-tracking effect that can host the lifecycle.

### MINOR: `InfoTip` `onfocus`/`onblur` race -- focusing the trigger via tab opens the popover, then immediately loses focus to the body and closes it

File: `libs/ui/src/components/InfoTip.svelte:199-202`

Problem: focus on the trigger calls `show(false)` (not pinned). Blur calls `hide()` if not pinned. When the user tabs to the trigger and the focus trap is engaged, tabbing into the popover from the trigger fires blur on the trigger before focus lands inside; `pinned` is false, so `hide()` runs, the popover unmounts, and focus may be lost (depending on relatedTarget timing).

Trigger: tab into the `?` trigger, then attempt to tab into the popover content (e.g., Learn more link).

Fix: in `onblur`, only hide when `event.relatedTarget` is not inside `popoverEl`. Same pattern as the focus-trap blur handlers elsewhere.

### MINOR: `helpRegistry.getByAppSurface` only matches on the primary appSurface, ignoring secondary entries

File: `libs/help/src/registry.ts:60-66`

Problem: `getByAppSurface` checks `page.tags.appSurface[0] === surface`. The schema (`help-tags.ts:26-27`) allows 1-3 entries, with the comment stating "First entry is the primary surface used for grouping." That's true for the index, but `getByAppSurface` is the general lookup — if a page is tagged `[study, hangar]`, asking for the hangar bucket misses it. Two callers in the wild may differ in expectation; the contract is ambiguous.

Trigger: page tagged with multiple surfaces; lookup by a non-primary surface returns no match.

Fix: either (a) document `getByAppSurface` as "primary-surface only" and rename to `getByPrimaryAppSurface`, or (b) make it scan the full array. Whichever, the runtime + the schema doc need to agree.

### MINOR: `ErrataEntry.formatPublishedDate` produces "Apr NaN, 2026" if input includes time component

File: `libs/ui/src/handbooks/ErrataEntry.svelte:59-68`

Problem: the function expects `YYYY-MM-DD` and splits on `-`. If the BC ever passes a full ISO timestamp (`2026-04-01T00:00:00Z`), the day token is `01T00:00:00Z`, `Number(day)` is `NaN`, and the rendered string becomes `Apr NaN, 2026`. The comment commits to YYYY-MM-DD, but there's no runtime guard.

Trigger: schema drift in the BC's `formatErrataForDisplay`.

Fix: add a regex match (`/^(\d{4})-(\d{2})-(\d{2})$/`) and return the raw string on mismatch instead of constructing a half-broken string. Same pattern the comment suggests for the months lookup (already returns `month` on out-of-range index).

### MINOR: `Tabs` mixes rAF-deferred focus with synchronous focus, breaking screen-reader announcement ordering

File: `libs/ui/src/components/Tabs.svelte:31-75`

Problem: `focusByOffset` (used by ArrowLeft/Right/Up/Down) sets `active = next.id` then schedules `requestAnimationFrame(() => el.focus())`. The Home/End handlers set `active = first.id` then call `focus()` synchronously. The mismatch creates two race windows: (a) rAF focus may land after Svelte has already re-rendered with new `tabindex` ordering, but `id="tab-{id}"` lookups should still work; (b) Home/End lookups happen synchronously, so the element might not yet have `tabindex=0` set before focus, which can confuse some AT.

Trigger: rapid arrow-key navigation interleaved with Home/End; observable as inconsistent focus-following on slow renders.

Fix: pick one strategy. Either always defer with `await tick()` or always trust synchronous DOM after the state set (`tick().then(focus)`). Mixing them is the smell.

### MINOR: `BrowseList` uses `(it)` as the each-key, which collides on duplicate primitive items and can throw

File: `libs/ui/src/components/BrowseList.svelte:33`

Problem: `{#each group.items as it (it)}` keys by the item itself. For object items this is OK (identity); for primitive items two equal values collide and Svelte 5 throws `each_key_duplicate`. The component is generic over T, so there's no way to constrain callers.

Trigger: caller passes a `string[]` or `number[]` with a repeated value.

Fix: require T to expose an id (mirror DataTable's `T extends { id: string }`), or require callers to pass an extractor: `keyOf?: (item: T, index: number) => string`. Default to `index` only as a last resort.

### MINOR: `ConfidenceSlider` uses a non-unique `id="skip-hint"` for `aria-describedby`, colliding when two are mounted on one page

File: `libs/ui/src/components/ConfidenceSlider.svelte:43-47`

Problem: `aria-describedby="skip-hint"` references a literal id. If two ConfidenceSliders render on the same page (e.g. dev demo, comparison view), the id collides and aria-describedby resolves ambiguously (browsers pick the first match, AT may dedupe).

Trigger: two instances on one DOM tree.

Fix: synthesize a per-instance id via `$props.id()` or `crypto.randomUUID()`, same pattern as `ThemePicker.svelte:84-89`.

### MINOR: `ConfidenceSlider` declares `role="radiogroup"` but never wires arrow-key navigation, so the role's contract is unmet

File: `libs/ui/src/components/ConfidenceSlider.svelte:23-37`

Problem: WAI-ARIA radiogroup pattern requires arrow-key navigation between radios. The component exposes `role="radio"` on each button and uses `aria-checked`, but only handles click. Keyboard users can only Tab to a single button (unclear which is in the tab order; default is each `<button>` so all are tabbable). AT users hear "1 of N" but lose the expected arrow navigation.

Trigger: keyboard or AT user attempting to choose a confidence level.

Fix: implement arrow navigation, set `tabindex` to `0` on the selected (or first) and `-1` on the rest. Mirror the pattern in `RadioGroup.svelte`.

### NIT: `validateHelpPages` private-host check misses IPv6 loopback / link-local

File: `libs/help/src/validation.ts:65-77`

Problem: `PRIVATE_HOST_PATTERNS` covers IPv4 ranges and `localhost`, `.local`, `.internal`. IPv6 loopback `[::1]` and link-local `[fe80::...]` slip through because the regex shapes don't match bracketed IPv6 hostnames returned by `parsed.hostname`. Authors are unlikely to commit IPv6 URLs, but the check is positioned as a safety net.

Trigger: an external ref URL with an IPv6 host.

Fix: add patterns for `^\[?::1\]?$`, `^\[?fe80:`, `^\[?fc[0-9a-f]{2}:` (ULA), etc., or use a list-based check after stripping the brackets.

### NIT: `ClusterGauge.arcPath` produces a degenerate arc when `a2 === a1` (e.g. greenLow === greenHigh)

File: `libs/activities/src/cockpit-panel/cluster/ClusterGauge.svelte:39-48`

Problem: When `a1 === a2` the arc has zero length; the SVG path `M x y A r r 0 0 0 x y` is a no-op but renders nothing. If a caller passes `greenLow == greenHigh` (e.g., a gauge with a single nominal value rather than a band), the green arc disappears silently.

Trigger: caller misconfigures band values.

Fix: skip the arc render when `a1 === a2`, or document the band requirement in the props comment.

### NIT: `Tabs.resolvedActive` falls back to `tabs[0].id` even when the first tab is disabled

File: `libs/ui/src/components/Tabs.svelte:29`

Problem: `resolvedActive = active || tabs[0]?.id`. If the user never sets `active` and `tabs[0]` is disabled, focus and panel render against a disabled tab. Subsequent arrow-key navigation calls `focusByOffset(currentId, ...)` with `currentId === tabs[0].id` which `findIndex` over `enabled` returns -1 for, so navigation silently does nothing.

Trigger: caller's first tab is disabled and they don't pre-set `active`.

Fix: derive `resolvedActive` as `active || (tabs.find(t => !t.disabled)?.id ?? '')`. Mirror what Home does.

## Status as of 2026-05-04

| # | Severity | Finding | Verdict |
|---|----------|---------|---------|
| 1 | Major | CitationPicker stuck `loading` on tab switch | CLOSED -- `runSearch` token-counter pattern resets `loading` regardless of `activeType` (`libs/ui/src/components/CitationPicker.svelte:67-181`). |
| 2 | Major | `findUnescaped` disagrees with `parseInlineUntil` on escapes | CLOSED -- both `findUnescaped` and `splitTableRow` now gate on `ESCAPABLE.has(next)` (`libs/help/src/markdown/inline.ts:141-165`, `block.ts:344-365`). |
| 3 | Major | Query-parser tokenizer doesn't break on `"` / unterminated quote | CLOSED -- bare-token loop breaks on `"`, unterminated emits `unterminated_quote` warning (`libs/help/src/query-parser.ts:111-145`). |
| 4 | Major | PFD heading default 360 with max 359 | CLOSED in this audit -- set `default: 0` and `headingDeg: 0`, added comment documenting the half-open `[0, 360)` convention. |
| 5 | Minor | Airspeed `requiresShift: true` blocks `=` key | CLOSED in this audit -- relaxed predicate so `requiresShift: true` requires shift but `false` accepts either. `event.key` already encodes shift state. |
| 6 | Minor | rAF dt vs `lastTimestampMs` after visibility resume | CLOSED -- `MAX_DT_SECONDS` cap is the documented guard; verified no behavioural drift today. Defensive rewrite was optional and is dropped. |
| 7 | Minor | `Dialog`/`Drawer` per-keystroke `createFocusTrap` | CLOSED -- traps now allocated once per modal-open and `release()`d in `$effect` cleanup (`libs/ui/src/components/Dialog.svelte:84-104`, `Drawer.svelte:56-100`, `ConfirmAction.svelte:130-132`). The 5 popovers (Snooze/Share/JumpTo/Citation/PfdLegend) now delegate to `Dialog`, so they inherit the fix. |
| 8 | Minor | `InfoTip` blur loses focus when tabbing into popover | CLOSED in this audit -- onblur now ignores blurs whose `relatedTarget` is inside `popoverEl`. |
| 9 | Minor | `helpRegistry.getByAppSurface` only matches primary surface | CLOSED in this audit -- behaviour confirmed intentional (test enforces it). Added explicit doc comment to `registry.ts` clarifying primary-surface contract and how to scan all surfaces. |
| 10 | Minor | `ErrataEntry.formatPublishedDate` produces "Apr NaN, 2026" with full ISO | CLOSED in this audit -- regex match `/^(\d{4})-(\d{2})-(\d{2})$/` returns raw input on mismatch (`libs/aviation/src/ui/handbooks/ErrataEntry.svelte:59-72`, file moved during arch fix). |
| 11 | Minor | Tabs Home/End sync focus vs rAF arrow focus | CLOSED in this audit -- Home/End now defer focus through rAF to match arrow keys. |
| 12 | Minor | `BrowseList` keys by `(it)` and collides on dup primitives | CLOSED -- prop `keyOf?: (item: T) => string \| number` accepted with id fallback (`libs/ui/src/components/BrowseList.svelte:26-39`). |
| 13 | Minor | `ConfidenceSlider` non-unique `id="skip-hint"` | CLOSED in this audit -- per-instance id via `$props.id()`, plus arrow-key roving for the radiogroup (Home/End included). |
| 14 | Nit | `validateHelpPages` private-host check misses IPv6 | CLOSED in this audit -- added `::1`, `fe80:`, `fc00::/7`, `fd00::/8` patterns. |
| 15 | Nit | `ClusterGauge.arcPath` degenerate when `a1 === a2` | CLOSED in this audit -- returns empty string for zero-length band. |
| 16 | Nit | `Tabs.resolvedActive` falls through to disabled tab[0] | CLOSED in this audit -- derive falls through to first non-disabled tab. |

All 16 findings closed.

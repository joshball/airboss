---
feature: full-repo
category: correctness
date: 2026-04-22
branch: main
issues_found: 17
critical: 2
major: 8
minor: 6
nit: 1
---

## Summary

Reviewed apps/study and libs/* (~313 TS/Svelte files). Found two critical issues that will propagate as more routes and UI primitives ship: dashboard error messages are leaked raw to the browser, and Button/disabled-anchor still fires onclick. The biggest propagatable pattern is the `slotIndex`-via-`Number()` form-parsing idiom that silently maps missing input to `0`, which several current actions copy and any new session-style route will inherit. Other findings cluster around weak deep-link preservation through login, inconsistent route-param encoding, and a few registry/BC validators that silently accept broken input.

## Propagatable Patterns (top priority)

1. **Client-visible error leakage from `getDashboardPayload`'s `PanelResult`** -- `libs/bc/study/src/dashboard.ts:544-547`. `toResult` returns `{ error: err.message }` straight to the browser. Any new dashboard panel added under this aggregator will inherit the leak.
2. **Form-action `Number(form.get('x'))` treats missing values as `0`** -- `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:214,278,354,389`. `Number.isInteger(Number(null))` is `true` because `Number(null) === 0`. Every new slot-bearing action in sessions/runners will copy this and accept missing `slotIndex` as slot 0.
3. **`requireAuth` drops the search string from `redirectTo`** -- `libs/auth/src/auth.ts:30-37`. Every deep link with query params (`/memory/review?domain=ops`, `/reps/browse?flight-phase=takeoff`, etc.) loses its filter after login. Shared by every protected route.
4. **Button primitive fires `onclick` when "disabled" + `href`-less anchor rendered** -- `libs/ui/src/components/Button.svelte:52-66`. Every Button consumer that renders as a link and supports a disabled state behaves incorrectly.
5. **Route helpers inconsistently encode path params** -- `libs/constants/src/routes.ts:71,107,108,123,126`. `MEMORY_CARD(id)`, `PLAN(id)`, `KNOWLEDGE_SLUG(slug)`, `SESSION(id)` do NOT `encodeURIComponent`; `MEMORY_CARD_EDIT`, `GLOSSARY_ID`, `SESSION_AT`, `KNOWLEDGE_LEARN_AT` do. A mixed policy invites double-encoding and URL-injection errors as slugs/IDs expand beyond prefix_ULID.

## Issues

### CRITICAL: Dashboard panels leak raw internal errors to the client

- **File**: `libs/bc/study/src/dashboard.ts:543-548`
- **Problem**: `toResult` returns `{ error: err instanceof Error ? err.message : String(err) }` as the client-visible payload. `err.message` may be "connect ECONNREFUSED 10.0.0.5:5432", a Drizzle-formatted SQL string with table names, or a Postgres error like `duplicate key value violates unique constraint "study.plan_user_active_uniq"`. The `/dashboard` load returns this payload directly. Every new dashboard panel added through the aggregator inherits the leak.
- **Trigger**: Make any dashboard panel query fail (db flap, schema drift, privilege change) and visit `/dashboard`.
- **Fix**: Map to a stable, safe message. Log the raw error server-side (with `requestId`), surface `{ error: 'Could not load this panel. Try again.' }` to the client. Mirror the existing `createErrorHandler` policy in `libs/utils/src/error-handler.ts`.

### CRITICAL: Button rendered as `<a>` still invokes onclick when disabled

- **File**: `libs/ui/src/components/Button.svelte:52-66`
- **Problem**: When `href` is set and `isDisabled` is true, the template sets `href={undefined}` and `aria-disabled="true"`, but `onclick` is still wired. Clicking a visually disabled anchor therefore still calls the handler. For destructive actions (`Archive`, `Sign out`, any future gated submit/link), the "disabled while loading" state doesn't actually block the click -- which is the only reason to ever disable.
- **Trigger**: Use any Button with `href` and `loading` true, click before the loading-label resolves.
- **Fix**: Either skip rendering `onclick` when disabled (`onclick={isDisabled ? undefined : onclick}`) or guard the handler (`onclick={(e) => { if (isDisabled) { e.preventDefault(); return; } onclick?.(e); }}`). Match the `<button>` branch's behavior where `disabled={isDisabled}` naturally suppresses the click.

### MAJOR: Session-runner actions accept missing `slotIndex` as 0

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:214,219,278,283,354,355,389,391`
- **Problem**: `const slotIndex = Number(form.get('slotIndex'))` then `if (!Number.isInteger(slotIndex)) return fail(400)`. `Number(null) === 0` and `0` is an integer, so a missing `slotIndex` passes the guard and the action writes slot 0. In `skip`, this silently skips the wrong slot (and mutates `plan.skip_nodes` / `plan.skip_domains` based on that slot). In `submitReview` / `submitRep`, the mis-routed submission produces an unrelated review/attempt row.
- **Trigger**: Client-side `enhance` failure that doesn't set `slotIndex`, browser that strips form fields, or a stale form element.
- **Fix**: Validate presence explicitly: `const raw = form.get('slotIndex'); if (raw === null || raw === '') return fail(400, ...); const slotIndex = Number(raw); if (!Number.isInteger(slotIndex) || slotIndex < 0) return fail(400, ...);`. Better: promote to a shared parser (e.g. `parseIntParam(form, 'slotIndex')`) used by all four actions.

### MAJOR: Dashboard panel errors visible in browser devtools include DB internals

- **File**: `libs/bc/study/src/dashboard.ts:544-547` (same as critical above, separate facet)
- **Problem**: Even absent a security leak, the UI rendering `{ error: 'connect ECONNREFUSED ...' }` directly on a panel gives users a useless message and no `requestId` to report. Every new panel panel re-inherits this.
- **Trigger**: Any DB hiccup during dashboard load.
- **Fix**: Rework `toResult` to accept a logger + panel label, log-and-mask. Return `{ error: 'Could not load <panel>. Try again.', requestId }` so support can correlate.

### MAJOR: `requireAuth` loses query string when redirecting to `/login`

- **File**: `libs/auth/src/auth.ts:30-37`
- **Problem**: `encodeURIComponent(event.url.pathname)` captures only the path. A learner deep-linking to `/memory/review?domain=ops` or `/session/start?mode=strengthen` lands on `/memory/review` with no filter after authenticating. The `redirectTo` sanity check in `login/+page.server.ts:isSafeRedirect` would accept the full `pathname + search`, so the guard is the only thing stripping it.
- **Trigger**: Sign out, visit any deep-linked URL with `?...`, sign back in.
- **Fix**: `encodeURIComponent(event.url.pathname + event.url.search)`. The `isSafeRedirect` check already refuses schemes / double-slashes / CRLF, so this is safe.

### MAJOR: `aviation` registry silently overwrites collisions on term keys

- **File**: `libs/aviation/src/registry.ts:74-77`
- **Problem**: `byTermMap.set(normalizeTerm(ref.displayName), ref)` and the alias loop overwrite any prior entry with the same term. Two references with the same display name or overlapping aliases (e.g. "VMC" as "visual meteorological conditions" vs "minimum controllable airspeed") will silently drop one, breaking `[[VMC::]]` wiki-link resolution. The id-level check throws on duplicates; the term level does not.
- **Trigger**: Add a second `Reference` with an alias that matches another reference's displayName or alias.
- **Fix**: Either (a) throw on collision like the id path, (b) store a `Reference[]` per term and surface a "multiple matches" error in `getReferenceByTerm`, or (c) prefer the non-colliding id and log a build warning. Pick one now before the registry grows.

### MAJOR: `Knowledge /learn` accepts phase writes for unknown nodes

- **File**: `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.server.ts:79-95`
- **Problem**: `visitPhase` and `completePhase` call `recordPhaseVisited` / `recordPhaseCompleted` directly without first verifying the node exists. A POST to `/knowledge/not-a-real-node/learn?/visitPhase` creates a `knowledge_node_progress` row with a bogus `nodeId` (the FK is not enforced in the schema -- `knowledgeNodeProgress` has `nodeId: text` without a reference). The progress count / recent-phase pointer becomes poisoned.
- **Trigger**: Authenticated user submits `/knowledge/<anything>/learn?/visitPhase` with a valid phase.
- **Fix**: Load `getNodeView(slug, user.id)` (or `getNodesByIds([slug])`) first; `fail(404)` when missing. Alternatively add a FK on `knowledge_node_progress.node_id -> knowledge_node.id` so the DB rejects the write.

### MAJOR: `getReferenceById`/`getReferenceByTerm` not null-guarded on stale IDs in wiki-link renderer

- **File**: `libs/aviation/src/ui/ReferenceText.svelte:38-51`
- **Problem**: Not a null-guard bug exactly, but the fall-through path for `[[text::]]` calls `getReferenceByTerm(node.display)`. Because term registration has no collision protection (prior finding), the renderer may silently resolve to the wrong reference. For learners reading regulatory text this is a correctness risk -- the wrong FAR gets linked.
- **Trigger**: Two references with overlapping terms ship; wiki-links using the shared term resolve inconsistently based on registration order.
- **Fix**: Either fix at the registry level (prior finding) or render an unresolved/ambiguous pill when multiple candidates exist.

### MAJOR: Route helpers inconsistently encode params

- **File**: `libs/constants/src/routes.ts:71,99,107-111,123,126,130`
- **Problem**: `MEMORY_CARD(id) => /memory/${id}`, `PLAN(id) => /plans/${id}`, `SESSION(id) => /sessions/${id}`, `NODE(id) => /nodes/${id}`, `KNOWLEDGE_SLUG(slug) => /knowledge/${slug}`, `SESSION_SUMMARY(id)` do NOT `encodeURIComponent`. `MEMORY_CARD_EDIT`, `GLOSSARY_ID`, `SESSION_AT`, `KNOWLEDGE_LEARN_AT`, `MEMORY_REVIEW_FOR_NODE` DO. Current IDs are `prefix_ULID` so nothing breaks today, but the asymmetric policy is a footgun: a future content-slug path (`/knowledge/climb%20rate` -> `/knowledge/climb rate`) or user-authored slug will blow up, and every consumer that passes an unsanitized param inherits the bug.
- **Trigger**: Introduce a slug or id containing any reserved URL char (`/`, `?`, `#`, space).
- **Fix**: Encode all path params in route helpers. It's always safe for `prefix_ULID` (encoding is the identity on `[A-Z0-9_]`) and makes the helpers safe for future slugs.

### MAJOR: `getNodeMastery` / `getNodeMasteryMap` use un-quoted ISO date for `dueAt <= now`

- **File**: `libs/bc/study/src/knowledge.ts:554` (`getNodeMastery`)
- **Problem**: `sql\`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)\`` passes the ISO string as a template param. Drizzle will parameterize and cast based on Postgres's implicit `text -> timestamptz` coercion. Works today, but on Postgres 17+ or with `standard_conforming_strings=off` / different server locales, implicit casts of timestamp-like text are fragile. Mirrored in `stats.ts:164,210` and `dashboard.ts:394`. Not a bug today, but the pattern is load-bearing and duplicated in enough places that one environment swap will hit them all.
- **Trigger**: Run on a Postgres env where implicit text->timestamptz coercion is restricted.
- **Fix**: Pass the Date directly (Drizzle encodes as timestamp) or wrap with `sql\`(${now.toISOString()})::timestamptz\``.

### MAJOR: `hooks.server.ts` security headers may miss requestId header on banned-user path

- **File**: `apps/study/src/hooks.server.ts:115-125`
- **Problem**: When `event.locals.user?.banned`, the code constructs a fresh `new Response('Account suspended', { status: 403 })` but never seeds `locals` early enough for `handleError` to pick up `requestId`, and the request-id-header set at line 129 will land on this response -- OK. But the banned response has no CSP / nonce context because it bypasses `resolve(event)`. Minor security regression; tracked here because every future surface app will copy this handle.
- **Trigger**: Ban a user, they hit any route.
- **Fix**: Return `resolve(event)` but have a guard inside a `+layout.server.ts` under `(app)` that checks `locals.user.banned`; or at minimum apply the same security headers explicitly on the short-circuit path. The `applySecurityHeaders` call DOES run on this response (line 134), so most CSP lives via framework defaults -- the ask is for consistent origin handling.

### MINOR: `recordItemResult` inserts row even when `getSession` guard is passed but slot doesn't exist

- **File**: `libs/bc/study/src/sessions.ts:787-855`
- **Problem**: Comment says "If no row exists for this slot, it's an error condition worth surfacing". The implementation uses `.onConflictDoUpdate` which, on no conflict, INSERTS a new row instead of throwing `SessionSlotNotFoundError`. The error is only thrown if `.returning()` comes back empty, which it won't for a successful insert. So the function actually DOES create a fresh slot row on insert, which contradicts the docstring and can accept `slotIndex`/`itemKind` the caller controls.
- **Trigger**: Call `recordItemResult` with a `slotIndex` that wasn't in `commitSession` (stale form, crafted request).
- **Fix**: Pre-select the slot under the session transaction, throw `SessionSlotNotFoundError` when absent, then UPDATE (not UPSERT). Or keep UPSERT but enforce slot existence via a constraint on `(session_id, slot_index)` that only exists for committed slots (partial unique index won't help here; use a CHECK via function).

### MINOR: `memory/new` carry-over query string is not sanitized when echoed back into the URL

- **File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:84-94`
- **Problem**: `parsed.data.tags.join(',')` builds a tag string that is passed to `URLSearchParams.set`. Tags that contain `,` (zod allows any 1-100 char string) collide with the delimiter when the page later splits by `,`. This isn't a security issue (URLSearchParams encodes commas), but the round-trip lossy-joins two tags `"first, second"` into one tag `first` + one tag `second`.
- **Trigger**: Create a card with a tag containing a comma, click "Save and add another".
- **Fix**: Either reject `,` in tags (update `cardTagsSchema`), or use a delimiter that the schema rejects (e.g. ``), or send tags as repeated `tags` params.

### MINOR: `parseOptions` for reps/new silently drops options that have only text

- **File**: `apps/study/src/routes/(app)/reps/new/+page.server.ts:32-50`
- **Problem**: `if (text.length === 0 && outcome.length === 0 && whyNot.length === 0) continue;` drops a row only when all three are empty. A half-filled option with `text='A'` but no outcome/whyNot survives; zod then surfaces a cryptic error on `options.N.outcome` for a row the user thought they'd removed. The UX bug is that users can't tell which index they're looking at after parseOptions renumbers via `opt${i}`.
- **Trigger**: Click "Add option", fill text only, submit.
- **Fix**: Echo the index-to-UI mapping back in `fieldErrors` (keyed by the stable `opt${i}` id or the user-visible option label) rather than relying on array index.

### MINOR: `Number.parseInt(..., 10)` fallback ignores clamp bounds in plans/new

- **File**: `apps/study/src/routes/(app)/plans/new/+page.server.ts:60-63` and mirrored in `plans/[id]/+page.server.ts:66-69`
- **Problem**: When parsing fails, fallback is the literal `10` rather than the `DEFAULT_SESSION_LENGTH` constant -- drift risk if the default ever changes. Since the fallback isn't clamped to `[MIN_SESSION_LENGTH, MAX_SESSION_LENGTH]`, if someone changes the fallback to a value outside the bounds, the invariant silently breaks.
- **Trigger**: Update `MIN_SESSION_LENGTH` without updating these fallbacks.
- **Fix**: Use `DEFAULT_SESSION_LENGTH` (already imported in sessions.ts) and always clamp: `sessionLength = clamp(parsed ?? DEFAULT_SESSION_LENGTH, MIN, MAX)`.

### MINOR: `logger.ts` uses `raw in LOG_LEVEL_ORDER` as validator

- **File**: `libs/utils/src/logger.ts:32-35`
- **Problem**: `if (raw in LOG_LEVEL_ORDER)` returns true for inherited props (e.g. `'toString' in {}` is true). If `LOG_LEVEL` is set to `toString` (absurd but possible via typo'd env), the cast `raw as LogLevel` yields a broken lookup where `LOG_LEVEL_ORDER[raw]` is undefined, and `undefined < undefined` is false, so logs are suppressed.
- **Trigger**: `LOG_LEVEL=constructor` in env.
- **Fix**: `Object.hasOwn(LOG_LEVEL_ORDER, raw)`.

### NIT: `TextField.svelte` docstring references `inputRequired` prop that doesn't exist

- **File**: `libs/ui/src/components/TextField.svelte:7-14`
- **Problem**: Comment says "defaulted true when `required` is true, overridable via `inputRequired`", but there's no `inputRequired` prop. A consumer reading the doc will try to set it, hit a TS error, and have to fall through to raw `<input required>`. Tiny correctness-adjacent documentation gap.
- **Trigger**: Read the docstring.
- **Fix**: Remove the stale clause or add the prop.

# Common Pitfalls (Agent Checklist)

Pattern-avoidance checklist for agents about to build a new page, BC function, component, or schema. Read this before you start writing. The patterns below are distilled from the 2026-04-22 full-codebase reviews (correctness, security, perf, architecture, a11y, patterns, ux, svelte, backend, schema) -- every row is a mistake the repo has actually shipped, recovered from, or is still paying for. Skim the quick checklist first; jump into the relevant domain section when you know what you're building.

Related docs:

- [best-practices.md](best-practices.md) -- CSP, auth forms, form actions, styling
- [reference-sveltekit-patterns.md](reference-sveltekit-patterns.md) -- constants, DB, scripts, monorepo
- [reference-engine-patterns.md](reference-engine-patterns.md) -- tick loop, scoring, replay

## Quick checklist (top 10)

1. Never hand-roll a button, banner, input, or confirmation -> use `libs/ui/` primitives (`Button`, `Banner`, `TextField`, `Select`, `ConfirmAction`).
2. Never hardcode a color, radius, shadow, or transition -> use `--ab-color-*`, `--ab-radius-*`, `--ab-shadow-*`, `--ab-transition-*` tokens from `libs/themes/tokens.css`.
3. Never write a route string inline -> go through `ROUTES` in `libs/constants/src/routes.ts`.
4. Never use Svelte 4 legacy (`export let`, `<slot>`, `$:`, `$app/stores`, `createEventDispatcher`) -> runes only, `$app/state`, callback props, `{@render}`.
5. Never call `ulid()` / `nanoid()` directly -> use `createId(prefix)` from `@ab/utils`.
6. Never put DB access in `+page.ts` or call Drizzle from a route -> `+page.server.ts` + a BC function.
7. Never assume a `+page.server.ts` action is idempotent -> guard re-submits at the DB layer (UPSERT + UNIQUE) or check `completedAt IS NULL` before writes.
8. Never leak `err.message` to the client -> catch typed BC errors, fall through to a fixed "Could not save..." string for 500s.
9. Never skip a11y primitives on destructive or repeating UI -> `ConfirmAction` for anything that deletes/archives/suspends, `:focus-visible` with the focus-ring token on every custom button.
10. Never ship a new table without `updated_at`, FK on every relationship column, CHECK on every bounded enum, and an index on every WHERE/ORDER BY column.

## Pitfalls by domain

### Route files (`+page.svelte` / `+layout.svelte`)

| Don't                                                        | Do                                                                       | Why                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Hand-roll `.btn` / `.banner` / `.field` / `.chip` in a route | Import `Button`, `Banner`, `TextField`, `Badge`, `Card` from `@ab/ui`    | Primitives ship focus-ring + tokens + a11y; routes drift without    |
| Paint colors, paddings, shadows, radii in route `<style>`    | Route CSS carries layout only: `display`, `grid`, `gap`, `position`      | `scripts/check/styles.ts` enforces; tokens reskin, hex can't        |
| `font-size: 0.875em` or `font-size: 14px`                    | `font-size: var(--ab-font-size-sm)` in `rem`                             | `em` parent-relative breaks root scale; `px` breaks zoom            |
| Inline `humanize(domain)` / `labelFor(x)` helper             | Hoist into `@ab/utils` or `@ab/constants` label maps                     | Same helpers reinvented across pages drift in copy                  |
| Magic route strings: `<a href="/plans/new">`                 | `<a href={ROUTES.PLAN_NEW}>` or typed `ROUTES.PLAN(id)`                  | Renaming a route misses inline strings                              |
| `+page.ts` that loads DB-backed data                         | `+page.server.ts` so server-only libs stay out of the client bundle      | `@ab/aviation` and help data leaked through `+page.ts` (PR #54)     |
| Root-level `const x = someServerFn()` at module scope        | `load` in `+page.ts`/`+page.server.ts` + `let { data } = $props()`       | Module-scope reads stale out the moment inputs become reactive      |

### Server load functions and form actions

| Don't                                                                | Do                                                                                                     | Why                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `Number(formData.get('n'))` without null-check                       | `const raw = formData.get('n'); if (raw === null) return fail(400, ...); Number(raw)`                  | `Number(null) === 0` silently corrupts rep/card inputs                   |
| Direct Drizzle `db.select()` in a route                              | Call a BC function (`@ab/bc-study`, `@ab/bc-sim`)                                                      | BC owns ownership checks, errors, and query shape                        |
| `return fail(400, { error: err.message })`                           | Catch typed BC errors, map to fixed user strings; log the raw message via `createLogger`               | `updatePlan` leaked raw DB error text through `err.message` (backend #4) |
| Multi-step writes (archive + create + start) without a transaction   | Wrap in `db.transaction(...)`; one typed error path                                                    | Partial failures leave the plan half-set-up (plans.ts addSkipDomain)     |
| `redirect(303, ROUTES.X)` bare                                       | `throw redirect(303, ROUTES.X)` consistently; `import { isRedirect } from '@sveltejs/kit'` to re-throw | Bare redirect in a catch block swallows by structural shape, not type    |
| Surface server errors with `error(500, ...)` from a form action      | `return fail(500, { success: false as const, error: 'Could not save X' })`                             | `error()` produces full-page 500, kicking the user out of the flow       |
| Accept `planId` / `sessionId` / `cardId` from form data and trust it | BC function takes `userId` + entity id; BC re-verifies ownership                                       | `addSkipNode` accepted arbitrary nodeIds (security minor #3)             |
| `completeSession` (or any write) from a `load` function              | Writes happen in actions only; loads are read-only                                                     | Prefetch / link-preview silently ended learner sessions (backend #6)     |
| Skip the "is this session still open?" check inside an action        | Call `requireOpenSession(...)` at the top of every mutating action                                     | Stale tabs submitted against completed sessions (backend #2)             |

### Auth and authorization

The app has a **dual-gate auth contract**. Document it; don't remove it.

- **Layout gate**: every `(app)/` route is protected by `requireAuth(locals)` in `apps/study/src/routes/(app)/+layout.server.ts`.
- **Per-page gate**: every `+page.server.ts` load and every action also calls `requireAuth(locals)`. Capture the returned user: `const user = requireAuth(locals); user.id`.
- **Do not** strip the per-page gate on the assumption that the layout guarantees `locals.user`. Direct form POSTs to actions don't walk the layout load.
- BC functions take `user.id` as a positional arg; ownership checks live inside the BC, never in the route.
- Reserve `requireVerifiedEmail` as a chokepoint for flows that need `emailVerified === true`. Don't inline the check.
- `redirectTo` query param preservation: when bouncing to login, round-trip the original URL including query string. Never strip it.
- Roles and permissions enforced server-side in the BC. UI hiding a button is a convenience, not a control.
- Never call `authClient.signIn.email()` client-side; use a form action (see `best-practices.md` Auth Forms).
- Cookie rules: `httpOnly`, `sameSite=lax` (tighten to `strict` once no cross-origin entry points exist), `secure` in non-dev.

### Svelte 5 components

| Don't                                                                              | Do                                                                                                                     | Why                                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Use `$effect` to seed state from a prop                                            | `let x = $state<T>(propX ?? '')` -- seed at init, not in effect                                                        | Effect re-fires and overwrites user typing (login page svelte #4)    |
| `$effect(() => { x = computeFromY(y); })`                                          | `const x = $derived(computeFromY(y))`                                                                                  | Derived is the right tool; effect-as-computed creates loops          |
| `$effect` that reads and writes the same `$state`                                  | Restructure to `$derived`, or guard with `untrack(() => read())`                                                       | Classic infinite loop; HelpSearchPalette shipped one (PR #54)        |
| Use `$effect` to reset state on slot change                                        | `{#key slotIndex}<Child />{/key}` to remount                                                                           | Remount is cheaper and can't race with renders                       |
| `let foo = $state(bar)` where `bar` is a `$props()` value (and parent can re-seed) | Declare the prop reactive via `$derived`, OR add `// svelte-ignore state_referenced_locally` comment confirming intent | Compiler warns; silent prop drift otherwise                          |
| `{#each items as item}` (no key)                                                   | `{#each items as item (item.id)}`                                                                                      | Unkeyed each rerenders all children on reorder, loses focus/input    |
| `$state` on a value that never changes                                             | Plain `const`                                                                                                          | `$state` has cost; static values don't need it                       |
| `createEventDispatcher`, `<slot>`, `$:`, `$app/stores`                             | Callback props, `{@render children()}`, `$derived`/`$effect`, `$app/state`                                             | All Svelte 4 legacy; linter and reviewers will flag                  |
| Rune logic in `.ts`                                                                | `.svelte.ts` for modules that use runes outside components                                                             | Required by the compiler                                             |

### UI primitives and a11y

- Use `libs/ui/` primitives. `TextField`, `Select`, `Button`, `ConfirmAction`, `Banner`, `ConfidenceSlider`, `Card`, `PanelShell`, `StatTile`, `Badge`, `KbdHint` are all tokenized.
- Destructive actions (archive, delete, suspend, skip-permanent) wrap in `<ConfirmAction>`. No `window.confirm()`. No bare inline form with a red button.
- `ConfirmAction` must move focus into the Confirm button on reveal and back to the trigger on cancel (a11y critical #1). If you touch the primitive, preserve the focus contract.
- Focus ring: every custom button, chip, tile, or stepper step must declare `:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ab-color-focus-ring); }`. The global app outline doesn't meet 3:1 on colored backgrounds.
- `<Button>` rendered as `<a>` must honor `disabled` (no click when disabled, proper ARIA) -- don't add ad-hoc `onclick` handlers that bypass the primitive's checks.
- Forms: native HTML `required` on mandatory fields, `fieldErrors` from server rendered inline, first invalid field focused on failed submit, toasts only for success/unexpected-500.
- Modals / confirm rows: focus moves to the primary button on open, returns to the trigger on close, Escape cancels.
- Banner's `dismissible` + `onDismiss` prop is the supported pattern. Don't recreate `bannerDismissed = $state(true)` ad-hoc.
- Color alone never carries meaning. A "good / over / under" bucket must also have an icon or word prefix. Test under `forced-colors: active`.
- Keyboard shortcut handlers: early-return on `isContentEditable`, `HTMLInputElement`, `HTMLTextAreaElement`; scope to the relevant phase; never bind bare `Shift` / `Ctrl` (AT modifier keys).
- Transitions: `var(--ab-transition-fast|normal|slow)`, never literal `120ms`/`200ms`. The tokens zero out under `prefers-reduced-motion`; literals don't.

### UX patterns every page owes the user

A page isn't "done" until each of these is addressed. If a state can't occur, say so explicitly in a comment.

- **Empty state** -- list/table with 0 rows has a heading + one-sentence explanation + primary CTA.
- **Loading state** -- initial page load and in-flight async both show progress; disabled button during submit.
- **Error state** -- both load-time (root `+error.svelte` + `(app)/+error.svelte`) and action-time (`form.error` inline).
- **Success confirmation** -- specific message ("Plan saved", "Card archived"), not generic ("Operation complete"). Prefer `?created=<id>` + `<Banner variant="success">` pattern over transient toast when the success is consequential.
- **Destructive confirmation** -- `<ConfirmAction>` wraps it. Never raw `<form method="POST">` + red button.
- **Double-submit guard** -- button `disabled` while `submitting`; server-side UPSERT + UNIQUE backs it.
- **Reversibility** -- if an action is one-click destructive (review rating, skip permanently), provide an undo window or a confirm step. The scheduling/skip signal is the product.

### Drizzle schema and migrations

| Don't                                                        | Do                                                                                                | Why                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `text('status').$type<Status>()` with no CHECK               | `pgEnum('status', STATUS_VALUES)` or explicit CHECK against `@ab/constants`                       | Type-only narrowing doesn't stop bad inserts                             |
| Omit FK on a user/card/plan/session id column                | `.references(() => other.id, { onDelete: 'cascade', onUpdate: 'cascade' })` on every relationship | `session_item_result.user_id` drifted because it lacked a FK (schema #1) |
| No index on a column that appears in WHERE / ORDER BY / JOIN | Add it in the `(t) => ({ ... })` config                                                           | Sequential scans hide until the library grows                            |
| Hand-roll `created_at`/`updated_at`                          | Use `timestamps()` helper from `libs/db`                                                          | Helper guarantees timezone + default + parallel on every table           |
| Skip `updated_at` on a mutable projection                    | Add it even on materialized projections like `card_state`                                         | Debugging "why does this state disagree with its source?" requires it    |
| Omit audit columns on user-authored content                  | `auditColumns()` (created_by, updated_by)                                                         | Per ADR 004                                                              |
| Put a write-path table in the wrong namespace                | `identity` / `audit` / `study` namespaces per ADR 004                                             | Cross-namespace joins are architectural smells                           |
| `nanoid()` or `ulid()` directly in seed/schema               | `createId('prefix')` from `@ab/utils`                                                             | Wrapper enforces prefix-ULID format across the codebase                  |
| Catalog IDs with ULID                                        | Stable `prefix-NNN` sequence for authored/catalog rows; `prefix_ULID` for events                  | Per ADR 004 ID tiers                                                     |
| Invariants enforced only by a hand-applied `.sql` file       | Express the index/constraint in Drizzle's table DSL (`uniqueIndex(...).where(...)`)               | Fresh envs run drizzle push and lose the backstop (schema #2)            |
| Forget the partial UNIQUE for "one active X per user"        | `uniqueIndex('...').on(t.userId).where(sql\`status = 'active'\`)`                                 | The BC comment says "backstop"; backstop that doesn't exist is a stub    |
| Store booleans that must be recomputed to stay accurate      | Replace with a VIEW that LEFT JOINs + returns the boolean, or recompute on write                  | `knowledge_edge.target_exists` drifts between builds                     |

### Performance

- Every `load` function parallelizes independent queries with `Promise.all` (or `Promise.allSettled` when failures are tolerable). Serial awaits in a loader are a bug.
- Every list helper has an explicit `limit`. Add a default (20, 50) and an enforced cap in the BC; never return "all rows" by accident.
- Count queries live in the BC, never assembled inline in a route. If a route needs a count, call a BC function.
- `db.select({ id, name })` lists exactly the columns the page needs. Avoid `select()` bare (implicit all-columns) on wide tables.
- Per-row `await` inside a map is a fan-out N+1. Batch: `getNodeMasteryMap(userId, ids)` not `ids.map(id => getNodeMastery(userId, id))` (perf critical #1/#2).
- Derived projections beat unbounded history scans: if you need "last X per Y", denormalize X onto the Y row (e.g. `card_state.last_rating`) rather than scanning history at query time.
- Server-only data stays in `+page.server.ts`. Aviation references, help content, and glossary lookups have leaked into the client bundle via `+page.ts` before (PR #54). Don't repeat it.
- `$derived` for any computation that re-runs when inputs change; `$effect` only for genuine side-effects.
- Keyed `{#each}` over a list that can reorder, filter, or paginate. Unkeyed churns the DOM and loses focus.
- Date-ranged queries bound the lookback (`gte(col, oneYearAgo)`) instead of scanning all history.

### Patterns and conventions (house style)

- No `any`. Prefer proper types, generics, `unknown` with guards. Test-only `as any` is still a violation -- cast `as unknown as Foo` so the escape hatch is explicit.
- No `!` non-null assertions. Capture guard results: `const user = requireAuth(locals)`.
- No `as Foo` without an inline comment explaining why.
- No magic strings. All domain values, statuses, kinds, ratings flow through `@ab/constants`.
- No inline route strings. `ROUTES.X` or `ROUTES.X(id)`.
- All colors via `--ab-color-*`. All spacing via `--ab-space-*`. All radii via `--ab-radius-*`. All shadows via `--ab-shadow-*`. All font sizes via `--ab-font-size-*`. All transitions via `--ab-transition-*`.
- `rem` for font sizes and spacing; `em` is parent-relative and breaks the root scale. `px` is acceptable only for borders (1px, 2px) and 1:1 device-pixel shadows.
- Imports across lib boundaries use `@ab/*` aliases, never relative paths. Scripts count as cross-lib and follow the same rule.
- No em-dash, en-dash, or `--` as a sentence separator in any prose (replies, commits, docs, code comments). Use `->` not `->` unicode.
- Never use "honest" or any variant (`honestly`, `to be honest`, `the honest read`, `honest picture`, `honest self-assessment`) in agent voice, code comments, commit messages, PR descriptions, or platform docs. The word implies prior dishonesty. Scenario prose and quoted FAA content are the documented exceptions.
- No AI attribution anywhere. No `Generated by Claude`, no `Co-Authored-By`.

## Anti-patterns to grep for

High-signal scans. Run from the repo root. An empty result is the bar.

```bash
# Svelte 4 legacy
rg -n '\bexport let\b' apps libs
rg -n '<slot\b' apps libs
rg -n '\$:' apps libs --type svelte
rg -n '\$app/stores' apps libs
rg -n 'createEventDispatcher' apps libs

# Type escape hatches
rg -n ':\s*any\b' apps libs --type ts
rg -n '\bas any\b' apps libs --type ts
rg -n '!\.' apps libs --type ts

# Route strings / magic values
rg -n "href=['\"]/[a-z]" apps libs --type svelte
rg -n "goto\(['\"]/[a-z]" apps libs

# Design-token holes
rg -n '#[0-9a-fA-F]{3,8}' apps libs --type svelte
rg -n 'var\(--ab-color-[^,]+,\s*#' apps libs --type svelte
rg -n 'rgba\(' apps libs --type svelte
rg -n 'transition:\s*[^v].*\dms' apps libs --type svelte
rg -n 'font-size:\s*\d' apps libs --type svelte
rg -n 'border-radius:\s*\d' apps libs --type svelte

# Effect misuse
rg -n '\$effect\(\(\) => \{' apps libs --type svelte

# Banned prose token (agent voice)
rg -n '\bhonest' apps libs docs --type md --type svelte --type ts

# Direct id generation
rg -n "\b(ulid|nanoid)\s*\(" apps libs --type ts

# Raw confirm()
rg -n '\bconfirm\s*\(' apps --type svelte
```

## When to update this doc

Whenever a review surfaces a propagatable pattern, add a row. A one-off bug stays in the review file. A pattern (two or more sites, a root-cause finding, or a rule every new surface will face) belongs here.

Workflow:

1. `/ball-review-full` ships review files under `docs/work/reviews/YYYY-MM-DD-*.md`.
2. The fixer closes individual instances.
3. The reviewer (or a follow-up agent) reads the review batch and promotes every propagatable finding into a row in the matching section above.
4. Don't let root-cause findings die in `docs/work/reviews/`.

## References

Source reviews (2026-04-22 full-codebase):

- [correctness](../work/reviews/2026-04-22-full-codebase-correctness.md)
- [security](../work/reviews/2026-04-22-full-codebase-security.md)
- [perf](../work/reviews/2026-04-22-full-codebase-perf.md)
- [architecture](../work/reviews/2026-04-22-full-codebase-architecture.md)
- [a11y](../work/reviews/2026-04-22-full-codebase-a11y.md)
- [patterns](../work/reviews/2026-04-22-full-codebase-patterns.md)
- [ux](../work/reviews/2026-04-22-full-codebase-ux.md)
- [svelte](../work/reviews/2026-04-22-full-codebase-svelte.md)
- [backend](../work/reviews/2026-04-22-full-codebase-backend.md)
- [schema](../work/reviews/2026-04-22-full-codebase-schema.md)

Project rules and ADRs:

- [CLAUDE.md](../../CLAUDE.md) -- project rules, import aliases, critical rules
- [best-practices.md](best-practices.md) -- CSP, auth forms, SSR, Svelte 5, theme system
- [reference-sveltekit-patterns.md](reference-sveltekit-patterns.md) -- constants, DB, scripts, monorepo
- [ADR 004](../decisions/004-DATABASE_NAMESPACES.md) -- database schema namespaces
- [ADR 010](../decisions/010-ID_STRATEGY.md) -- ID tiers (catalog vs event)
- [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy
- [ADR 012](../decisions/012-reps-session-substrate.md) -- unified session substrate, `session_item_result` as source of truth

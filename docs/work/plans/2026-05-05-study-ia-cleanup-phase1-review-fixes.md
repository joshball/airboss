# Review fix plan -- study-ia-cleanup Phase 1

Source reviews: `docs/work/reviews/2026-05-05-study-ia-cleanup-phase1-*.md` (10 categories)

Total findings: 28 (5 major, 13 minor, 10 nit). Critical: 0. Convergent fixes consolidated below.

## Convergent fixes

| Group               | Findings        | Root cause                                        | Fix                                                                                                                              |
| ------------------- | --------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tooltip duplicate id | C-1, A-1       | `tooltipId` derived from key only                | Per-instance unique id via module counter or `crypto.randomUUID()` once per mount                                                |
| pageKey allowlist   | PT-1, SEC-2    | string literal at call site, no server allowlist | New `PAGE_EXPLAINER_KEYS` const + `PAGE_EXPLAINER_KEY_VALUES` validator on the endpoint                                          |

## Plan, execution order

### Wave 1 -- contract changes (libs/constants, libs/bc) -- ladders into UI

1. `PAGE_EXPLAINER_KEYS` constant + values + type in `libs/constants/src/study-home.ts`. Initial entry: `STUDY_HOME = 'home'`. (PT-1, SEC-2)
2. Endpoint Zod schema validates `pageKey` against `PAGE_EXPLAINER_KEY_VALUES`. (SEC-2)
3. `setPageExplainerDismissal` short-circuits when state already matches stored. (SEC-1)
4. `setPageExplainerDismissal` swaps read-modify-write for a single-statement JSONB merge using Postgres' `||` operator. (B-1)
5. `EmptyPageKeyError extends Error` mirroring `UnknownUserPrefKeyError`. (B-3)
6. JSDoc note on `setPageExplainerDismissal` documenting the audit-row size cost. (B-2)

### Wave 2 -- UI primitives (libs/ui)

7. `Tooltip` per-instance unique id via module counter. (C-1, A-1)
8. `Tooltip` adds document `pointerdown` listener (mounted only while open) that closes on tap-outside. (C-2)
9. `Tooltip` drops `tabindex="0"` -- relies on the wrapped trigger's natural focusability when interactive. Plain-text wrappers explicitly opt in via a new `focusable` prop (default false). (A-2)
10. `Tooltip` `:focus-visible` outline using existing focus-ring token. (A-3)
11. `Tooltip` keydown scoped to host span instead of `<svelte:window>`. (S-1)
12. PageExplainer collapse button gets `aria-label="Hide page explainer"`; visible text changes to "Don't show again". (A-4, UX-2)
13. PageExplainer `untrack` jsdoc on `dismissed` state line. (S-2)
14. PageExplainer logs a `console.warn` on persistence failure (no toast subsystem yet -- `TEMP_FIXES.md` entry). (UX-1)

### Wave 3 -- consumer wiring (apps/study)

15. `+page.svelte` uses `PAGE_EXPLAINER_KEYS.STUDY_HOME` instead of literal `'home'`; reads `data.pageExplainerDismissals[PAGE_EXPLAINER_KEYS.STUDY_HOME] ?? false`. (PT-1, C-4)
16. `dueCardsCount` returns `null` when `recallRequired === 0`; TilesPanel renders "--" badge in that case. (C-3)

### Wave 4 -- shared resolver pattern doc + perf trip-wire

17. Add resolver-inversion pattern note to `docs/agents/best-practices.md` (one paragraph + link to `info-tip-resolver.ts` and `tooltip-glossary-resolver.ts` as canonical examples). (AR-1)
18. Glossary corpus: keep eager glob, add a `bun run check`-time trip-wire that fails when `libs/help/src/glossary/content/*.md` cumulative size > 50 KB. (P-1)

### Deliberately deferred (with explicit triggers per CLAUDE.md)

| Item   | Reason                                                                                                                          | Trigger to revisit                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| C-5    | Discriminated-union `Props` for Tooltip (`for` XOR `term+definition`). Type-level clean-up, current runtime behavior is correct. | When a third Tooltip mode lands.                                         |
| PT-3   | `clampNonNegative` util in `@ab/utils`. Two sites is below the project's "third-instance" rule.                                  | When a third site appears.                                               |
| S-3    | `$derived.by` -> `$derived` stylistic nit. Functionally identical.                                                                | Drop into the next sweep.                                                |
| UX-3   | Hover tooltip on the `?` reopen affordance. Want C-1/C-2 closed first so we can reuse the primitive.                               | Reopen once Tooltip a11y fixes have shipped.                             |
| UX-4   | Glossary editorial copy. Out of scope for engineering review; user / CFI to revise.                                              | User explicitly assigns to a copy reviewer.                              |
| AR-2   | API route placement (`apps/study` vs `libs/`). Single consumer today; second consumer settles the call.                            | When a second app needs the explainer.                                    |

## Verification protocol per wave

After each wave:

- `bun run check` -- 0 errors, 0 warnings (pre-existing baselines: fast-xml-parser, @ab/aviation, three, @ab/bc-sim/persistence, all unchanged from PR #649).
- `bunx vitest run libs/ui/__tests__/PageExplainer.svelte.test.ts libs/ui/__tests__/Tooltip.svelte.test.ts libs/help/src/glossary/index.test.ts libs/bc/study/src/user-prefs.test.ts` -- green.
- `bunx biome format --write` on staged files.
- `git status` audit -- only intended files staged.

## Closure criteria

A finding is closed when:

- The fix is in the diff.
- The verification step covering it passes.
- A grep for the symptom returns empty (e.g. `grep -rn 'tabindex="0"' libs/ui/src/components/Tooltip.svelte` returns nothing for A-2).

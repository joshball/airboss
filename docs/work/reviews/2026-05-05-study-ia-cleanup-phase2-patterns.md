# Patterns review -- study-ia-cleanup Phase 2

issues_found: 3

## PT-1 (major) -- Tab `data-testid` template strings inline the prefix

`apps/study/src/routes/(app)/program/+layout.svelte:50-66`:

```svelte
data-testid="program-tab-{PROGRAM_TABS.QUALS}"
```

The `program-tab-` prefix is duplicated four times. Per CLAUDE.md "Critical Rules" -- "No magic strings. Use libs/constants/" -- this should resolve through a helper. Two reasonable closes:

- A `programTabTestId(tab: ProgramTab)` helper in `libs/constants/src/program.ts` that returns `'program-tab-quals' | 'program-tab-goal' | ...` typed as a literal union.
- Treat `program-tab-` as a documented testid family pattern (per design.md "E2E selectors") and accept the four call sites.

Spec design.md prescribes the family pattern explicitly: `data-testid="{section}-tab-{name}"`. The pattern itself IS the contract. Inlining four sites of a documented pattern is acceptable; promoting to a helper would gild the lily and obscure the convention.

Recommendation: leave it. Capture the convention check in the Phase 4 testid CI guard so a future agent adding `program-tab-foo` either registers `foo` in `PROGRAM_TABS` or fails the build.

## PT-2 (minor) -- `+layout.svelte` reaches into the parent layout's `page.url.pathname` for active checks

The tab strip reads `page.url.pathname` and prefix-matches against `ROUTES.PROGRAM_QUALS` etc. This is the same pattern the top-level `(app)/+layout.svelte` uses, so it is consistent with project convention. The alternative -- bind to a `data.activeTab` value from the layout server load -- is not better; the URL is already the truth and avoids a round-trip when navigating sub-tabs.

No fix.

## PT-3 (nit) -- `coverage/+page.server.ts` returns a hand-rolled view-model interface

```typescript
export interface ProgramCoverageData {
  hasGoal: boolean;
  hasPlan: boolean;
  goalCount: number;
  primaryGoalTitle: string | null;
}
```

The interface is co-located with the load; the page reads `PageData` (auto-generated). Repeating the shape in an exported interface is redundant since the consumer is the sibling `+page.svelte`. Pattern is harmless and matches `study/+page.server.ts` precedent (`StudyHomePayload` etc.).

No fix.

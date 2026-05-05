# Performance review -- study-ia-cleanup Phase 2

issues_found: 2

## P-1 (minor) -- Layout load + child load both call `getPrimaryGoal` for `/program/quals`

See `architecture` AR-2. The layout server load fires `getPrimaryGoal` + `getActivePlan` in parallel; `/program/quals/+page.server.ts` then fires another `getPrimaryGoal` for its `hasPrimaryGoal` flag, plus `getCredentialMasteryMap`. Net: one extra goal SELECT per `/program/quals` GET.

Indexed read; sub-millisecond. Not actionable today; worth re-checking once a Coverage tab implementation lands and the layout's data set grows.

## P-2 (info) -- `Promise.all` everywhere good citizen

`+layout.server.ts` and `coverage/+page.server.ts` both use `Promise.all` for the goal / plan / list fans. No serial-await chains. No actions needed.

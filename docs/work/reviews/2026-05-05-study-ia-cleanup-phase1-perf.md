# Performance review -- study-ia-cleanup Phase 1

issues_found: 2

## P-1 (minor) -- glossary `import.meta.glob({ eager: true })` ships every long-form markdown file in every bundle that imports `@ab/help/glossary`

`libs/help/src/glossary/index.ts:29-33`

```typescript
const RAW_LONG_FORM = import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true });
```

Every `.md` file under `./content/` is bundled into JS at build time, even when the consumer (e.g. `Tooltip` reading via the resolver) only needs `term` + `short`. Today the corpus is 20 files, each ~500 bytes -- ~10 KB total, immaterial. As the corpus grows the bundle cost compounds.

The doc-comment already calls this out ("swapping to lazy `import()` per key is a future optimisation if the corpus grows"). Per CLAUDE.md "no undecided considerations for future work":

- Set a trip-wire (e.g. CI fails when `libs/help/src/glossary/content/*.md` exceeds 50 KB total), OR
- Move to lazy `import()` now and pay the small refactor cost while the corpus is small.

Pick one in this slice; do not leave "we'll do it later".

## P-2 (nit) -- `+page.server.ts` adds a 4th parallel query (`getPageExplainerDismissals`) -- already optimal

`apps/study/src/routes/(app)/study/+page.server.ts:108-113`

```typescript
const [prefs, primaryGoal, activePlan, pageExplainerDismissals] = await Promise.all([...]);
```

Good. The dismissals fetch piggybacks on the existing parallel batch and adds no serial latency. No action.

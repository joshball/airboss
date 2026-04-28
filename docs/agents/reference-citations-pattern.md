# Reference: Citations Pattern

How the polymorphic content-citation graph is wired. Read this before mounting citations on a new content surface or adding a new source/target type.

Shipped as work package [content-citations](../work-packages/content-citations/spec.md); folded into bc-study by [bc-citations-coupling](../work-packages/bc-citations-coupling/spec.md). Code lives in [libs/bc/study/src/citations/](../../libs/bc/study/src/citations), the picker / chips / cited-by panel in [libs/ui/src/components/](../../libs/ui/src/components), and constants in [libs/constants/src/citations.ts](../../libs/constants/src/citations.ts).

Related docs:

- [reference-sveltekit-patterns.md](reference-sveltekit-patterns.md) for constants, schema namespaces, route patterns
- [common-pitfalls.md](common-pitfalls.md) for form-action error handling and BC ownership rules

## Overview

One table, `study.content_citations`, connects any content row (card / rep / scenario / knowledge node) to any reference (regulation node / advisory circular / external URL / knowledge node). The fabric is symmetric: source-side reads power "citations on this card", target-side reads power "cited by" panels on regulation and knowledge-node detail pages. The data model is polymorphic with soft FKs; the `@ab/bc-study` BC is the only write gate, and it validates source ownership and target existence before insert.

## Data model

Schema: [libs/bc/study/src/citations/schema.ts](../../libs/bc/study/src/citations/schema.ts). Migration: [drizzle/0004_content_citations.sql](../../drizzle/0004_content_citations.sql).

Source x target matrix (from [libs/constants/src/citations.ts](../../libs/constants/src/citations.ts)):

| Source type \ Target type | regulation_node | ac_reference | knowledge_node | external_ref |
| ------------------------- | --------------- | ------------ | -------------- | ------------ |
| card                      | yes             | yes          | yes            | yes          |
| rep                       | yes             | yes          | yes            | yes          |
| scenario                  | yes             | yes          | yes            | yes          |
| node                      | yes             | yes          | yes            | yes          |

Source and target tables (resolved by the BC, not the DB):

| Type discriminator | Table                           | Notes                                                        |
| ------------------ | ------------------------------- | ------------------------------------------------------------ |
| `card`             | `study.card`                    | Owner: `card.userId`                                         |
| `rep`              | `study.scenario`                | Same table as `scenario`, kept distinct to label reads       |
| `scenario`         | `study.scenario`                | Owner: `scenario.userId`                                     |
| `node`             | `study.knowledge_node`          | Author check is open in v1; per-node ACLs land later         |
| `regulation_node`  | `hangar.reference` (CFR rows)   | Bucketed by `tags.sourceType = 'cfr'`                        |
| `ac_reference`     | `hangar.reference` (AC rows)    | Bucketed by `tags.sourceType = 'ac'`                         |
| `knowledge_node`   | `study.knowledge_node`          | Internal graph node id                                       |
| `external_ref`     | none -- `target_id` is the data | Encodes `<url>\|<title>` via `EXTERNAL_REF_TARGET_DELIMITER` |

Soft FK rationale: a real per-type FK would require either nullable-FK fan-out (option B) or per-type tables (option C). Both lose the symmetric "cited by" query surface across types. The BC is the integrity gate -- it verifies the source row exists and is owned by the caller, and that the target row exists, before inserting. See [content-citations/spec.md](../work-packages/content-citations/spec.md) decision 1.

Constraints baked into the migration:

- `CHECK source_type IN (...)` and `CHECK target_type IN (...)` mirror `CITATION_SOURCE_VALUES` and `CITATION_TARGET_VALUES`
- `CHECK char_length(citation_context) <= 500` mirrors `CITATION_CONTEXT_MAX_LENGTH`
- `UNIQUE (source_type, source_id, target_type, target_id)` -- duplicate inserts surface as `DuplicateCitationError` from PG `23505`
- General lookup indexes on `(source_type, source_id)` and `(target_type, target_id)`
- Partial indexes on `source_id WHERE source_type = 'card'` and `target_id WHERE target_type = 'regulation_node'` for the hot read paths

IDs use the `ccit_` prefix via [generateContentCitationId](../../libs/utils/src/ids.ts) -- never call `createId` or `ulid` directly.

## API surface

Citation exports re-emitted from the `@ab/bc-study` barrel: [libs/bc/study/src/citations/index.ts](../../libs/bc/study/src/citations/index.ts).

| Export                         | Purpose                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `createCitation(input, db?)`   | Validate source ownership + target existence, insert. Throws typed errors below.       |
| `deleteCitation(id, userId)`   | Owner-only delete. Returns `CitationNotFoundError` for both missing and not-owned.     |
| `getCitationsOf(srcType, id)`  | Source-side read. Raw rows ordered by `createdAt`. Pair with `resolveCitationTargets`. |
| `getCitedBy(tgtType, id)`      | Target-side read. Raw rows ordered by `createdAt`. Pair with `resolveCitationSources`. |
| `resolveCitationTargets(rows)` | Batch-enrich rows with target display data (`label`, `detail`, `href`).                |
| `resolveCitationSources(rows)` | Batch-enrich rows with source display data (`label`, `detail`, `exists`).              |
| `searchRegulationNodes(q)`     | Picker search backing for `regulation_node` tab.                                       |
| `searchAcReferences(q)`        | Picker search backing for `ac_reference` tab.                                          |
| `searchKnowledgeNodes(q)`      | Picker search backing for `knowledge_node` tab.                                        |

Typed errors thrown by `createCitation` / `deleteCitation`:

| Error                          | When                                                       | Route should map to                  |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------ |
| `CitationValidationError`      | Bad source/target type, missing ids, context > 500 chars   | `fail(400, ...)`                     |
| `CitationSourceNotFoundError`  | Source row missing or not owned by caller                  | `error(404, ...)`                    |
| `CitationTargetNotFoundError`  | Target row missing or invalid external URL                 | `fail(400, ...)`                     |
| `DuplicateCitationError`       | `(srcType, srcId, tgtType, tgtId)` already exists          | `fail(409, ...)`                     |
| `CitationNotFoundError`        | Delete: id missing or not owned by caller                  | `fail(404, ...)`                     |

Reference wiring for the error mapping: [apps/study/src/routes/(app)/memory/[id]/+page.server.ts](../../apps/study/src/routes/(app)/memory/[id]/+page.server.ts) and [apps/study/src/routes/(app)/reps/[id]/+page.server.ts](../../apps/study/src/routes/(app)/reps/[id]/+page.server.ts).

Batch enrichment is O(distinct-target-types), not O(citations) -- both `resolveCitationTargets` and `resolveCitationSources` bucket the rows and fire one query per type. Don't loop and call them per-row.

## UI components

Layering rule: `libs/ui/` depends on `libs/constants/` only -- never on a BC. Every component takes a normalized `items` prop so the route layer projects from `CitationWith{Target,Source}` into the component shape.

| Component                                                                                              | Use                                                            | Key props                                                                              |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [CitationPicker](../../libs/ui/src/components/CitationPicker.svelte)                                   | Modal: tabs per target type, search, optional context note     | `bind:open`, `targetTypes`, `onSelect({targetType, targetId, note})`, `onCancel`       |
| [CitationChips](../../libs/ui/src/components/CitationChips.svelte)                                     | Inline list of citations under content                         | `items`, `editable`, `removeAction` (form-action path)                                 |
| [CitedByPanel](../../libs/ui/src/components/CitedByPanel.svelte)                                       | Reverse-lookup panel on a target detail page                   | `items`, `heading`, `emptyMessage`, `headingLevel`                                     |

Picker behaviors worth knowing before you wire it:

- `targetTypes` is a whitelist; pass a single-element array to render without tabs
- The picker does not auto-close on submit -- the caller closes after success and may show a toast
- External-ref tab has no server search; the picker collects `URL + title` inline and encodes them as `<url>|<title>` in `targetId` using `EXTERNAL_REF_TARGET_DELIMITER`. The BC and `resolveCitationTargets` round-trip the same delimiter
- Search debounce is 200ms, hitting [/api/citations/search](../../apps/study/src/routes/api/citations/search/+server.ts), which dispatches to the `searchX` helpers

## Mounting on a new surface

Adding citations to a new authoring surface is five wires: a load, an enrich, an add action, a remove action, and the picker mounted in the page. Reference: [apps/study/src/routes/(app)/reps/[id]/](../../apps/study/src/routes/(app)/reps/[id]).

### 1. Server load -- read + enrich

```typescript
import { type CitationWithTarget, getCitationsOf, resolveCitationTargets } from '@ab/bc-study';
import { CITATION_SOURCE_TYPES } from '@ab/constants';

export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);
  const [thing, citationRows] = await Promise.all([
    getThing(event.params.id, user.id),
    getCitationsOf(CITATION_SOURCE_TYPES.SCENARIO, event.params.id),
  ]);
  if (!thing) error(404, { message: 'Not found' });

  const citations: CitationWithTarget[] = await resolveCitationTargets(citationRows);
  return { thing, citations };
};
```

### 2. Server actions -- add + remove

Catch each typed error and map to the matching `fail` / `error` per the table above. Copy the shape directly from [memory/[id]/+page.server.ts:156](../../apps/study/src/routes/(app)/memory/[id]/+page.server.ts) -- the `addCitation` and `removeCitation` actions there are the canonical pattern.

Two non-obvious rules:

- The BC re-verifies source ownership inside `createCitation`, but the route should also short-circuit (e.g. `getThing(...)` before calling `createCitation`) so a non-owner sees a clean 404 instead of a `CitationSourceNotFoundError`
- `deleteCitation` collapses "missing" and "not owned" into one error type on purpose -- map both to 404 so the learner sees "already gone" rather than 403/404 leaking ownership info

### 3. Page -- chips + picker

```svelte
<script lang="ts">
import { CITATION_TARGET_LABELS, CITATION_TARGET_TYPES, ROUTES } from '@ab/constants';
import CitationChips, { type CitationChipItem } from '@ab/ui/components/CitationChips.svelte';
import CitationPicker, { type CitationPickerSelection } from '@ab/ui/components/CitationPicker.svelte';

let { data } = $props();

let citationPickerOpen = $state(false);
const citationItems = $derived<CitationChipItem[]>(
  data.citations.map((c) => ({
    id: c.citation.id,
    typeLabel: CITATION_TARGET_LABELS[c.target.type],
    label: c.target.label,
    href: c.target.href ?? null,
    context: c.citation.citationContext,
  })),
);
const removeAction = $derived(`${ROUTES.THING(data.thing.id)}?/removeCitation`);

async function handleSelect(s: CitationPickerSelection): Promise<void> {
  const body = new FormData();
  body.set('targetType', s.targetType);
  body.set('targetId', s.targetId);
  body.set('note', s.note);
  const res = await fetch(`${ROUTES.THING(data.thing.id)}?/addCitation`, { method: 'POST', body });
  if (!res.ok) throw new Error('Could not add citation.');
  citationPickerOpen = false;
  await invalidateAll();
}
</script>

<CitationChips items={citationItems} editable removeAction={removeAction} />
<button onclick={() => (citationPickerOpen = true)}>+ Cite a reference</button>
<CitationPicker
  bind:open={citationPickerOpen}
  targetTypes={[
    CITATION_TARGET_TYPES.REGULATION_NODE,
    CITATION_TARGET_TYPES.AC_REFERENCE,
    CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
    CITATION_TARGET_TYPES.EXTERNAL_REF,
  ]}
  onSelect={handleSelect}
  onCancel={() => (citationPickerOpen = false)}
/>
```

### 4. Cited-by panel on a target page

For a new target type's detail page, mirror [knowledge/[slug]/+page.server.ts:87](../../apps/study/src/routes/(app)/knowledge/%5Bslug%5D/+page.server.ts) or [references/[id]/+page.server.ts](../../apps/study/src/routes/(app)/references/%5Bid%5D/+page.server.ts).

```typescript
const citedByRows = await getCitedBy(CITATION_TARGET_TYPES.KNOWLEDGE_NODE, node.id);
const citedBy: CitationWithSource[] = await resolveCitationSources(citedByRows);
```

Project to `CitedByItem` with the route mapped per source type (card -> memory, rep/scenario -> reps, node -> knowledge), then render `<CitedByPanel items={...} />`.

## Why citations live in bc-study

Citations were originally extracted into a sibling `libs/bc/citations` package, but its only domain was three ownership predicates over study tables (`cardExistsForUser`, `knowledgeNodeExists`, `scenarioExistsForUser`) and the `content_citations` row already lives in the `study` Postgres schema. Per [bc-citations-coupling](../work-packages/bc-citations-coupling/spec.md) the package was folded into bc-study; the citation BC functions live in [libs/bc/study/src/citations/](../../libs/bc/study/src/citations) and are re-exported from the `@ab/bc-study` barrel so route imports stay clean.

If a future BC needs citation reads of its own (a third consumer with its own domain), that's the trigger to extract a real citations BC -- with policies, link-rot, and audit -- not just three ownership lookups.

The public-card composer in [libs/bc/study/src/cards-public.ts](../../libs/bc/study/src/cards-public.ts) (`composePublicCardCitations`) keeps citation projection out of the BC core: the route layer hydrates citations via `getCitationsOf` / `resolveCitationTargets`, then calls the composer to project the public-safe shape. Same structural-input pattern still applies if a future surface needs its own projection helper.

## Constants

All citation vocabulary lives in [libs/constants/src/citations.ts](../../libs/constants/src/citations.ts):

- `CITATION_SOURCE_TYPES`, `CITATION_SOURCE_VALUES`, `CITATION_SOURCE_LABELS`
- `CITATION_TARGET_TYPES`, `CITATION_TARGET_VALUES`, `CITATION_TARGET_LABELS`
- `CITATION_CONTEXT_MAX_LENGTH` (500)
- `EXTERNAL_REF_TARGET_DELIMITER` (`|`)

The picker route lives at `ROUTES.API_CITATIONS_SEARCH` in [libs/constants/src/routes.ts:82](../../libs/constants/src/routes.ts).

## Testing

Unit tests for the pure mapping logic (delimiter round-trip, URL validation, missing-target branches) live in [libs/bc/study/src/citations/citations.test.ts](../../libs/bc/study/src/citations/citations.test.ts) using a fake DB that returns canned rows. Use the same shape when adding tests for new source or target types -- DB-touching paths (ownership lookups, the unique-violation surface) are covered by integration tests against the real Postgres fixture.

The picker has a DOM contract test in [libs/ui/\_\_tests\_\_/CitationPicker.svelte.test.ts](../../libs/ui/__tests__/CitationPicker.svelte.test.ts) (closed gating, tab structure when open).

## Open items

- **Knowledge-node source ownership is open in v1.** `verifySourceOwnership` for `CITATION_SOURCE_TYPES.NODE` accepts any authenticated user (see [citations.ts:164](../../libs/bc/study/src/citations/citations.ts)). Per-node ACLs land with the node-editor work.
- **No public citation discovery.** The "most-cited regulations" / leaderboard surfaces are explicitly out of scope per [content-citations/spec.md](../work-packages/content-citations/spec.md). Add as a follow-up WP if coverage data shows we need it.
- **No auto-backfill.** Existing card bodies are not regex-scanned for `14 CFR X.Y` patterns. Manual citation only; out of scope per the same spec.

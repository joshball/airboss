---
title: 'Design: Stage-5 citation deep-linking'
product: study
feature: stage5-citation-deeplink
type: design
status: unread
review_status: pending
---

# Design: Stage-5 citation deep-linking

## Key decision: collapse `regulation_node` + `ac_reference` into one polymorphic `reference_section` target type

The previous enum split was a labelling artefact -- `regulation_node` and `ac_reference` both pointed at the same `hangar.reference` table differentiated only by `tags.sourceType`. Repointing at `study.reference` exposes 12 corpus kinds (REFERENCE_KINDS in `libs/constants/src/study.ts`); growing the enum 1:1 means a constant churn whenever a new corpus lands.

Options considered:

1. **Per-corpus target types** -- `cfr_section`, `ac_section`, `aim_paragraph`, `acs_task`, etc. Rejected: enum churn on every new corpus, picker/audit/render dispatch grows linearly.
2. **One `reference_section` polymorphic type** -- target_id = `study.reference_section.id`. Corpus is read from the joined `study.reference.kind`. **Chosen.** Picker / audit / render all dispatch on one type; corpus is data, not enum value.
3. **Two-tier: keep `regulation_node` for "regulation-y" things, `reference_section` for everything else.** Rejected: arbitrary line, same labelling artefact.

The migration drops `regulation_node` and `ac_reference` from `CITATION_TARGET_VALUES` over two releases (CHECK constraint expanded -> data migrated -> CHECK contracted). Dev has zero affected rows; prod is empty too (the picker has been broken since launch). The two-step pattern matches the project's "no legacy in airboss" rule -- the residual values are gone in the second release, not deferred.

## Schema

### Migration 1: add new target type (additive)

```sql
-- libs/constants/src/citations.ts
export const CITATION_TARGET_TYPES = {
  REFERENCE_SECTION: 'reference_section', // NEW
  REGULATION_NODE: 'regulation_node',     // legacy, dropped in migration 2
  AC_REFERENCE: 'ac_reference',           // legacy, dropped in migration 2
  KNOWLEDGE_NODE: 'knowledge_node',
  EXTERNAL_REF: 'external_ref',
} as const;
```

CHECK constraint on `study.content_citations.target_type` expands to include `reference_section`. No data move yet.

### Migration 2: backfill + retire legacy values

```sql
-- For every existing row (zero in dev today):
UPDATE study.content_citations
SET target_type = 'reference_section', target_id = (
  SELECT rs.id FROM study.reference_section rs
  JOIN study.reference r ON rs.reference_id = r.id
  WHERE r.id = study.content_citations.target_id
  LIMIT 1
)
WHERE target_type IN ('regulation_node', 'ac_reference');

-- Then retire the legacy values:
ALTER TABLE study.content_citations DROP CONSTRAINT content_citation_target_type_check;
ALTER TABLE study.content_citations ADD CONSTRAINT content_citation_target_type_check
  CHECK (target_type IN ('reference_section', 'knowledge_node', 'external_ref'));
```

Constants drop the legacy keys in the same PR. We follow drizzle-kit migrate convention (per `drizzle/README.md` -- `db push` is the dev pattern; the production path will exercise the migration when it ships).

### `study.reference_section.airboss_ref`

```typescript
// libs/bc/study/src/schema.ts -- additions to referenceSection
airbossRef: text('airboss_ref').notNull(),
// CHECK: airboss_ref ~ '^airboss-ref:'
```

Drizzle table additions:

```typescript
(t) => ({
  // ... existing indexes ...
  airbossRefShapeCheck: check(
    'reference_section_airboss_ref_shape_check',
    sql`"airboss_ref" ~ '^airboss-ref:'`,
  ),
  // Unique per-reference: same airboss_ref means same section, by definition.
  airbossRefUnique: uniqueIndex('reference_section_airboss_ref_unique').on(t.airbossRef),
})
```

Backfill in migration 2 walks the existing seeders' URI-builders against current rows (handbooks/ingest.ts:149, regs/normalizer.ts:116, aim/ingest.ts:134, etc.) and writes the URI per row. Future seed runs populate the column at insert time.

## API Surface

### New library helper: `urlForReferenceSection`

```typescript
// libs/sources/src/url-for-reference-section.ts
import { ROUTES } from '@ab/constants';
import type { SourceId } from './types.ts';
import { urlForReference } from './url-for-reference.ts';

/**
 * Convenience wrapper -- given the airboss_ref URI from a reference_section
 * row, return the flightbag URL path. Equivalent to calling urlForReference
 * directly; exists so callers don't have to cast their persisted text
 * column to SourceId at every site.
 */
export function urlForReferenceSection(airbossRef: string): string {
  return urlForReference(airbossRef as SourceId);
}
```

Trivially thin -- the work was already done by the existing `urlForReference` dispatcher (PR #562's research confirmed it covers all 8 corpora). The helper exists as a typed entry point and a single place to put a docstring explaining the contract.

### Updated `resolveCitationTargets` shape

The existing `CitationWithTarget` shape (libs/bc/study/src/citations/citations.ts:91-103) gets `href` populated per target type:

```typescript
return citations.map((c) => {
  const targetType = c.targetType as CitationTargetType;

  if (targetType === CITATION_TARGET_TYPES.REFERENCE_SECTION) {
    const row = sectionByTargetId.get(c.targetId);
    if (row === undefined) {
      // Dead target -- audit surfaces it; chip renders with (missing) suffix.
      return { citation: c, target: { type: targetType, id: c.targetId, label: c.targetId, detail: 'Section (missing)' } };
    }
    return {
      citation: c,
      target: {
        type: targetType,
        id: c.targetId,
        label: `${row.referenceTitle} ${row.code}`.trim(),
        detail: SOURCE_TYPE_LABELS[row.referenceKind],
        href: urlForReferenceSection(row.airbossRef),
      },
    };
  }

  if (targetType === CITATION_TARGET_TYPES.KNOWLEDGE_NODE) {
    const node = nodeById.get(c.targetId);
    return {
      citation: c,
      target: {
        type: targetType,
        id: c.targetId,
        label: node?.title ?? c.targetId,
        detail: node === undefined ? 'Knowledge node (missing)' : 'Knowledge node',
        href: node === undefined ? undefined : ROUTES.KNOWLEDGE_NODE(c.targetId),
      },
    };
  }

  // external_ref -- unchanged.
  // ...
});
```

### Updated `searchReferenceSections`

Single new BC helper replaces `searchRegulationNodes` and `searchAcReferences`:

```typescript
// libs/bc/study/src/citations/search.ts
export interface SectionSearchResult {
  id: string;             // reference_section.id
  label: string;          // "14 CFR §91.103" / "PHAK Ch 12 §12.3"
  detail: string;         // SOURCE_TYPE_LABELS[reference.kind]
  airbossRef: string;     // airboss-ref: URI -- powers chip href without re-fetch
}

export async function searchReferenceSections(
  query: string,
  limit: number = DEFAULT_LIMIT,
  db: Db = defaultDb,
): Promise<SectionSearchResult[]> {
  const pattern = buildTermPattern(query);
  const rows = await db
    .select({
      id: referenceSection.id,
      code: referenceSection.code,
      sectionTitle: referenceSection.title,
      airbossRef: referenceSection.airbossRef,
      referenceTitle: reference.title,
      referenceKind: reference.kind,
      documentSlug: reference.documentSlug,
    })
    .from(referenceSection)
    .innerJoin(reference, eq(reference.id, referenceSection.referenceId))
    .where(
      query.trim().length === 0
        ? sql`true`
        : or(
          ilike(referenceSection.code, pattern),
          ilike(referenceSection.title, pattern),
          ilike(reference.title, pattern),
          ilike(reference.documentSlug, pattern),
        ),
    )
    .orderBy(reference.documentSlug, referenceSection.code)
    .limit(clampLimit(limit));

  return rows.map((r) => ({
    id: r.id,
    label: formatSectionLabel(r),  // "14 CFR §91.103 -- Preflight action"
    detail: SOURCE_TYPE_LABELS[r.referenceKind as ReferenceSourceType] ?? r.referenceKind,
    airbossRef: r.airbossRef,
  }));
}
```

`searchRegulationNodes` and `searchAcReferences` are removed (no legacy carry-over per project rule).

### Updated `verifyTargetExists`

```typescript
// libs/bc/study/src/citations/citations.ts
async function verifyTargetExists(targetType: CitationTargetType, targetId: string, db: Db): Promise<boolean> {
  switch (targetType) {
    case CITATION_TARGET_TYPES.REFERENCE_SECTION: {
      const rows = await db
        .select({ id: referenceSection.id })
        .from(referenceSection)
        .where(eq(referenceSection.id, targetId))
        .limit(1);
      return rows.length > 0;
    }
    case CITATION_TARGET_TYPES.KNOWLEDGE_NODE: {
      // unchanged
    }
    case CITATION_TARGET_TYPES.EXTERNAL_REF: {
      // unchanged
    }
    // legacy regulation_node / ac_reference branches removed in migration 2
  }
}
```

## Component Structure

### `CitationPicker.svelte` -- tab consolidation

Today: 4 tabs (regulation_node, ac_reference, knowledge_node, external_ref).
After: 3 tabs (reference_section, knowledge_node, external_ref).

The Section tab uses the unified `searchReferenceSections` BC helper. Result rows render a single line: `"14 CFR §91.103 -- Preflight action"` with a `[CFR]` corpus badge. No per-corpus tab nesting -- a single search box is faster and matches the picker's existing UX (one search box per tab).

Internal handler shape stays the same; only the tab list and the search call change.

### `CitationChips.svelte` -- href + target rules

Replaces the existing `target="_blank" rel="noopener noreferrer"` blanket rule with per-target rules:

```svelte
{#each items as item (item.id)}
  <li class="citation-chip">
    {#if item.href && item.targetExternal}
      <a class="citation-label" href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
    {:else if item.href}
      <a class="citation-label" href={item.href}>{item.label}</a>
    {:else}
      <span class="citation-label">{item.label}</span>
    {/if}
  </li>
{/each}
```

`CitationChipItem` gains an optional `targetExternal?: boolean` flag. The route layer that builds the items array sets `targetExternal = true` only when the citation's target_type is `external_ref`.

### Cross-app link origin

Citation chips render in `apps/study`; flightbag URLs live in `apps/flightbag`. The chip needs the absolute origin or a sibling-app helper:

- Today's `libs/library/CitationChip.svelte` calls `urlForReference(uri)` and renders the path directly. Same-origin in dev (single bun dev server proxy) but different origin in prod.
- Pattern to mirror: read the helper at the chip render layer, prefix with `siblingOrigin('flightbag')` from `@ab/utils` if present, else trust SvelteKit's same-origin nav.

Concrete decision: route layer (the `+page.server.ts` that builds `CitationChipItem[]`) prefixes origin via the existing `siblingOrigin('flightbag')` helper when the target_type is `reference_section`. Chip component stays pure render.

## Data Flow

```text
[Card detail page load]
    -> getCitationsOf(card_source_type, card_id)
    -> resolveCitationTargets([rows])
        -> batched select on study.reference_section JOIN study.reference
            (extracts airbossRef + title + kind for each section)
        -> per-row: target.href = urlForReferenceSection(airbossRef)
                    target.label = formatSectionLabel(...)
                    target.detail = SOURCE_TYPE_LABELS[kind]
    -> page returns CitationWithTarget[] to client
    -> +page.svelte maps each to CitationChipItem (sets targetExternal flag)
    -> <CitationChips items={...} />
    -> per-item <a href={item.href} ...>{label}</a>

[User clicks chip]
    -> in-app navigation to flightbag URL
    -> flightbag reader resolves URL -> renders the section
```

The audit job ([scripts/sources/audit-citations.ts](../../../scripts/sources/audit-citations.ts)) consumes the same data layer:

```text
[Audit run]
    -> auditCitations()
    -> walks content_citations
    -> for each row: dispatches on target_type
        - reference_section: verify section exists; no resolver-coverage check needed
          (the airboss_ref CHECK + urlForReference fallback covers correctness)
        - knowledge_node: verify node exists
        - external_ref: validate URL
    -> reports findings + per-corpus rollup (corpus from reference.kind)
```

## Key Decisions

| Question                                                         | Decision                                                        | Why                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Per-corpus target types vs one polymorphic type                  | One polymorphic `reference_section`                             | Corpus is data (`reference.kind`), not enum value. New corpora are additive without enum churn.                      |
| Compute airboss_ref on-the-fly vs persist it                     | Persist (NOT NULL column on reference_section)                  | 5 different URI shapes per corpus + audit symmetry. Storage cost is trivial.                                         |
| Per-corpus search tabs in picker vs unified Section tab          | Unified Section tab                                             | One search box scales to N corpora. Result rows carry a corpus badge so disambiguation is visual.                    |
| Drop `searchRegulationNodes` / `searchAcReferences` or wrap them | Drop entirely                                                   | Project rule: no legacy in airboss. Wrappers would dual-write the same query.                                        |
| Two-step migration vs one big migration                          | Two-step: additive expand, then contract                        | Allows the data move to land before the legacy enum values are removed. Matches drizzle-kit migrate's pattern.       |
| Open external links in new tab, internal links same tab          | Yes -- `target="_blank"` for external, `_self` for internal     | Internal links keep the user's study session in browser history. External links are PDFs/eCFR -- no harm in new tab. |
| Knowledge_node deep-link target                                  | `/knowledge/{id}` (study-side, not flightbag)                   | Knowledge nodes have detail pages in study; flightbag is for FAA references.                                         |
| Citation audit scheduled job: enable=true after this ships       | Yes -- last task in tasks.md                                    | Job exists; the gate was "real citations to audit," which this WP creates.                                           |
| `urlForReferenceSection` returns path or full URL                | Path; route layer prefixes flightbag origin via `siblingOrigin` | Matches existing CitationChip in libs/library/. Origin handling is a render-layer concern.                           |
| Tsvector for section search                                      | Out of scope (IDEAS.md follow-on triggered by p95 latency)      | Ilike is fine under 50k rows; corpus is well under.                                                                  |

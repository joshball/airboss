---
title: Ranking redesign -- worked examples
parent: REDESIGN.md
---

# Ranking redesign

## The current ranker (what's wrong)

`libs/help/src/search-core.ts` returns a 1/2/3 bucket:

- 1 = exact match on displayName or alias
- 2 = substring match on displayName or alias
- 3 = substring match on keyword or body

That's all. No type weighting. No depth penalty. A section titled `"weather vaning"` (bucket 2 on title) ties or beats a book titled `"Aviation Weather Handbook"` (bucket 2 on title) because both are bucket 2 -- and within a bucket, the ranker tie-breaks alphabetically, so the section that happens to come first wins.

## The new ranker

Each result gets a composite score:

```text
score(result, needle) =
    type_tier_weight(result.type)
  + title_match_tier(needle, result.title, result.aliases)
  + body_match_tier(needle, result.body, result.keywords)
  - depth_penalty(result.depth)
```

Higher score = better hit. Sort descending. Stable tie-break: alpha on title.

### type_tier_weight

| Type                           | Weight |
| ------------------------------ | ------ |
| Handbook root (FAA-H-*)        | 100    |
| AC (whole document)            | 90     |
| CFR Part root (e.g. 14 CFR 91) | 90     |
| AIM Chapter                    | 85     |
| Knowledge node                 | 80     |
| Study course                   | 80     |
| Glossary term                  | 75     |
| Handbook chapter               | 50     |
| CFR Section                    | 50     |
| AIM Paragraph                  | 45     |
| User's card / rep / plan       | 40     |
| App Help page                  | 20     |
| External tool                  | 10     |

### title_match_tier

| Match                                                                   | Bonus |
| ----------------------------------------------------------------------- | ----- |
| Exact title match (case-insensitive)                                    | 100   |
| Exact alias match                                                       | 95    |
| Exact doc-code match                                                    | 100   |
| Title or alias contains needle as a whole word                          | 60    |
| Title or alias contains needle as a substring                           | 30    |
| Doc code prefix-matches needle (e.g. `8083-28` against `FAA-H-8083-28`) | 80    |

### body_match_tier

| Match                 | Bonus |
| --------------------- | ----- |
| Keyword exact         | 25    |
| Body whole-word match | 15    |
| Body substring        | 5     |
| (No body match)       | 0     |

### depth_penalty

For section / chapter / paragraph results, subtract a small penalty per level deep:

```text
depth_penalty(depth) = depth * 3
```

So a chapter at depth 1 loses 3, a section at depth 2 loses 6, a paragraph at depth 3 loses 9. This is small enough that a tier-1 title match still wins at any depth, but large enough that body-only matches at depth 3 fall behind body-only matches at depth 1 in the same type bucket.

## Worked example: `weather`

| Result                                      | type_tier | title_match | body_match | depth | Total   |
| ------------------------------------------- | --------- | ----------- | ---------- | ----- | ------- |
| FAA-H-8083-28 Aviation Weather Handbook     | 100       | 60          | 0          | 0     | **160** |
| AC 00-6B Aviation Weather                   | 90        | 60          | 0          | 0     | **150** |
| Weather (study course)                      | 80        | 100         | 0          | 0     | **180** |
| AvWX glossary entry                         | 75        | 95          | 0          | 0     | **170** |
| Air Masses and Fronts (knowledge node)      | 80        | 0           | 15         | 0     | 95      |
| 14 CFR 121.101 (section about wx reporting) | 50        | 0           | 15         | 2     | 59      |
| AFH 14.5 weather vaning                     | 50        | 30          | 0          | 3     | 71      |
| AFH 17.8 wx considerations                  | 50        | 0           | 15         | 3     | 56      |
| AFH 0.6 introduction                        | 50        | 0           | 5          | 1     | 52      |
| App Help: search page about weather         | 20        | 30          | 0          | 0     | 50      |

Top hits (3): **Weather course (180), AvWX glossary (170), AC 00-6B Aviation Weather (150), AvWX handbook (160) -- top 3 by score**.

Actually re-sort:

1. Weather course — 180
2. AvWX glossary — 170
3. AvWX handbook — 160
4. AC 00-6B Aviation Weather — 150
5. Air Masses and Fronts (KB) — 95
6. AFH 14.5 weather vaning — 71

This is closer to what a pilot expects. The glossary entry beats the handbook by 10 points which is wrong -- a glossary blurb shouldn't outrank the actual handbook. **Tweak**: increase handbook-root type_tier from 100 to 110, or reduce glossary_term from 75 to 65. Trial-and-error during the walk.

Either way, the section-level noise (AFH 0.6 introduction, AFH 17.8 wx considerations, 14 CFR 121.101) is now at the bottom where it belongs.

## Worked example: `FAA-H-8083-28`

| Result                                  | type_tier | title_match | body_match | depth | Total   |
| --------------------------------------- | --------- | ----------- | ---------- | ----- | ------- |
| FAA-H-8083-28 Aviation Weather Handbook | 100       | 100 (code)  | 0          | 0     | **200** |
| Chapter 1 of FAA-H-8083-28              | 50        | 80 (prefix) | 0          | 1     | 127     |
| Chapter 2 of FAA-H-8083-28              | 50        | 80          | 0          | 1     | 127     |
| ...                                     |           |             |            |       |         |

The book is at 200, chapters at 127. **AND**: per the "book-level collapse" decision (R3), chapters are NOT separate rows in the result column. They're rolled up into `result.children` on the book row and shown in the detail pane.

Top hit: AvWX. Single row in the result column. Click the row, detail pane shows the chapter list (clickable).

## Worked example: `91.103`

| Result                                  | type_tier | title_match | body_match | depth | Total   |
| --------------------------------------- | --------- | ----------- | ---------- | ----- | ------- |
| 14 CFR §91.103 Preflight Action         | 50        | 100 (code)  | 0          | 2     | **144** |
| 14 CFR Part 91 (root)                   | 90        | 80 (prefix) | 0          | 0     | 170     |
| (sections in Part 91 mentioning 91.103) | 50        | 0           | 5          | 2     | 49      |

The Part beats the section here at 170 vs 144. The user typing `91.103` probably wants the SECTION, not the Part. **Tweak option**: bump `title_match_tier` for exact section-code match higher (currently 100); make it 150 for an exact section-code match.

Recalculated:

| Result                          | type_tier | title_match | body_match | depth | Total   |
| ------------------------------- | --------- | ----------- | ---------- | ----- | ------- |
| 14 CFR §91.103 Preflight Action | 50        | 150 (exact) | 0          | 2     | **194** |
| 14 CFR Part 91 (prefix match)   | 90        | 80          | 0          | 0     | 170     |

Now §91.103 wins. The user gets the section as the top hit; the Part is the runner-up.

## Per-intent ranker variations

The composite score above is the I-2 (broad search) default. The other two intents tweak the weights:

### I-1 (scoped search via `doc:<code>` chip)

- Filter all results to those whose canonical key matches the chip OR whose `cites: SourceId[]` field includes the chip's doc.
- Sort the headline doc first; then references-to-doc grouped by source type (lessons / knowledge nodes / cards / cross-doc citations).
- Within each reference group: by recency of last-edited (lessons, KB nodes) or by SRS due-date (user cards).
- No top-hits strip in this mode. No type-nav. Just the headline card + the references panel.

### I-3 (phrase-level FTS)

- `type_tier_weight` is INVERTED. Section-level types (handbook chapter, CFR section, AIM paragraph, KB-node paragraph) get a positive lift; whole-doc types are deranked or omitted.
- `title_match_tier` is SUPPRESSED -- if the user wanted a title match they'd have used a short query. Body matches dominate.
- `body_match_tier` is BOOSTED -- exact phrase match >> all words present >> some words present.
- `depth_penalty` is REVERSED -- a deeper section (a leaf paragraph) is actually preferable here, because the user is looking for a specific passage.
- Add `passage_relevance` from Postgres `ts_rank_cd` (or `ts_rank`) of the underlying FTS query.

Composite:

```text
score_phrase_fts(needle, r) =
    section_type_weight(r.type)          // inverted: chapter > book
  + body_match_tier_boosted(needle, r.body)
  + ts_rank_cd_lift(r.fts_rank)
  + depth_bonus(r.depth)                 // deeper = more specific = better
```

Worked example for `"dusk vs sunset"` (note: quoted, so I-3 forced):

| Result                                                      | Type         | Body match  | ts_rank | Total (I-3) |
| ----------------------------------------------------------- | ------------ | ----------- | ------- | ----------- |
| 14 CFR §1.1 General Definitions (defines "night" inc. dusk) | faa.cfr.sect | exact-words | 0.82    | ~180        |
| 14 CFR §61.57 Recent Flight Experience (night currency)     | faa.cfr.sect | exact-words | 0.71    | ~165        |
| AIM 4-3-22 Night Flight Operations                          | faa.aim      | all-words   | 0.45    | ~120        |
| FAA-H-8083-3 AFH (whole book)                               | faa.handbook | (some body) | 0.15    | ~30         |

The whole-doc AFH falls way below the relevant sections. Good. User gets the passages they wanted.

### Intent classification (skeleton)

```ts
// libs/help/src/intent-classifier.ts

export type SearchIntent = 'scoped' | 'broad' | 'phrase-fts';

export function classifyIntent(parsed: ParsedQuery, autocompleteCommitted: boolean): SearchIntent {
  // I-1: user committed an autocomplete entry, which set `doc:<code>` chip.
  if (parsed.filters.some((f) => f.key === 'doc')) return 'scoped';

  // I-3: explicit phrase markers.
  if (rawHasQuotes(parsed.rawQuery)) return 'phrase-fts';
  if (wordCount(parsed.freeText) >= 4) return 'phrase-fts';
  if (!hasTitlePrefixMatch(parsed.freeText)) return 'phrase-fts';

  // I-2: default.
  return 'broad';
}
```

The boundary between I-2 and I-3 is heuristic. Tune during the walk:

- `weather` -> I-2 (short, matches handbook title prefix).
- `aviation weather` -> I-2 (matches AvWX title prefix).
- `aviation weather currency rules` -> I-3 (4 words, no perfect title match).
- `dusk vs sunset` -> I-3 (3 words but no title match).
- `"VFR minimums"` -> I-3 (quoted).

## Tuning loop

Don't ship these numbers as gospel. After implementing the new ranker:

1. Walk every query in `docs/work-packages/command-palette/test-plan.md`'s manual table.
2. For each query, ASSERT (in test or by eye) that the expected top hit is the top hit.
3. Where the ranker is wrong, adjust one of the tier weights and re-run.
4. Lock the numbers as constants in `libs/help/src/search-core.ts` once the test table passes.

A small JSON fixture at `libs/help/src/__tests__/ranker-fixtures.json` makes this fast: query + expected top result + acceptable top-3 set.

## Implementation skeleton

```ts
// libs/help/src/search-core.ts

import type { SearchResultType } from './schema/result-types';

const TYPE_TIER: Record<SearchResultType, number> = {
  'faa.handbook': 100,
  'faa.cfr.part': 90,
  'faa.ac': 90,
  'faa.aim': 85,
  'airboss.knode': 80,
  'airboss.course': 80,
  'airboss.glossary': 75,
  'faa.handbook.chapter': 50,
  'faa.cfr.sect': 50,
  // ... rest of the table
};

function scoreResult(needle: string, r: SearchResultInput): number {
  const tier = TYPE_TIER[r.type] ?? 0;
  const titleScore = titleMatchTier(needle, r.title, r.aliases, r.docCode);
  const bodyScore = bodyMatchTier(needle, r.body, r.keywords);
  const depthPenalty = (r.depth ?? 0) * 3;
  return tier + titleScore + bodyScore - depthPenalty;
}
```

Drop-in replacement for the existing `rankBucket()` call sites in `libs/help/src/search.ts`.

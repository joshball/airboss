---
title: 'Design: Study home'
product: study
feature: study-home
type: design
status: draft
review_status: pending
created: 2026-05-04
---

## Layout sketch

The page is a single column with three sections, top to bottom. ASCII layout (verbatim from the design conversation):

```text
+-----------------------------------------------------------------------------------+
|  STUDY                                                       [Private Pilot ASEL v]|
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   Where you are                                                                    |
|                                                                                    |
|   ████████░░░░░░░░░░░░  37%      ███░░░░░░░░░░░░░░░░  18%      █░░░░░░░░░░  4%   |
|   Understood              Memorized               Practiced                        |
|   154 / 412               74 / 412                17 / 412                         |
|                                                                                    |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   Today                                                                            |
|                                                                                    |
|   Weight & balance -- arm and moment                                               |
|   You've been working on this for 3 days. You're 60% understood,                   |
|   25% memorized. No practice yet. The next gap is the arm-and-moment               |
|   formula -- you miss it 4 out of 10 times.                                        |
|                                                                                    |
|   How would you like to study it?                                                  |
|                                                                                    |
|   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ ┌──────────┐                |
|   │  Read   │ │  Cards  │ │   Sim   │ │ Scenarios   │ │  Flight  │                |
|   │         │ │         │ │         │ │             │ │          │                |
|   │ PHAK    │ │  12 due │ │  1 ready│ │   3 ready   │ │  log a   │                |
|   │ ch. 10  │ │  4 new  │ │         │ │             │ │  flight  │                |
|   └─────────┘ └─────────┘ └─────────┘ └─────────────┘ └──────────┘                |
|                                                                                    |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   The map                                                          [ACS][HB][Course]|
|                                                                                    |
|   ▾ I.  Preflight Preparation                              ●●●○○○○○○○ 32%         |
|     ▸ A. Pilot Qualifications                              ●●●●●○○○○○ 50%         |
|     ▾ B. Airworthiness Requirements                        ●●○○○○○○○○ 20%         |
|         ⊙ Required equipment for flight (91.205)           U:●  M:○  P:--         |
|         ○ Inoperative equipment (91.213)                   U:○  M:○  P:--         |
|     ▸ C. Weather Information                               ●○○○○○○○○○ 10%         |
|   ▸ II. Preflight Procedures                               ○○○○○○○○○○  0%         |
|   ▸ III. Airport Operations                                ●○○○○○○○○○  8%         |
|   ▸ IV. Takeoffs, Landings, and Go-Arounds                 ○○○○○○○○○○  0%         |
|   ...                                                                              |
|                                                                                    |
+-----------------------------------------------------------------------------------+
```

Per-leaf row, expanded:

```text
⊙  Recency of experience (61.57)              U:●  M:○  P:○
   Handbook                                  Regulation
     PHAK ch.10 sec.4                          14 CFR 61.57
     PHAK ch.10 sec.5                          14 CFR 61.51
     AC 90-66                                                   [hb][reg]
```

## Key technical decisions

### Decision 1: Pure surface composition, no new BC

Every data point on this page comes from existing exports. The WP introduces zero new BC functions and zero schema. Rationale:

- The substrate is already there; the value is in arrangement.
- Limits scope; ships in days, not weeks.
- Avoids coupling the home page to specific data shapes that may evolve.

Three small exceptions to the "no new BC, no schema" guard rail, all decided and minimal:

1. `getFirstTouchDate(userId, nodeId)` helper in `dashboard.ts` for the Today prose day count.
2. `getUserPrefs` / `setUserPref` BC pair against the new `study.user_pref` table.
3. `study.user_pref` table itself.

Every other data point is composed from existing exports.

### Decision 2: Today prose is a deterministic template

No LLM. Three reasons:

- Legibility: a template's behavior is auditable in tests; an LLM's is not.
- Determinism: the same inputs render the same prose, so the test plan can assert exact strings.
- Cost / latency: SSR-time prose generation should be free and synchronous.

Template grammar (pseudocode):

```text
TodayBriefing
  | { kind: 'caught_up' }                                   -> "You're caught up. Pick a topic from the map to dig in."
  | { kind: 'never_attempted', leafTitle, primaryCitation } -> "{leafTitle}. You haven't started this yet. {primaryCitation} covers it."
  | { kind: 'low_accuracy',    leafTitle, recall, scenario } -> "{leafTitle}. You miss this {misses} out of {attempts} times. {nextAction}."
  | { kind: 'overdue',         leafTitle, dueCards }        -> "{leafTitle}. You have {dueCards} cards due on this. {nextAction}."
  | { kind: 'partial',         leafTitle, gaps }            -> "{leafTitle}. You're {recallPct}% understood, {calcPct}% memorized. {gapDescription}."

nextAction = 'Try a scenario.' | 'Review the cards.' | 'Re-read the section.'
gapDescription = 'No practice yet. The next gap is X.' | etc.
```

The prose generator lives in a pure helper -- `apps/study/src/routes/(app)/study/_lib/today-prose.ts` -- with vitest unit tests asserting exact strings for each `kind`. Importantly: the helper is a *pure function* over a `TodayBriefing` value object built by the loader, not a function that touches the DB directly.

### Decision 3: Three-number progress, not composite

`getCredentialMastery().byEvidenceKind` already partitions by `AssessmentMethod`. We render three independent percentages with absolute counts. A single composite score hides which dimension is the gap; the three-pill view tells the user "you understand, but haven't memorized" or "you've practiced but never read." That's load-bearing for someone returning after time away.

### Decision 4: Three map projections share one renderer interface

Each projection produces a tree of nodes that share a common rendering shape. Defining a `MapNode` interface that all three can produce keeps the rendering code single-source:

```typescript
type MapNode = {
  id: string;
  label: string;
  level: 'group' | 'subgroup' | 'leaf';
  rollup: { masteredLeaves: number; totalLeaves: number; coveredLeaves: number } | null;
  pills?: NodeEvidenceState | null;
  children: MapNode[];
  citations?: { handbook: CitationChip[]; regulation: CitationChip[] };
  href?: string;
  defaultOpen?: boolean;
};
```

- ACS projection populates `pills` on leaves (from `getNodeEvidenceStateMap`) and `citations` from the leaf's syllabus_node citations.
- Handbook projection populates `rollup` on chapters (from citing-nodes union) and leaves are knowledge node summaries (no `pills`; node detail page is one click away).
- Course projection populates `rollup` on lessons (from cited nodes / leaves) and per-lesson links to the lesson markdown render.

A single `<MapTree>` Svelte component takes a `MapNode[]` and recursively renders. Per-projection logic lives in three loader helpers (`buildAcsTree`, `buildHandbookTree`, `buildCourseTree`).

### Decision 5: Tab switch via URL param, not client state

Tabs are full page navigations with a `?tab=` query param. Rationale:

- Server-side rendering is simpler.
- Browser back-button works as expected.
- Per-tab data fetches don't require client-side fetch plumbing.

LocalStorage stores the user's *preferred* tab so the first visit auto-selects it. Subsequent navigations honor the URL.

### Decision 6: Citation panel state is per-leaf, preference is per-user, persisted server-side

Each citation panel `<details>` opens / closes independently (browser-native state, not persisted). The hb / reg toggle inside a panel writes to `study.user_pref` via a form-action POST (`?/setPref&key=study.home.citation_order`). Subsequently opened panels read the new default from the server-rendered loader.

Optimistic UI: clicking the toggle flips the visual state immediately; the form action runs asynchronously; on error the toggle reverts and a toast surfaces.

Same pattern for the map tab preference (`study.home.map_tab`).

### Decision 7: Course projection contract -- heavy frontmatter, all weeks backfilled

The FAR navigation course at `course/regulations/` has lesson markdown files with frontmatter. **Every lesson must carry an authored `cites:` block** with three explicit lists:

```yaml
---
title: '...'
week: 1
lesson: 3
cites:
  knowledge_nodes:
    - aerodynamics/four-forces
    - aerodynamics/angle-of-attack-and-stall
  acs_leaves:
    - PA.I.B.K1
    - PA.I.B.K2
  handbook_sections:
    - faa-h-8083-25c#chapter=4
    - 14-cfr-91#section=91.103
---
```

The Course projection's loader walks lesson files at module load (cached), reads frontmatter, and rolls up:

- For each `knowledge_nodes` slug: get the node's evidence state.
- For each `acs_leaves` code: resolve to a syllabus_node id and treat as a leaf.
- For each `handbook_sections`: link only -- not counted in the rollup.

**No `reading-only` fallback in v1.** A lesson without `cites:` is a content bug; CI fails on it. The Course tab assumes complete frontmatter.

Why heavy frontmatter:

- Mastery rollup is the entire value proposition of the Course tab. Without explicit ACS leaf mapping, a lesson can't contribute to any meaningful "you've learned 30% of this week" signal.
- Authoring `cites:` is content work, not engineering work. Doing it correctly once is cheap; doing it sloppily costs every reader.
- Heavy frontmatter is auditable: the validator (step 6 below) can check that every cited slug / code / section actually exists in the registry.

Backfill plan:

1. Walk `course/regulations/**/*.md`. ~70 lesson files across 10 weeks.
2. For each lesson, parse the body's existing `airboss-ref:` markers and propose a `handbook_sections` list.
3. Hand-author `knowledge_nodes` and `acs_leaves` per lesson -- this is the substantive work; reads each lesson and matches it to the knowledge graph + ACS task it teaches.
4. Where the right citation is ambiguous OR there is no matching ACS leaf (e.g., a lesson genuinely covers a non-ACS regulatory topic), pause and flag the lesson for review with a `pending_review:` frontmatter marker. **Do not silently ship `cites: []`.** Flagged lessons are surfaced in a follow-up content pass; the WP isn't blocked on every flagged lesson but ships clean for the unambiguous majority.
5. CI validator (`bun run check:course-frontmatter`) asserts every lesson has either `cites:` or `pending_review:`; absence of both is an error.

Tooling: a one-shot `tools/course-frontmatter-backfill.ts` script handles step 2 (mechanical extraction); steps 3 and 4 are content authoring assisted by the script's proposals.

### Decision 8: Status glyph on leaves uses required pills only

A leaf with assessment methods `['recall']` only needs `U:●` to be `✓`. A leaf with `['recall', 'scenario']` needs `U:●` and `P:●`. Glyph is computed from `aggregateLeafKindStates` over the leaf's required `AssessmentMethod`s, mapping to:

- All required pills mastered -> `✓`
- Any required pill non-zero attempts -> `⊙`
- All required pills zero attempts -> `○`

The pill display next to the glyph still shows all five `AssessmentMethod`s in their `--`/`○`/`●` form, but only the first three (recall = U, calculation = M, scenario / demonstration combined = P) are visible by default. Pills for `teaching` are hidden in v1 (CFI-only; surfaces when CFI cert becomes a primary goal).

## Schema

One new table: `study.user_pref`. Plus a small extension to the audit log target enum.

```typescript
// libs/db/src/schema/study/user-pref.ts
export const userPref = study.table('user_pref', {
  userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.key] }),
  keyIdx: index('user_pref_key_idx').on(t.key),
}));
```

Why this shape:

- Composite PK `(user_id, key)` -- one row per (user, preference). Upsert is a single `INSERT ... ON CONFLICT DO UPDATE`.
- `value` is `jsonb` so any preference shape can be stored without a schema change. v1 uses scalar strings; future preferences can be objects without migration.
- Audit log gets a new `AUDIT_TARGETS.USER_PREF = 'study.user_pref'` value. Each `setUserPref` emits one audit row.
- `key` namespacing convention: `'<surface>.<screen>.<field>'`. v1 keys: `'study.home.citation_order'`, `'study.home.map_tab'`.

This table is shared infra: WP 3 will reuse it for `'study.knowledge.render_mode'`, and any future preference lives here too. We don't grow a new pref table per surface.

### Why a table instead of localStorage

Decided in spec §Decisions Q7. Reasoning:

- Student progress is server-side already (cards, scenarios, evidence). Preferences are part of "what the user has chosen"; storing them on a different substrate (browser) is incoherent.
- Cross-device works correctly the moment a user signs in on a phone or tablet.
- The store is reused by WP 3 (mode toggle) and any future preference, so paying the cost once is right.

Tradeoff accepted: every preference change is a network round-trip. Acceptable -- pref changes are rare (handful per session at most), and the form-action POST is fast.

## API surface

```typescript
// apps/study/src/routes/(app)/study/+page.server.ts
export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = requireUser(locals).id;
  const tab = (url.searchParams.get('tab') ?? 'acs') as MapTab;

  const cred = await getCredentialPrimarySyllabus(userId);
  if (!cred) return { kind: 'no-goal' };

  const [mastery, weakAreas, repBacklog] = await Promise.all([
    getCredentialMastery(userId, cred.credentialId),
    getWeakAreas(userId, 1, db),
    getRepBacklog(userId),
  ]);

  const briefing = await buildTodayBriefing(userId, weakAreas, mastery, db);

  const tree = await buildMapTree(tab, userId, cred, mastery, briefing.focusNodeId, db);

  return { kind: 'home', cred, mastery, briefing, repBacklog, tab, tree };
};
```

`buildTodayBriefing` returns a `TodayBriefing` value object the page renders into prose via the deterministic template helper.

`buildMapTree` dispatches on `tab` to one of three loaders; each returns a `MapNode[]`.

```typescript
// apps/study/src/routes/(app)/study/_lib/build-acs-tree.ts
export async function buildAcsTree(
  userId: string,
  cred: CredentialPrimarySyllabus,
  mastery: CredentialMasteryRollup,
  focusAreaId: string | null,
  db: Db,
): Promise<MapNode[]> { ... }
```

(And similar for `build-handbook-tree.ts`, `build-course-tree.ts`.)

## Component structure

```text
apps/study/src/routes/(app)/study/
  +page.server.ts                       # loader + tab dispatch
  +page.svelte                          # composition only
  _lib/
    today-prose.ts                      # pure prose helper (vitest-tested)
    today-prose.test.ts
    build-acs-tree.ts                   # ACS projection loader
    build-handbook-tree.ts              # Handbook projection loader
    build-course-tree.ts                # Course projection loader (reads course/regulations)
    map-types.ts                        # MapNode + helpers
  _panels/
    ProgressPanel.svelte                # 3 progress bars
    TodayPanel.svelte                   # briefing prose + focus link
    TilesPanel.svelte                   # 5 tiles
    MapPanel.svelte                     # tab strip + tree
    MapTree.svelte                      # recursive tree renderer (single component, all projections)
    LeafRow.svelte                      # one leaf with pills + citation panel
    CitationStacks.svelte               # handbook + regulation stacks side-by-side
```

`+page.svelte` is composition only -- 5 panel imports + a layout grid. The cognitive load lives in panel components.

## Data flow

```text
+page.server.ts (load)
   |
   |--> getCredentialPrimarySyllabus -+
   |--> getCredentialMastery          |--> mastery rollup -> ProgressPanel
   |--> getWeakAreas                  |
   |--> getRepBacklog                 |--> tile badges -> TilesPanel
   |                                  |
   |--> buildTodayBriefing -----------+
   |        |                         |
   |        |--> resolveFocusLeaf    -+--> briefing.focusNodeId
   |        |--> getNodeEvidenceState
   |        |
   |        \--> TodayBriefing value -> TodayPanel -> today-prose.ts -> rendered prose
   |
   \--> buildMapTree (dispatch by tab)
            |
            |--[acs]----> buildAcsTree -----> MapNode[] -> MapPanel -> MapTree -> LeafRow
            |--[handbook]--> buildHandbookTree -> ...
            |--[course]----> buildCourseTree (reads course/regulations/) -> ...
```

Server-side timing target: total load < 200ms for a seeded user. Profile with `console.time` if it slips.

## Today prose template -- worked examples

Inputs:

```typescript
type TodayBriefing =
  | { kind: 'no-goal' }
  | { kind: 'caught_up' }
  | {
      kind: 'focus';
      focusNodeId: string;
      focusAreaId: string;
      leafTitle: string;
      areaTitle: string;
      pillState: NodeEvidenceState;
      reasons: WeaknessReason[];
      primaryCitation: { kind: 'handbook' | 'reg'; label: string; href: string } | null;
    };
```

Worked output:

| Inputs                                                                                         | Rendered prose                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `kind: 'no-goal'`                                                                              | (no Today panel; banner above instead)                                                                                                |
| `kind: 'caught_up'`                                                                            | "You're caught up. Pick a topic from the map to dig in."                                                                              |
| `focus`, all reasons `never_attempted`, primary cite PHAK ch. 10                               | "Weight & balance -- arm and moment. You haven't started this yet. PHAK chapter 10 covers it."                                        |
| `focus`, reason `low_accuracy`, recall 4/10, primary cite PHAK ch. 10                          | "Weight & balance -- arm and moment. You miss this 4 out of 10 times on the cards. Try reviewing PHAK chapter 10."                    |
| `focus`, reason `overdue`, 12 due, recall 8/10                                                 | "Weight & balance. 12 cards due on this. Review them when you have a few minutes."                                                    |
| `focus`, mixed: recall mastered, scenario zero attempts                                        | "Weight & balance -- arm and moment. You're 100% understood. No practice yet. Try a scenario."                                        |
| `focus`, mixed: recall partial, calculation partial, scenario zero                             | "Weight & balance -- arm and moment. You're 60% understood, 25% memorized. No practice yet. The next gap is the arm-and-moment formula -- you miss it 4 out of 10 times." |

The "next gap" sub-clause is omitted unless one pill clearly dominates the gap (a single `WeaknessReason` of kind `low_accuracy` on a specific assessment method). Otherwise the prose ends after the percentages.

## Course projection -- frontmatter backfill plan

Today the FAR navigation course lessons have `title` and `week` in their frontmatter, but most don't yet have a `cites:` block. The Course projection needs `cites:` to do its rollup.

Backfill strategy in tasks:

1. Walk `course/regulations/**/*.md`.
2. For each lesson, parse the markdown body and extract all `airboss-ref:` citations (already validated against the registry).
3. Group by handbook section and CFR section. Derive `cites.handbook_sections` and `cites.acs_leaves` from existing inline citations -- the citation registry already has the resolution metadata.
4. For knowledge node citations -- the lessons reference knowledge nodes by slug in some places via `[link](course/knowledge/...)` or by name. Where unambiguous, populate `cites.knowledge_nodes`. Where ambiguous, leave empty and emit a warning -- the lesson renders without rollup.
5. Write the populated frontmatter back, run `bun run check`, run the citation validator.

This is mechanical for ~80% of lessons. The remaining 20% may need manual judgment; defer those to a follow-up content pass.

## Mobile

Below 700 px wide:

- `ProgressPanel`: stack the three pills vertically.
- `TilesPanel`: tiles wrap to 2 per row (or scroll horizontally; user pref TBD in test).
- `MapPanel`: collapse projection tabs to a single dropdown ("View: ACS").
- Citation panels stack the two stacks vertically (handbook on top by default).
- The full-width pill row for a leaf wraps; the citation panel still opens inline.

Desktop is the primary surface (the user said "beautiful, smart presentation" -- desktop is where that lives). Mobile is "doesn't break."

## Accessibility

- Three-number progress strip uses `<progress>` elements with explicit `aria-label`s ("37 percent understood, 154 of 412 leaves").
- Today prose is a `<p>`; the focus topic link follows immediately.
- Tiles are `<a>` elements with descriptive labels. Focus ring per existing tokens.
- Map tree uses `<details>`/`<summary>` -- native keyboard support for expand / collapse.
- LeafRow status glyph + pills have screen-reader-only descriptions ("Mastered: recall yes, calculation no, scenario not applicable").
- Citation chips use the existing `CitationChip` component which already has correct semantics.
- Tab strip uses `<button role="tab">` with `aria-selected` and arrow-key navigation per WAI-ARIA tabs pattern.

## Performance

- Server load target: < 200 ms cold, < 50 ms warm (queries hit indexed columns). Profile if it slips.
- Initial page weight: aim for under 50 KB gzipped (the page composes existing primitives + tokens).
- Map tree of ~50 leaves with citations folded: should render in one frame. Citation expand is JS-free `<details>` so no jank.
- Course projection's lesson-walk is build-time-eligible: cache the parsed lesson tree in memory on first request and invalidate on file change in dev. Production: the tree is static within a deployment.

## Forward compatibility

This WP foreshadows two future WPs without coupling to them:

- **WP 2** (`flight-evidence-and-cfi-feedback`): the Practiced pill currently counts only `scenario` evidence. When WP 2 lands, the pill widens to `scenario + demonstration`. The Flight tile's badge widens from "WP 2" to "N attempts pending debrief" or similar. The Course projection grows a fourth seed source: a CFI's `syllabus` row with reorder-able lessons (drag handles, immediate persistence) -- WP 2's UX guarantee.
- **WP 3** (`node-render-modes`): the leaf citation panel's hb / reg toggle is a v1 of the broader render-mode toggle. The knowledge node detail page (linked from any leaf in any projection) gets a `[learn][review][memorize]` toggle in WP 3.

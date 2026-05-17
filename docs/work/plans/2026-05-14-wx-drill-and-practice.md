---
title: Wx drill + practice — random generators, explanations, study pages
date: 2026-05-14
status: draft
owner: jball
related:
  - 2026-05-14-metar-taf-coverage-catalog.md
  - 2026-05-14-truth-model-v2-temporal.md
  - docs/work-packages/wx-engine/
  - apps/study/src/routes/(app)/reference/wx/
---

# Wx drill + practice

## Problem

Two gaps showed up reviewing the
[reading-metars](../../../course/knowledge/weather/reading-metars/node.md)
node and the [reference/wx](../../../apps/study/src/routes/(app)/reference/wx/)
surface:

1. **No examples at the point of use.** The METAR explanation page has prose
   but no scrollable list of real METARs, no filter by token family, no
   "show me five more like this one" button.
2. **No practice.** No way for a student to drill decoding under time pressure,
   no English→METAR encode drill, no terminology quizzes, no segmented drills
   ("just the wind groups today"), no tricky-METAR triage drills.

This plan covers the **generators**, the **explanation engine**, and the
**study app pages** that close both gaps. The catalog from
[the catalog plan](2026-05-14-metar-taf-coverage-catalog.md) supplies the
coverage matrix; the wx-engine supplies the truth-aware synthesis;
this plan wires them together and surfaces them in the study app.

## Outputs

### A. CLI generator: `bun run wx-scenario drill`

A new subcommand of the existing [wx-scenario](../../../scripts/wx-scenario.ts)
dispatcher. Produces a study pack from existing scenarios + catalog coverage.

```bash
bun run wx-scenario drill \
  --count 50 \
  --products metar,taf,pirep,fb,airmet \
  --layout interleaved|two-section \
  --seed 12345 \
  --from-scenarios all \
  --coverage balanced|random|gap-filling \
  --output drill-2026-05-14
```

Writes both `drill-2026-05-14.md` and `drill-2026-05-14.json`. The JSON is the
canonical form (consumed by the study app); the MD is generated from it
(printable, shareable).

#### Inputs

| Flag               | Meaning                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--count`          | Total products to generate                                                                                                            |
| `--products`       | Which product types to include (comma list)                                                                                           |
| `--layout`         | `interleaved` = each product followed by its explanation; `two-section` = all products, then all explanations                         |
| `--seed`           | Deterministic seed for reproducible packs                                                                                             |
| `--from-scenarios` | `all` or comma-list of scenario slugs to sample from                                                                                  |
| `--coverage`       | `balanced` = even token-family coverage; `random` = uniform pick; `gap-filling` = prefer families catalog has but current pack missed |
| `--output`         | Output basename (writes `.md` + `.json`)                                                                                              |

#### Output JSON shape

```typescript
interface DrillPack {
  generatedAt: string;
  seed: number;
  layout: 'interleaved' | 'two-section';
  items: DrillItem[];
  coverage: { family: string; count: number }[];
  missedFamilies: string[];   // catalog families this pack didn't exercise
}

interface DrillItem {
  index: number;
  product: 'metar' | 'taf' | 'pirep' | 'fb' | 'airmet';
  raw: string;
  /** Per-token annotation, computed from parse + truth model. */
  annotations: TokenAnnotation[];
  /** 1-2 sentence synoptic story explaining WHY this product looks like this. */
  synoptic: string;
  triageDrivers: string[];
  /** Slugs from the catalog this item covers. */
  catalogExamples: string[];
  /** Truth-aware backreference (always present — we don't generate without truth). */
  source: {
    scenario: string;
    station: string;          // for products tied to a station
    observationTime: string;
  };
}

interface TokenAnnotation {
  token: string;              // 'BKN012'
  family: string;             // 'sky-condition'
  decode: string;             // 'Broken layer at 1,200 ft AGL'
  why?: string;               // 'Coastal stratus capped by inversion (Pacific marine layer)'
}
```

### B. Explanation engine

A new lib: `libs/wx-explain/`. Pure functions over `ParsedMetar` / `ParsedTaf` /
etc. plus the truth model.

```typescript
// libs/wx-explain/src/metar.ts
export function explainMetar(
  parsed: ParsedMetar,
  truth?: TruthModel
): TokenAnnotation[];

// libs/wx-explain/src/taf.ts
export function explainTaf(parsed: ParsedTaf, truth?: TruthModel): TokenAnnotation[];

// etc. for pirep, fb, airmet
```

The decode line comes from the parsed structure alone (no truth needed). The
`why` line is added when a truth model is supplied — `findAirMass`,
`distanceToPolylineKm`, `pointInPolygon` (already in
[`libs/wx-engine/src/truth/geometry.ts`](../../../libs/wx-engine/src/truth/geometry.ts))
let us point to the specific truth feature that produced the token.

The explanation engine is the **shared surface**:

- The drill CLI uses it to write annotations to JSON.
- The study app uses it for the "explain this METAR" interactive page.
- The flashcard authoring tool uses it to auto-generate decode cards.

### C. Practice generators

Drill packs are static. **Practice exercises** are interactive. New CLI
subcommand + new study-app routes.

#### Exercise types

| Type                    | Prompt                                                                                                                    | Answer                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `decode-token`          | Single token: "What does `BKN012` mean?"                                                                                  | "Broken layer at 1,200 ft AGL" |
| `decode-group`          | Token group: "Decode this wind group: `23015G24KT 180V260`"                                                               | structured fields              |
| `decode-walk-metar`     | Full METAR shown; the student walks token-by-token, answering one question per token. See "Token-walk drill model" below. | per-token grading              |
| `encode-from-english`   | "Wind from 240° true at 12 kt, gusting 22, varying 200-280" → student types METAR wind                                    | exact string match             |
| `triage-this-metar`     | Full METAR + scenario prompt ("VFR flight, 2 hrs, you're at the fuel pump"); student picks the three triage drivers       | multi-select with rationale    |
| `synoptic-from-product` | Full METAR + 3 candidate synoptic stories; pick the right one                                                             | single-choice                  |
| `taf-change-group`      | TAF with one change group highlighted; student decodes validity + condition shift                                         | structured                     |
| `find-the-gotcha`       | Real METAR with a subtle issue (AO1+near-freezing, etc.); student names the gotcha                                        | tagged answer                  |
| `compare-two`           | Two METARs from same system 100 NM apart; student names the trend                                                         | open or tagged                 |
| `tricky-decode`         | Unusual METAR (VV, SLPNO, M1/4SM, +TSGR, etc.); per-token walk biased to gotcha tokens                                    | per-token grading              |

#### Token-walk drill model (replaces single-question "decode the whole METAR")

The default decode drill is **never** "here's a METAR, tell me what it all
means." That kind of prompt hides where the student is weak — they can pass it
by reading the easy 80% and bluff the rest. Instead, the engine generates **one
question per token group** and tracks per-token-family mastery.

For a typical METAR with ~10 token groups, the student answers ~10 questions
back-to-back. Tokens with high mastery from prior sessions get **skipped or
shown briefly** (no question, just "we know you read this"); tokens with low
mastery get **repeated** within the same session and prioritized in the next.

##### Per-token question contract

Every token in the parsed METAR maps to one of:

| Token family                    | Always asks?                                    | Question form                                                                      |
| ------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| Type indicator (METAR/SPECI)    | Skip if mastered                                | "Routine or special?"                                                              |
| Station ID                      | Skip if mastered                                | "Where is this airport?" (only asked occasionally; not a per-METAR drill axis)     |
| Date / time                     | Skip if mastered                                | "Day, hour Z?" — auto-marked mastered after a few correct sessions                 |
| Modifier (AUTO/COR)             | Always when present                             | "What does `AUTO` (or `COR`) tell you?"                                            |
| Wind                            | Always — multiple sub-questions                 | direction → speed → gust → variability                                             |
| Visibility                      | Always                                          | "Decode `M1/4SM`" / "Decode `1 1/2SM`"                                             |
| RVR                             | Always when present                             | "Which runway? What value? What does `M` mean?"                                    |
| Weather phenomena               | Always when present, **one question per group** | "Decode `+TSRA`. Intensity? Descriptor? Phenomenon?"                               |
| Sky condition                   | Always — **one per layer**                      | per-layer cover + height; then a "what's the ceiling?" question                    |
| Temp / dew                      | Always                                          | "Temp? Dew? Spread? What does the spread tell you?"                                |
| Altimeter                       | Always (low cognitive cost — auto-masters fast) | "Altimeter value in inHg?"                                                         |
| RMK tokens                      | Always when notable                             | one question per significant remark (`SLPxxx`, `T-group`, `PK WND`, `LTGCG`, etc.) |
| Composite "what's the ceiling?" | Always when ≥1 layer present                    | "Given the layers above, what's the operational ceiling?"                          |
| Composite "triage drivers"      | Always after full walk                          | "Of the tokens we walked, name the three drivers."                                 |

The "tricky ones are repeated" rule is operationalized two ways:

- **Within session:** if the student misses a token, the engine re-asks the
  same family on a different METAR later in the same session (different
  example, same family). This is interleaved practice, not immediate repetition.
- **Across sessions:** per-token-family mastery scores drive the next session's
  sampling. Low-mastery families dominate the next pack.

##### "Everyone can read the time" — auto-mastery rules

Some token families are low-cognitive-cost and the student should not have to
prove them every session. The engine declares **auto-mastery rules**:

- A family that's been answered correctly N (configurable, default 5) times in
  a row across separate sessions transitions to **passive** state.
- Passive families are shown but not quizzed. The student sees the token
  highlighted with its decode visible — confirming they know it without
  spending a question on it.
- Passive families can demote back to active if the student misses any future
  question on the family (e.g. they hit a `120800Z` and forget which digit is
  the day).

Some families never auto-master because their variant space is too wide:

- **Weather phenomena** — too many combinations (`+TSGR`, `FZFG`, `MIFG`, `BLSN`)
- **Sky condition with convective suffix** — `BKN025CB` is a different question than `BKN025`
- **RMK** — open-ended; new RMK forms keep appearing
- **Visibility with RVR** — pairing changes the question

##### Sub-token splitting

The wind group is the canonical example: `23015G24KT 180V260` is **one token
group with five answerable facts**:

1. Direction: 230
2. Speed: 15
3. Gust: 24
4. True or magnetic? (true)
5. Variable range: 180-260

The engine splits the group into **sub-questions** and grades each one.
Mastery of "wind direction" is independent of mastery of "gust group" is
independent of "wind variability." A student who consistently misses gust
sub-questions but nails direction/speed gets a gust-only mini-drill next
session.

#### Per-token mastery — persistence model

Token-walk drilling needs a place to record per-token-family mastery for each
user. The model is intentionally separate from the existing
[`@ab/bc-study`](../../../libs/bc/study/) spaced-rep system (which models
declarative card retention, not encoded-text fluency).

New schema namespace: `wx_practice` (or extend `study` — decide during build).
Minimum tables:

```typescript
// One row per (user, product, token family) — the mastery ledger.
interface WxPracticeMastery {
  userId: string;
  product: 'metar' | 'taf' | 'pirep' | 'fb' | 'airmet';
  /** Catalog family slug, e.g. 'wind-gust', 'sky-multi-layer', 'rmk-slp'. */
  family: string;
  /** Optional sub-family slug for split groups, e.g. 'wind/gust' vs 'wind/direction'. */
  subFamily: string | null;
  /** Total attempts. */
  attempts: number;
  /** Correct attempts. */
  correct: number;
  /** Most recent N attempts as a fixed-length boolean ring (default N=10). */
  recentRing: boolean[];
  /** Consecutive correct, across separate sessions. */
  streakAcrossSessions: number;
  /** active = quizzed normally; passive = shown-not-quizzed; demoted = recently missed. */
  state: 'active' | 'passive' | 'demoted';
  lastSeenAt: ISO8601;
  lastUpdatedAt: ISO8601;
}

// One row per question shown — the audit trail.
interface WxPracticeAttempt {
  id: string;
  userId: string;
  sessionId: string;
  product: 'metar' | 'taf' | 'pirep' | 'fb' | 'airmet';
  rawExample: string;          // the full encoded product the token came from
  family: string;
  subFamily: string | null;
  tokenShown: string;          // e.g. 'BKN012', '23015G24KT'
  questionForm: string;        // e.g. 'decode-token', 'sub-direction', 'compose-ceiling'
  correct: boolean;
  /** Student's literal answer for free-form questions; otherwise the chosen option key. */
  answer: string;
  /** Milliseconds from prompt-shown to answer-submitted. */
  responseMs: number;
  shownAt: ISO8601;
}

// One row per session.
interface WxPracticeSession {
  id: string;
  userId: string;
  startedAt: ISO8601;
  endedAt: ISO8601 | null;
  product: string[];           // which products this session drilled
  tier: number;
  /** Family slugs targeted by this session's sampler. */
  focusFamilies: string[] | null;
  itemCount: number;
}
```

Sampling rules (consume the mastery ledger when building the next session):

- **Active families**: weighted toward those with lower `correct/attempts` ratio
  AND those least recently seen.
- **Demoted families**: oversampled this session (they were recently missed).
- **Passive families**: NOT sampled for questions. Tokens of passive families
  in the displayed METAR are shown with their decode rendered inline — no
  question, just a visual confirmation pass.
- **Brand-new families** (zero attempts): inserted at a baseline rate so the
  student steadily encounters everything in the catalog.

Promotion / demotion logic:

- `active → passive` when `streakAcrossSessions ≥ 5` AND `recentRing` is all
  true (last 10 attempts) AND auto-master is allowed for that family.
- `passive → demoted` immediately on any wrong answer for that family.
- `demoted → active` after 3 correct attempts in a row.
- Some families never reach `passive`. The non-auto-master list lives in
  `libs/wx-explain/families.ts` and matches the "never auto-master" list in
  the token-walk model above.

This data is the **mastery report** the student sees at the end of a session,
the input to the **next session sampler**, and the answer to the question
"which areas might I struggle with on a METAR?"

#### Difficulty ladder

Start easy, build up. The student progresses through tiers in the practice
page rather than the catalog dumping everything at once.

| Tier | What it tests                                                           |
| ---- | ----------------------------------------------------------------------- |
| 1    | One field at a time. Just wind. Just visibility. Just sky condition.    |
| 2    | Field-group decoding (full wind block, full sky block)                  |
| 3    | Full-METAR decode without time pressure                                 |
| 4    | Full-METAR decode under time pressure (60 s budget)                     |
| 5    | Triage drills (three drivers under a scenario constraint)               |
| 6    | Synoptic interpretation (single METAR → identify the situation)         |
| 7    | Cross-station reasoning (two METARs → name the trend)                   |
| 8    | English-to-METAR encoding                                               |
| 9    | Tricky / gotcha-heavy METARs (AO1+freezing, VV, SLPNO, RVR, +TSGR, +FC) |
| 10   | TAF reasoning (change groups, amendments, validity windows)             |

CLI: `bun run wx-scenario practice --tier 3 --count 20 --output session.json` for
offline / paper drills.

App: a dedicated **Practice** route in study (described below) consumes the
same generator runtime.

### D. Study app pages

Three new routes + cross-links from existing ones.

#### `/reference/wx/products/metar/examples`

(and equivalent for `taf`, `pirep`, `fb`, `airmet-sigmet`)

Browsable catalog page. Live filter by token family. Click a chip to see
"every example that exercises `wind-gust`". Each example renders the raw
encoded text + the synoptic story + a "decode" toggle that calls
`explainMetar` and shows token-by-token annotations.

Data source: `catalog.json` from the catalog plan, plus on-demand calls to
the explanation engine.

#### `/practice/wx/drill`

Random-METAR (or any product) drill. Student picks:

- Product type (METAR / TAF / PIREP / FB / AIRMET, multi-select)
- Tier (1-10)
- Token families to focus on (optional — defaults to balanced)
- Count (5 / 10 / 20 / 50)

The page generates a deterministic-by-seed pack and walks the student through
exercises one at a time, showing rationale after each answer. Session results
persist (right/wrong, time per item, family-level mastery).

Data source: `wx-scenario drill` runtime (same code, called from the server
load function), explanation engine for grading and rationale.

#### `/practice/wx/test-page`

Authoring sandbox (admin / power-user only — guarded behind the existing
study admin layout). Used to:

- Generate-on-demand a single product with sliders for every truth-model lever
  (wind, gust, temp/dew spread, fog severity, frontal proximity, convective
  cell distance)
- See the resulting METAR + TAF + chart update live as sliders move
- "Lock in" a generated product and save it as a catalog example
- Compare engine output against a hand-authored expected string

Useful for the catalog authoring phase, for vetting wx-engine refinements, and
for one-off "I want to demonstrate exactly this shape" use.

#### Cross-links from the existing pages

- [reading-metars node][rm-node] gets a "Browse all examples" link under the
  Practice section and a "Drill this now" link
- [reference/wx/products/[slug]/+page.svelte][prod-slug] gets the same two links
  in its summary header

[rm-node]: ../../../course/knowledge/weather/reading-metars/node.md
[prod-slug]: ../../../apps/study/src/routes/(app)/reference/wx/products/[slug]/+page.svelte

## Phases

The work splits into 4 phases. Each is independently shippable.

### Phase 1 — Explanation engine + `wx-scenario drill` CLI

**Scope:** `libs/wx-explain/` + `scripts/wx-scenario/drill.ts`.

- [ ] `libs/wx-explain/src/metar.ts` — token-walk a `ParsedMetar`, emit `TokenAnnotation[]`
- [ ] `libs/wx-explain/src/taf.ts`
- [ ] `libs/wx-explain/src/pirep.ts`
- [ ] `libs/wx-explain/src/fb.ts`
- [ ] `libs/wx-explain/src/airmet.ts`
- [ ] `libs/wx-explain/src/index.ts` runtime barrel (browser-safe — no `node:*`)
- [ ] `scripts/wx-scenario/drill.ts` — sampling, coverage logic, MD + JSON emit
- [ ] `wx-scenario.ts` dispatcher: register `drill` subcommand + help entry
- [ ] `WX_SCENARIO_SUBCOMMANDS.DRILL` in [`libs/constants/src/wx-engine.ts`](../../../libs/constants/src/wx-engine.ts)
- [ ] Unit tests for the explanation engine — every token family in the catalog produces an annotation
- [ ] Hooked into `bun run check`

**Acceptance:** `bun run wx-scenario drill --count 10 --products metar` writes a
markdown drill pack with parseable METARs + per-token annotations.

### Phase 2 — Examples page (`/reference/wx/products/<slug>/examples`)

**Scope:** read-only catalog browser.

- [ ] Server load reads `catalog.json` from the catalog plan
- [ ] List + filter by token family (URL-state — chip clicks update query string)
- [ ] Each example: raw text, synoptic 1-liner, click-to-expand annotations (via `explainMetar`)
- [ ] Search input (matches raw text, station, family)
- [ ] Cross-link added in the [reading-metars node][rm-node] body
- [ ] E2E smoke: chip click filters list; click-to-decode shows annotations

**Acceptance:** Student can browse all catalog METARs, filter by `+TSRA`, see
the three thunderstorm examples with decode-on-demand.

### Phase 3 — Practice route (`/practice/wx/drill`)

**Scope:** interactive drill loop.

- [ ] New route group `(app)/practice/` (does not exist yet — confirm during build)
- [ ] Session state: current item, answers, time per item, family mastery counters
- [ ] Server load uses the same `drill` runtime that powers the CLI
- [ ] Exercise renderers per type (single-choice, structured-fields, multi-select)
- [ ] Grading uses the explanation engine for rationale strings
- [ ] `wx_practice` schema landed (or `study` extension — decide during build): `WxPracticeMastery`, `WxPracticeAttempt`, `WxPracticeSession`
- [ ] Sampler reads the mastery ledger when generating each session; passive families render as visible-but-not-quizzed
- [ ] Mastery updated after every attempt (active/passive/demoted transitions)
- [ ] Difficulty-tier selector + token-family filter
- [ ] End-of-session summary: per-family right/wrong, response-time outliers, state transitions ("you just promoted `altimeter` to passive")
- [ ] E2E smoke: full session of 5 token-walk items across 2 METARs with grading + at least one passive-skip

**Acceptance:** Student picks "tier 3, METAR, 10 items," answers each, gets
graded with rationale, sees a family-level mastery summary at the end.

### Phase 3b — Mastery dashboard (`/practice/wx/mastery`)

**Scope:** read-only view of the student's per-token-family mastery.

- [ ] Per-product mastery grid: rows are catalog token families, columns are
  attempts / correct / state / last-seen
- [ ] Filter by product (METAR / TAF / PIREP / FB / AIRMET) and by state
  (active / passive / demoted / never seen)
- [ ] "Drill my weak families" button: starts a session that oversamples
  active+demoted families with the lowest correct ratios
- [ ] Heatmap visualisation of mastery across the full catalog (one cell per
  family, colored by state)
- [ ] E2E smoke: dashboard loads, shows correct counts against seeded test
  attempts, "drill weak" button starts a session targeted at low-mastery families

**Acceptance:** A student can answer "which areas might I struggle with?" by
opening the mastery page and seeing concrete families colored by state.

### Phase 4 — Authoring sandbox (`/practice/wx/test-page`)

**Scope:** power-user surface; behind admin guard.

- [ ] Truth-model slider panel (winds, pressure, fronts, cells, hazards)
- [ ] Live regen of METAR + TAF + chart on slider move
- [ ] "Save as catalog example" → writes a candidate sidecar entry to
  `course/knowledge/weather/encoded-text-catalog/examples-pending/` for review
- [ ] Compare-against-expected mode for catalog regression checking
- [ ] No e2e smoke (admin-only)

**Acceptance:** I can drag a slider, watch the METAR change, save a new catalog
candidate.

## Decisions that need confirming during build

- **Should the practice session use the existing `study.review` machinery
  (spaced-rep) or a separate practice schema?** Decided: separate. The
  per-token-family mastery ledger (see "Per-token mastery — persistence model"
  above) is its own schema (`wx_practice` namespace, or extension under `study`
  — pick at build start). The spaced-rep machinery models declarative card
  retention; this models encoded-text fluency, which has a different sampling
  signal (per-token-family mastery ring + state machine) and a different
  reward function (auto-promote easy families to passive so the student stops
  re-answering "decode `121753Z`" forever).
- **Should `/practice/` be a top-level route group or live under `/study/`?**
  Lean top-level; practice is the encoded-text-family fluency surface that
  applies across products, not just spaced-rep cards.
- **Where does the catalog get reverse-indexed at runtime?** Option A: build a
  static index file at catalog-build time. Option B: index at server boot.
  Pick A for the first ship — simpler, faster page load.

## Tied to truth-model temporal extension

This plan ships against the current single-snapshot
[TruthModel](../../../libs/wx-engine/src/truth/types.ts). Once the
[temporal plan](2026-05-14-truth-model-v2-temporal.md) lands, the drill gains
new exercise types:

- **Sequence drill:** "Here are three METARs from KICT, hourly, in order. What
  changed between hour 2 and hour 3, and why?"
- **TAF-vs-actuals drill:** "Here's the TAF issued at 1120Z and three actual
  METARs from 1212Z / 1312Z / 1412Z. Where did the TAF get the timing wrong?"
- **Sweep drill:** "A cold front is moving east at 15 kt. Pick the airport
  that's behind the front at hour 4."

Those exercises don't change the explanation engine or the drill packaging —
they just need temporal truth as input. The Phase 1-4 work lands cleanly
without temporal truth and extends without rework once it's available.

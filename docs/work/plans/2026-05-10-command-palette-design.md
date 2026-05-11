---
title: Global Search + Command Palette -- Design Note
date: 2026-05-10
branch: docs/wx-chart-author-priority-and-embeds
status: draft
---

## Overview

A design note. Not a work package yet. The goal is to converge on the shape before
authoring `docs/work-packages/command-palette/`.

Companion mockup: [`palette-mockup.html`](./2026-05-10-palette-mockup.html) -- open in a browser.

## What we have today

The thing users hit with `/` or `Cmd+K` is the **help palette** in `libs/help/src/ui/`. Its index is two registries:

1. **Help pages** -- per-app authored markdown (Reps, Memory, Calibration, ...). ~100 entries.
2. **Aviation references** -- `libs/aviation/src/references/aviation.ts`. **4 rows**: ADM, SRM, Va, one test row.

So when you type `FAA-H-8083-28` or `aviation weather` the palette literally has nothing to match. The hangar `/docs` admin route has a Postgres-FTS index over `docs/ course/ handbooks/ regulations/` but it's gated to authors and isn't wired to the palette.

## Where we're going

A real **Cmd+P / Cmd+Shift+P** system, Alfred / Raycast / Linear shaped:

- `Cmd+K` (or `/`) -> **search palette** (the thing this note is about). Multi-column, multi-category, grouped results across content domains. Default mode.
- `Cmd+P` -> **quick-open** (one-column). Jump to a known thing by name. Recent + frequent first. Same index, narrower presentation.
- `Cmd+Shift+P` -> **command palette**. Actions, not content. "Start new sim", "Go to today's reps", "Open dashboard", "Theme: toggle dark", "Sign out". Per-app commands at the top, global commands underneath.

All three share one search engine, one ranker, and one index. They differ only in **what they let through** and **how they present it**.

### Per-app variation

Each surface has the same palette but a different "top of the list":

| Surface   | Top-priority commands (Cmd+Shift+P)           | Top-priority results (Cmd+K)                 |
| --------- | --------------------------------------------- | -------------------------------------------- |
| study     | New plan, Go to today's reps, Memory inbox    | Memory cards, knowledge nodes, lesson pages  |
| sim       | Start new sim, Resume last sim, Pick scenario | Scenarios, sim help, sim references          |
| hangar    | New doc, Open audit log, Invite user          | Docs, glossary admin, source ingestion runs  |
| flightbag | Open FAA-H-8083-28, Open 14 CFR 91, AIM 7-1   | FAA handbooks, CFR sections, AIM, ACs, ACS   |
| avionics  | (TBD)                                         | (TBD)                                        |

"Long-tail" results (results from other surfaces) appear lower. Always present, never silently filtered out. This is the "throttled per app but everything is still reachable" pattern.

## What this design note covers

The search palette only. Cmd+P quick-open and Cmd+Shift+P commands are noted so we build the search **as a piece of a larger system**, not as a one-off.

## Build it for these queries

Concrete queries we must handle on day one. If any of these fail, the palette is broken.

| You type                  | You expect                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| `FAA-H-8083-28`           | The Aviation Weather Handbook, top result                               |
| `8083-28`                 | Same                                                                    |
| `H-8083-28`               | Same                                                                    |
| `AvWX`                    | Same                                                                    |
| `Aviation Weather`        | AvWX handbook + AC 00-6 + PHAK Ch.12 + our weather course + wx KB nodes |
| `wx`                      | Same set (wx == weather)                                                |
| `weather`                 | Same set                                                                |
| `91.103`                  | 14 CFR 91.103 section                                                   |
| `Part 91`                 | 14 CFR Part 91                                                          |
| `Va`                      | Va glossary entry                                                       |
| `density altitude`        | Glossary entry + handbook sections + knowledge nodes that cite it      |
| `METAR`                   | Glossary + AvWX chapters that discuss it + cards that ask about it     |
| `doc:FAA-H-8083-28 turb`  | Only turbulence sections inside AvWX                                    |
| `kind:cfr 91.103`         | Only the CFR section, no handbook discussion of preflight              |

`wx == weather` is non-negotiable. Aviation aliases are first-class.

## Result type taxonomy

Every result has a `type`. The type drives which column / card it appears in, what affordances it has, and how it's ranked relative to others.

| Type             | Source                                          | Column                | Notes                                           |
| ---------------- | ----------------------------------------------- | --------------------- | ----------------------------------------------- |
| `faa.handbook`   | `handbooks/*/manifest.json`                     | FAA Resources         | PHAK, AFH, AvWX, IFH, IPH, RMH, AIH, ...        |
| `faa.cfr.part`   | `regulations/cfr-14/` + `regulations/cfr-49/`   | FAA Resources         | 14 CFR 91, etc.                                 |
| `faa.cfr.sect`   | `study.reference_section` (kind=CFR)            | FAA Resources         | §91.103                                         |
| `faa.handbook.chapter` | `study.reference_section` (kind=HANDBOOK) | FAA Resources         | PHAK Chapter 12: Weather Theory                 |
| `faa.aim`        | AIM index + sections                            | FAA Resources         | AIM 7-1 etc.                                    |
| `faa.ac`         | `ac/index.json` + sections                      | FAA Resources         | AC 00-6, AC 61-98, ...                          |
| `faa.acs`        | ACS docs                                        | FAA Resources         | PPL ACS, IR ACS, ...                            |
| `airboss.course` | `course/courses/*/` and `course/weather/` etc.  | Airboss Content       | "Aviation Weather Course"                       |
| `airboss.knode`  | `study.knowledge_node`                          | Airboss Content       | Discovery-first KB nodes (ADR 011)              |
| `airboss.glossary` | aviation registry                             | Airboss Content       | Terms / aliases / paraphrases                   |
| `airboss.lesson` | study lesson pages                              | Airboss Content       | Per-cert syllabus sections                      |
| `airboss.help`   | help registry                                   | App Help              | Reps, Memory, Calibration, ...                  |
| `mine.card`      | `study.memory_card` for current user            | My Stuff              | User's flashcards                               |
| `mine.rep`       | reps for current user                           | My Stuff              | Decision reps                                   |
| `mine.plan`      | `study.plan` for current user                   | My Stuff              | Active / paused study plans                     |
| `mine.note`      | reflection journal entries (future)             | My Stuff              | Future surface                                  |
| `web.tool`       | curated external links (1800wxbrief, AWC, ...)  | External Tools        | "Go get weather"                                |
| `cmd.action`     | declarative command registry                    | Commands              | Cmd+Shift+P-style actions                       |
| `cmd.goto`       | route registry                                  | Commands              | "Go to dashboard", "Go to reps"                 |

This taxonomy IS the contract. Adding a new content domain = define its type, register a loader, add it to a column. No other change.

## Columns (the Alfred-y bit)

For the wide modal we present **up to four columns**:

```text
+--------------------------------------------------------------+
| > weather                                          [ x ]     |
+--------------------+----------------------+------------------+
| FAA Resources      | Airboss Content      | My Stuff         |
| Aviation Weather   | Aviation WX Course   | 3 cards          |
|   Handbook (AvWX)  | Weather KB: Pressure | 1 rep due        |
| AC 00-6B           | Weather KB: Fronts   | Plan: PPL WX     |
| PHAK Ch 12: WX     | Weather (PPL syll.)  |                  |
| AIM 7-1-12         | App help: Weather    |                  |
+--------------------+----------------------+------------------+
| External Tools                          | Commands           |
| aviationweather.gov                      | Go: Weather course |
| 1800wxbrief.com                          | New: WX scenario   |
+-----------------------------------------+--------------------+
```

Column rules:

- Each column has a header (the category) and shows the **top N** of its type group.
- A "show all 23" link inside each column drops you into a filtered list view at `/search?q=weather&kind=faa.handbook,faa.cfr.sect,...`.
- Keyboard: Up/Down moves within column, Tab/Shift+Tab moves columns, Enter opens, Cmd+Enter opens in new tab.
- Mobile / narrow: columns stack into sections (vertical scroll, same headers).

## The book-vs-references problem

You called this out and it's the most interesting part. If you type "weather":

- There's a **whole book** named after it (AvWX, FAA-H-8083-28B).
- There are **many sections inside other books** that discuss weather (PHAK Ch 12, AFH Ch 2, AC 00-6).
- There are **our own pages** on weather (the WX course, KB nodes, syllabus sections).

We can't make assumptions about which the user wants. So we do three things:

1. **Hoist the canonical asset.** If a query has a near-exact match to a `faa.handbook.title` or `aliases`, that handbook is **always the first card** in FAA Resources, before any sections. Same rule for CFR Part, AC, ACS.
2. **Group sub-results under their parent visually.** Sections from PHAK are listed under a "PHAK" subheader with a count badge ("PHAK 3 sections"). Click the subheader to expand or jump to the parent.
3. **Show provenance on every row.** "Chapter 12 · PHAK · FAA-H-8083-25C" -- the user knows what they're looking at without hovering.

Inside-FAA-Resources layout for query "weather":

```text
FAA Resources
+------------------------------------------------------+
| AVIATION WEATHER HANDBOOK                            |  <- hoisted whole-book card
| FAA-H-8083-28B (AvWX)                                |
+------------------------------------------------------+
| AC 00-6B  -- Aviation Weather (advisory circular)    |  <- hoisted whole-book card
+------------------------------------------------------+
| Pilot's Handbook of Aeronautical Knowledge           |
|   Ch 12: Weather Theory                              |  <- section under parent
|   Ch 13: Weather Services                            |
|   Ch 11: Aircraft Performance (density altitude)     |
+------------------------------------------------------+
| Airplane Flying Handbook                             |
|   Ch 2: Ground Operations (wind / wx considerations) |
+------------------------------------------------------+
| 14 CFR                                               |
|   §91.103 -- Preflight action (incl. weather brief)  |
|   §91.155 -- Basic VFR weather minimums              |
+------------------------------------------------------+
```

## Synonyms / aliases

A small synonym map lives next to the index, not inside it. Tokens normalize **before** ranking.

```text
wx           -> weather
ovc          -> overcast
tstm | tsra  -> thunderstorm
mvfr | ifr   -> (kept literal -- distinct concepts)
metar        -> (kept literal)
poh | afm    -> pilot operating handbook | airplane flight manual
```

Editor lives at `libs/aviation/src/synonyms.ts`. Bidirectional: typing "weather" finds "wx" rows; typing "wx" finds "weather" rows. Aliases on a `Reference` row are still the primary way to attach alternative names to a specific entity (e.g., Va has aliases `[Va, maneuvering speed, design maneuvering speed]`); the synonym map is for query-side rewrites that are global across the corpus.

## Tokenization rules

- Lowercase + strip non-alphanumeric on both index and query side, retaining the original for display.
- Tokenize on whitespace + punctuation.
- Doc codes are also indexed in their **stripped** form: `FAA-H-8083-28` -> `faah808328`. Query rewriter tries both forms. Same for `14 CFR 91.103` -> `14cfr91103`, `Part 91` -> `part91`.
- Numbers attached to letters are split: `8083-28` indexes as `[8083, 28, 808328]`.

## Ranking

Per group / column, results are sorted by tier then alpha:

| Tier | Match                                                                |
| ---- | -------------------------------------------------------------------- |
| 1    | Exact match on doc code (`FAA-H-8083-28`), alias, or full title      |
| 2    | Prefix match on title or alias                                       |
| 3    | Substring match on title or alias                                    |
| 4    | Match in keywords / tags                                             |
| 5    | Match in body (FTS) -- snippet shown                                 |

Cross-column priority is **type weight**, not relevance: a tier-3 FAA handbook beats a tier-1 help page. Each column ranks its own contents internally.

Mode-of-search hint: when a query has a single tier-1 match, the palette shows it as a banner at the top:

```text
+------------------------------------------------------+
| Open FAA-H-8083-28: Aviation Weather Handbook ->     |
+------------------------------------------------------+
```

Enter goes straight there. This is the Alfred "you obviously meant this thing" pattern.

## Filters (the `doc:` / `kind:` story)

Inline grammar, parsed by `libs/help/src/query-parser.ts` (already exists, gains keys):

- `doc:FAA-H-8083-28 turbulence` -- scope to one doc, FTS within
- `doc:phak weather` -- doc alias also accepted
- `kind:cfr 91.103` -- only CFR sections
- `kind:handbook weather` -- only handbooks (and their chapters)
- `kind:node decision making` -- only knowledge nodes
- `kind:glossary va`
- `surface:study`, `surface:flightbag`, ...
- `mine` -- only My Stuff

Filters render as chips above the input; click X to remove. Typing `doc:` with no value opens a doc-picker dropdown -- one of the small UX wins worth getting right early.

## How this fits Cmd+P and Cmd+Shift+P later

The whole thing is a `PaletteCommand` registry over `SearchResult` types. Three "modes" select which types are eligible:

```typescript
type PaletteMode = 'search' | 'quickopen' | 'command';

const ELIGIBLE: Record<PaletteMode, ReadonlySet<SearchResultType>> = {
  search:    ALL_TYPES,
  quickopen: new Set(['faa.handbook', 'faa.cfr.part', 'airboss.course', 'airboss.knode', 'mine.plan', 'cmd.goto']),
  command:   new Set(['cmd.action', 'cmd.goto']),
};
```

The same input box, ranker, and registry serve all three. Cmd+P is just "search palette with most types filtered out, recents on top." Cmd+Shift+P is "show only cmd.* types." Adding a new command surface (e.g. study's "Mark deck mastered") = `paletteCommands.register({ type: 'cmd.action', ... })`. Done.

## Prototype-first

I want to ship a working palette **without** committing to the final visual design. The plan:

1. **Phase 1 (the immediate win you asked for):** populate the aviation reference registry with every FAA handbook, CFR part, AC, ACS, AIM chapter on disk. Add `wx -> weather` and a handful of canonical synonyms. Lock the behavior with a test fixture: "every known doc code must return a top-3 result." This alone makes `FAA-H-8083-28`, `8083-28`, `AvWX`, `aviation weather`, `wx`, `Part 91`, `91.103` all work in the existing single-column palette.

2. **Phase 2:** add result type taxonomy + grouping. Existing palette renders as columns when wide, list when narrow. Knowledge nodes, glossary, course pages, memory cards all become results.

3. **Phase 3:** ship two or three competing visual prototypes side-by-side under `apps/study/src/routes/dev/palette/`. Pick after live use. Candidates: "wide 4-column" (this mockup), "list with category dividers" (Linear), "narrow column with detail pane" (Raycast).

4. **Phase 4:** add commands (`cmd.action` / `cmd.goto`). Bind `Cmd+Shift+P`. Per-app command registries.

5. **Phase 5:** add Cmd+P quick-open mode. Recents-first.

Phase 1 lands as a small PR on `docs/wx-chart-...` (or its own branch). Phases 2-5 author as one work package, `docs/work-packages/command-palette/`.

## Prior art -- examples to look at live

Open these and compare:

| Tool          | Strength                                                  | Try this                                                        |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Linear        | Multi-section list (Issues, Projects, Views, ...). Tight. | Cmd+K in any project. Search a partial issue title.             |
| Notion        | Multi-section, mixes pages + actions, big preview pane.   | Cmd+P. Search a vague term and watch the page-vs-block split.   |
| GitHub        | Repo-scoped + global, with `kind:` filters built in.      | `/` on github.com. Try `repos:` / `is:pr` / `org:` filters.     |
| Raycast (Mac) | Two-column, detail pane, app-extension architecture.      | Cmd+Space. Watch how extensions add categories.                 |
| Alfred (Mac)  | The classic. Plain rows but workflows = extensible types. | Cmd+Space. The "search the web" extensions are the type model.  |
| VS Code       | Three palettes, one keystroke each (Cmd+P / Cmd+Shift+P / Ctrl+Shift+O). Filters via prefix. | Cmd+P. Try `>` for commands, `@` for symbols, `#` for workspace symbols. |
| Slack         | Channel + DM + message + file + workflow, all in one.     | Cmd+K. Watch how recents float to the top.                      |
| Superhuman    | Keyboard-first, command-only (no general search).         | Cmd+K. Compare to Cmd+/ (cheat sheet).                          |
| Sublime Text  | The original Cmd+P. Fuzzy-match perfected.                | Cmd+P. Type `wbrd` for "webpack_build_runner_dev.js".           |

**Closest to what we want for airboss:** Notion's Cmd+P (mixed content types, sections, big result cards) blended with Linear's Cmd+K (tight category headers, clear keyboard model) and VS Code's prefix grammar (`doc:`, `kind:`, `mine`).

## Decisions (locked 2026-05-10)

1. **Default scope:** study-first when launched from study, sim-first when launched from sim, etc. Other surfaces still render, lower in the list. The host app gets a top-of-result boost.
2. **External Tools:** appear by default, but split into two tiers (see below).
3. **Detail pane on the right:** yes. Includes the doc-code autocomplete UX described below.
4. **Synonyms seed:** I'm seeding ~100 aviation abbreviations (see Appendix A).

## Doc-code autocomplete (the new behavior)

When the query is unambiguously a partial doc code -- starts with `FAA-`, `FAA-H-`, `FAA-S-`, `AC` + space, `14 CFR` + space, `49 CFR` + space, `Part` + space, `§`, bare digits like `8083` or `61-`, or a known handbook abbreviation like `AvWX` / `PHAK` / `IFH` -- the palette switches from "search" mode to **doc-picker** mode.

The right-side detail pane becomes a vertical list of matching docs (code + title), sortable, and Enter on a doc loads "search inside that doc" (sets `doc:<code>` as a chip).

Triggers ("looks like a doc code"):

```text
^FAA-H-                       -> matches FAA-H-* handbooks
^FAA-S-                       -> matches FAA-S-* standards
^FAA-P-                       -> matches FAA-P-* publications
^AC[\s-]                      -> matches Advisory Circulars
^14[\s-]?CFR                  -> matches 14 CFR parts
^49[\s-]?CFR                  -> matches 49 CFR parts
^Part\s                       -> matches CFR parts
^§                            -> matches CFR sections
^(\d{2,4})(-(\d{1,4}))?$      -> matches doc-fragment numbers like 8083, 8083-28, 61-83
^(AvWX|PHAK|AFH|IFH|IPH|RMH|AIH|IAH)\b   -> known handbook abbrev
^AIM\s?\d                     -> matches AIM chapter/section
^ACS\s|^PTS\s                 -> matches certification standards
```

Doc-picker UI (right pane):

```text
+--------------------------------------------------------+
| > FAA-H-8                                  [doc-picker] |
+--------------------------------------------------------+
| Search results (left, dimmed)                          |
|   ...filler / recents...                               |
|                                  +---------------------+
|                                  | Matching documents  |
|                                  +---------------------+
|                                  | FAA-H-8083-2A       |
|                                  |   Risk Management   |
|                                  |   Handbook          |
|                                  +---------------------+
|                                  | FAA-H-8083-3C       |
|                                  |   Airplane Flying   |
|                                  |   Handbook (AFH)    |
|                                  +---------------------+
|                                  | FAA-H-8083-9        |
|                                  |   Aviation          |
|                                  |   Instructor's      |
|                                  |   Handbook          |
|                                  +---------------------+
|                                  | FAA-H-8083-15B      |
|                                  |   Instrument Flying |
|                                  |   Handbook (IFH)    |
|                                  +---------------------+
|                                  | FAA-H-8083-16B      |
|                                  |   Instrument Proc.  |
|                                  |   Handbook (IPH)    |
|                                  +---------------------+
|                                  | FAA-H-8083-25C      |
|                                  |   PHAK              |
|                                  +---------------------+
|                                  | FAA-H-8083-28B      |
|                                  |   Aviation Weather  |
|                                  |   Handbook (AvWX)   |
|                                  +---------------------+
```

Behavior:

- Up/Down moves through doc list. Enter on a doc -> opens that doc directly (book card).
- `Cmd+Enter` on a doc -> sets `doc:<code>` as a filter chip; cursor returns to the input; user types what they want to find inside.
- Esc / continued typing dismisses doc-picker, palette returns to normal search.
- Doc list ranking inside the picker: numeric prefix first (so `808` orders 8083-2, 8083-3, 8083-9, 8083-15, 8083-16, 8083-25, 8083-28), then alpha by title.

This is the lookup-as-you-type pattern from Sublime / VS Code Cmd+P, applied to FAA doc codes -- a thing pilots remember by number but not always title, and vice versa.

## Detail pane (right side)

The four-column grid shrinks to three columns when the detail pane is visible. Two modes:

1. **Search mode** -- detail pane shows the highlighted result: title, full citation, snippet of body (if FTS-matched), "Open in flightbag", "Open in study", "Cite this", "Pin to today".
2. **Doc-picker mode** -- detail pane is the doc list (as above).

The pane can be collapsed with `Cmd+\` -- if you collapse it, the layout reverts to four columns.

## External Tools tiering

Two sub-sections, both visible by default. The split is about trust, not visibility.

```text
External Tools
+------------------------------------------------------+
| Validated (FAA / industry-standard)                  |
|   aviationweather.gov   (NWS / AWC official)         |
|   1800wxbrief.com       (Leidos Flight Service)      |
|   faa.gov/notams        (FNS)                        |
|   skyvector.com         (charts)                     |
+------------------------------------------------------+
| Community / unofficial                               |
|   foreflight.com        (commercial)                 |
|   windy.com             (consumer wx model viz)      |
|   ventusky.com          (consumer wx)                |
+------------------------------------------------------+
```

Validated tier appears first; community tier below. `kind:web` filter shows both; `kind:web.validated` shows only the top tier.

The validated list is a hand-curated constant in `libs/aviation/src/external-tools.ts`. Adding to validated requires a PR -- intentional friction. Community list can grow more freely.

## Appendix A -- Seed synonym list (100 entries)

Aviation aliases / abbreviations / acronyms that rewrite or unify on the query side. Format: `canonical: alias1, alias2, ...`. Direction is bidirectional unless noted.

```text
# Weather
weather: wx
overcast: ovc, ovx
broken: bkn
scattered: sct
few: few
clear: clr, skc
thunderstorm: tstm, tsra, ts
turbulence: turb, ltb, mod_turb, sev_turb
icing: ice, ic, lgt_ice, mod_ice, sev_ice
visibility: vis
ceiling: ceil, cig
wind: wnd
gust: gst
precipitation: pcpn, precip
rain: ra
snow: sn
fog: fg
mist: br
haze: hz
freezing: fz
dewpoint: dwpt, td
temperature: temp, t
altimeter: alt_setting, kollsman
sea level pressure: slp, msl_pressure
visual flight rules: vfr
instrument flight rules: ifr
marginal vfr: mvfr
low ifr: lifr

# Reports / charts
meteorological aerodrome report: metar
terminal aerodrome forecast: taf
airmens meteorological information: airmet
significant meteorological information: sigmet
pilot report: pirep, urgent_pirep
center weather advisory: cwa
area forecast discussion: afd
prog chart: prog, prognostic_chart
surface analysis: sfc_anl
radar summary: radar
satellite: sat
winds aloft: fb, winds_temps_aloft

# Aircraft / performance
maneuvering speed: va
never exceed speed: vne
maximum structural cruise: vno
flap extended speed: vfe
landing gear extended speed: vle
landing gear operating speed: vlo
best angle of climb: vx
best rate of climb: vy
minimum control speed: vmc, vmca, vmcl
stall speed: vs, vs0, vs1
rotation speed: vr
takeoff safety speed: v2
decision speed: v1
density altitude: da
pressure altitude: pa
indicated airspeed: ias
true airspeed: tas
calibrated airspeed: cas
ground speed: gs

# Navigation / airspace
nondirectional beacon: ndb
very high frequency omnidirectional range: vor
distance measuring equipment: dme
instrument landing system: ils
area navigation: rnav, gps_nav
required navigation performance: rnp
localizer: loc
glideslope: gs_glide, gp
class bravo: class_b, charlie_b
class charlie: class_c
class delta: class_d
class echo: class_e
class golf: class_g
prohibited area: prohibited
restricted area: restricted
military operations area: moa
temporary flight restriction: tfr

# Documents / standards
pilots handbook of aeronautical knowledge: phak, faah808325
airplane flying handbook: afh, faah80833
instrument flying handbook: ifh, faah808315
instrument procedures handbook: iph, faah808316
aviation weather handbook: avwx, faah808328
risk management handbook: rmh, faah80832
aviation instructors handbook: aih, iah, faah80839
helicopter flying handbook: hfh, faah808321
glider flying handbook: gfh, faah80831
balloon flying handbook: bfh, faah80811
advisory circular: ac
notice to air missions: notam
aeronautical information manual: aim
pilot controller glossary: pcg
airman certification standards: acs
practical test standards: pts
private pilot license: ppl
instrument rating: ir
commercial pilot license: cpl
certified flight instructor: cfi
airline transport pilot: atp
mechanic certificate: amt, ap
inspection authorization: ia
biennial flight review: bfr, flight_review

# Operations
takeoff: tko, dep, departure
landing: ldg, arr, arrival
go around: ga, go_around
missed approach: missed
approach: appr, app
runway: rwy
taxiway: twy
hold short: hold
line up and wait: luaw
cleared for takeoff: cft
```

The map lives at `libs/aviation/src/synonyms.ts`. Query rewriter:

1. Lowercase + strip non-alphanumeric (except `§`).
2. Tokenize on whitespace.
3. For each token: if it appears in the alias side, also try the canonical side; if it appears in the canonical side, also include all aliases (so a card tagged "wx" surfaces on "weather" and vice versa).
4. Reassemble OR-of-token-sets and pass to ranker.

Test fixture mirrors the table: each canonical and each alias must return at least one result, and querying either form must produce overlapping result sets.

## Open product questions -- now closed

All four open questions were resolved (see Decisions above). Remaining open items for the WP:

1. **Doc-picker scope on cold typing.** When the user types just `FAA-H-` (no further chars), do we show all 9 FAA-H- handbooks alphabetically, or by recency-of-use? My lean: alphabetically first session, then weight by recency once we have telemetry.
2. **Validated-tools list contents.** Phase 1 seed: aviationweather.gov, 1800wxbrief.com, faa.gov/notams, skyvector.com. Send your additions before Phase 1 ships.
3. **Detail pane on narrow viewports.** Probably hide entirely below ~900px -- detail moves into a tap-to-expand card under the selected row. Confirm in mockup review.

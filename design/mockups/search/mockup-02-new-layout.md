---
title: New layout proposal -- top hits + vertical type nav + result column + detail
parent: REDESIGN.md
---

# New layout proposal

## Full palette (medium-to-wide viewport)

```text
+--------------------------------------------------------------------------------------+
| > weather                                                              [ x ]         |  <- input
+--------------------------------------------------------------------------------------+
|                                                                                      |
|  TOP HITS                                                                            |
|  +--------------------------------------------------------------------------------+ |
|  | FAA-H-8083-28   Aviation Weather Handbook                       [Handbook]    | |
|  | AC 00-6B        Aviation Weather                                [AC]          | |
|  | Weather (Course)                                                [Course]      | |  <- 3 rows, ranker-decided
|  +--------------------------------------------------------------------------------+ |
|                                                                                      |
+--------------------+-------------------------------------------+---------------------+
|  Handbooks    (7) >|  FAA-H-8083-28  Aviation Weather Handbook |  AVIATION WEATHER   |  <- detail pane
|  CFRs        (38)  |  FAA-H-8083-25  PHAK                      |  HANDBOOK           |
|  AIM          (4)  |  FAA-H-8083-3   AFH                       |  FAA-H-8083-28B     |
|  AC           (3)  |  FAA-H-8083-16  IPH                       |                     |
|  Knowledge   (15)  |  FAA-H-8083-15  IFH                       |  Last revised 2022  |
|  Courses      (2)  |  FAA-H-8083-21  HFH                       |                     |
|  Glossary     (8)  |  FAA-H-8083-2   RMH                       |  Chapters:          |
|  Mine         (2)  |                                           |   1. Atmosphere     |
|  Tools        (2)  |                                           |   2. Heat Transfer  |
|  App Help     (1)  |                                           |   3. Temperature ...|
|  (hidden by        |                                           |   4. Moisture ...   |
|   default)         |                                           |   ...               |
|                    |                                           |                     |
|                    |                                           |  [ Open ]           |
|                    |                                           |  [ Search inside ]  |
|                    |                                           |  [ Cite this ]      |
|                    |                                           |  [ Pin to today ]   |
+--------------------+-------------------------------------------+---------------------+
| [ ] [ ] jump column   Tab move focus   Up/Down select   Enter open   Cmd+\ detail   |
+--------------------------------------------------------------------------------------+
```

### Anatomy

1. **Input row** (top).
2. **Top hits strip** (3 best-overall rows; mixed types; ranker-decided). Compact. One line per hit. Each hit shows `code` + `title` + `[Type chip]`.
3. **Left column: type nav (vertical).** One row per type bucket with count. Click or arrow-down to select. The currently-selected type drives the middle column. `App Help` is hidden by default; surfaces when explicitly selected or when no other types have results.
4. **Middle column: result list.** ONE row per book/document for the selected type. Books that have sub-results (chapters / sections / paragraphs) carry an `result.children` slot the detail pane uses, NOT separate rows here.
5. **Right column: detail pane.** Title, full citation, snippet, **list of sub-results clickable** (chapters / sections), action buttons.
6. **Status bar / keybinds hint.**

## Narrow viewport (< 900px)

```text
+---------------------------------------------------+
| > weather                                  [ x ]  |
+---------------------------------------------------+
|                                                   |
|  TOP HITS                                         |
|  FAA-H-8083-28  Aviation Weather Handbook         |
|  AC 00-6B       Aviation Weather                  |
|  Weather Course                                   |
|                                                   |
+---------------------------------------------------+
|  [Handbooks 7] [CFRs 38] [AIM 4] [AC 3] [More v]  |  <- type chips horizontal, scrollable
+---------------------------------------------------+
|  FAA-H-8083-28  Aviation Weather Handbook         |
|  FAA-H-8083-25  PHAK                              |
|  FAA-H-8083-3   AFH                               |  <- result list (current group)
|  ...                                              |
+---------------------------------------------------+
|  (detail pane collapsed; tap a row to expand)     |
+---------------------------------------------------+
```

Below 900px: type nav collapses to a horizontal chip row at the top of the result area; detail pane collapses entirely (tap row to push a detail sheet over the result list).

## Type bucket order (left column)

Ordered by usefulness for the typical pilot. Adjust based on usage:

1. Handbooks
2. CFRs
3. AIM
4. AC
5. ACS / PTS
6. Knowledge nodes
7. Courses
8. Glossary
9. Mine (cards / reps / plans)
10. Tools (external)
11. App Help (collapsed by default)

The currently-selected bucket is highlighted. If a query has 0 hits in a bucket, the bucket still renders in the nav but greyed out + count = 0, so the user can see what's NOT matching.

## Intent shapes (three flavors of result panel)

### I-1: Scoped search (user Tab-committed a doc from autocomplete)

```text
+----------------------------------------------------------------------+
| > [doc:FAA-H-8083-28]  weather                                  [x]  |  <- input + filter chip
+----------------------------------------------------------------------+
|                                                                      |
| AVIATION WEATHER HANDBOOK                                            |  <- big headline card
| FAA-H-8083-28B                                                       |
| [ Open ]  [ Cite ]  [ Pin ]                                          |
|                                                                      |
+----------------------------------------------------------------------+
| REFERENCES TO THIS DOC                                               |  <- citations panel
|  Lessons (4):                                                        |
|    - Weather Theory Lesson (study/weather-course/02)                 |
|    - Weather Briefings Lesson (study/weather-course/06)              |
|    - ...                                                             |
|  Knowledge nodes (12):                                               |
|    - Air Masses and Fronts                                           |
|    - Freezing Level                                                  |
|    - ...                                                             |
|  Cited in (3):                                                       |
|    - AC 00-6B cross-references AvWX Ch. 12                           |
+----------------------------------------------------------------------+
```

Intent: "I know what doc I want; show me everything connected to it."

### I-2: Broad mixed search (default)

```text
+----------------------------------------------------------------------+
| > weather                                                       [x]  |
+----------------------------------------------------------------------+
| TOP HITS                                                             |
|  FAA-H-8083-28  Aviation Weather Handbook            [Handbook]      |
|  AC 00-6B       Aviation Weather                     [AC]            |
|  Weather (Course)                                    [Course]        |
+----------------------------------------------------------------------+
| (left nav) | (result column -- one row per book/doc)  | (detail)    |
+----------------------------------------------------------------------+
```

(Full layout already shown above.)

### I-3: Phrase-level FTS (user typed a fuzzy memory)

```text
+----------------------------------------------------------------------+
| > something about dusk vs sunset                                [x]  |
+----------------------------------------------------------------------+
|                                                                      |
| PASSAGES (no top-hits strip; no left nav by type)                    |
|                                                                      |
|  +-----------------------------------------------------------------+ |
|  | 14 CFR §1.1  General Definitions                                | |
|  |                                                                 | |
|  | "...night means the time between the end of evening **civil**   | |
|  | **twilight** and the beginning of morning civil twilight, as    | |
|  | published in the Air Almanac, converted to local time..."       | |
|  |                                                                 | |
|  | [Open §1.1]                                                     | |
|  +-----------------------------------------------------------------+ |
|                                                                      |
|  +-----------------------------------------------------------------+ |
|  | 14 CFR §61.57  Recent Flight Experience                         | |
|  |                                                                 | |
|  | "...for the purpose of meeting the requirements of paragraph    | |
|  | (b) of this section, a person may act as pilot in command of    | |
|  | an aircraft under day VFR or day IFR, provided no persons or    | |
|  | property are carried on board the aircraft, other than those    | |
|  | necessary for the conduct of the flight. **Night** means the    | |
|  | period beginning 1 hour after **sunset**..."                    | |
|  +-----------------------------------------------------------------+ |
|                                                                      |
|  ...                                                                 |
+----------------------------------------------------------------------+
```

Intent: "Find me the passage." Returns sections / paragraphs / knowledge-node fragments. Each card shows the matched passage with the hit terms highlighted. Whole-doc results are deranked or omitted -- the user clearly doesn't want a book, they want a sentence.

The left type-nav is hidden in this mode (passages aren't grouped by document type usefully). Top-hits strip is also hidden. The whole pane is the passage list.

User can click a passage to jump to it in flightbag (with the passage anchor preserved).

## Row template (always show doc ID)

```text
+----------------------------------------------------------------+
| FAA-H-8083-28   Aviation Weather Handbook            [Handbook]|
+----------------------------------------------------------------+
| §91.103         Preflight Action                     [CFR]     |
+----------------------------------------------------------------+
| AIM 7-1-12      Weather Briefings                    [AIM]     |
+----------------------------------------------------------------+
| AC 00-6B        Aviation Weather                     [AC]      |
+----------------------------------------------------------------+
```

Every published-resource row has:

- **Doc code** (left, monospace, prominent)
- **Title** (next, primary text)
- **Type chip** (right, small)
- Optional **subtitle / snippet** below (only when FTS-matched)

Non-published rows (knowledge nodes, glossary, user content, tools) skip the doc-code column:

```text
+----------------------------------------------------------------+
| Air Masses and Fronts                              [Knowledge] |
+----------------------------------------------------------------+
| Va                                                  [Glossary] |
| Maneuvering speed                                              |
+----------------------------------------------------------------+
```

## Detail pane content per result type

| Result type            | Detail content                                             |
| ---------------------- | ---------------------------------------------------------- |
| Handbook root          | Title + code + edition + clickable chapter list + actions  |
| CFR Part root          | Title + code + clickable section list + actions            |
| AIM chapter            | Title + code + clickable paragraph list + actions          |
| AC / ACS               | Title + code + revision + clickable section list + actions |
| Knowledge node         | Title + summary + linked references                        |
| Glossary term          | Term + aliases + paraphrase + linked references            |
| User card / rep / plan | Title + state + linked deck / lesson                       |
| Course / lesson        | Title + linked cert / syllabus + actions                   |
| External tool          | Title + description + tier badge + Open in new tab         |
| App Help               | Title + summary + Open                                     |

The "Search inside" action sets `doc:<code>` filter chip on the palette, returns focus to the input, and filters all subsequent searches to that doc's contents only.

---
title: Current state -- what ships in Phase 3 (and what's wrong)
parent: REDESIGN.md
---

# Current state (Phase 3 as merged)

## What renders today on `query = "weather"` (apparent from Joshua's walk)

```text
+----------------------------------------------------------------------+
| > weather                                                            |
+----------------------------------------------------------------------+
| FAA RESOURCES (n)             AIRBOSS CONTENT (n)    APP HELP (n)    |
|                                                                      |
| 14 CFR 121.101  weather...    Air Masses and Fronts  ADM and SRM     |
| 14 CFR 119      weather...    Attention Mgmt...                      |
| AFH 14.5  weather vaning      Clearing the Area...                   |
| AFH 17.8  wx consideration    Engine Failure...                      |
| AC 00-6B  ...                 Fog, Frost, Vis Obs.                   |
| AIM 7-1-3  ...                Freezing Level                         |
| AIM 7-1-12 ...                Graphical Forecasts                    |
| AFH 0.6 intro                 Ground Reference Mvr                   |
| ...                                                                  |
+----------------------------------------------------------------------+
```

## What's wrong

1. **The Aviation Weather Handbook (FAA-H-8083-28) -- the book named after the query -- is not in the top results.** Section-level body matches outrank it because the ranker treats `displayName-match-bucket-1` (section title contains "weather") the same as the book's own title match.
2. **No counts** at the column headers.
3. **Chapters of a book are listed as separate result rows** alongside the book itself. A query for `FAA-H-8083-28` returns the book + 14 separate chapter rows in the same column.
4. **App Help shouldn't be in the default view.** It only adds noise to the common case.
5. **"FAA Resources" is misleading** -- NTSB / industry / charts aren't FAA-authored.
6. **No filter UI.** The user can't say "show me only handbooks" without typing a `kind:` facet.
7. **Autocomplete fires inside the column display**, mashing the suggested-doc dropdown into the same visual space as the search results.

## What renders today on `query = "FAA-H-8083-28"`

```text
+----------------------------------------------------------------------+
| > FAA-H-8083-28                                                      |
+----------------------------------------------------------------------+
| FAA RESOURCES                                                        |
|                                                                      |
| Aviation Weather Handbook (the book)                                 |  <- correct: book hoisted
| Chapter 1 of the Aviation Weather Handbook                           |  <- wrong: chapters
| Chapter 2 of the Aviation Weather Handbook                           |  <- pollute the column
| Chapter 3 of ...                                                     |
| ...                                                                  |
| Chapter 14 of ...                                                    |
+----------------------------------------------------------------------+
```

Each chapter is a separate `faa.handbook.chapter` result. There are 14 chapters in AvWX so the column shows 15 rows for what is conceptually one document. Same shape for `Part 91` (one part + N sections).

## Why this happened

The Phase 3 design ASSUMED Variant C was the production default and that columns were the right grouping shape. Joshua's walk showed:

- Columns side-by-side don't help when one column has 30 rows and another has 2.
- Section-level results need to either roll up to their parent or move to a separate display surface (the detail pane).
- The ranker needs to know that "book named X" outranks "section about X" -- without that, every query that's also a book name gets mismatched.

The fix lives in `REDESIGN.md` next to this file.

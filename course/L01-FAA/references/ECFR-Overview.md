# eCFR Overview

## Available Parts

4 parts extracted from Title 14 CFR:

| Part     | Title                                                             | Sections | Words  |
| -------- | ----------------------------------------------------------------- | -------- | ------ |
| Part 1   | Definitions and Abbreviations                                     | 3        | 9,612  |
| Part 141 | Pilot Schools                                                     | 48       | 34,510 |
| Part 61  | Certification: Pilots, Flight Instructors, and Ground Instructors | 141      | 82,605 |
| Part 91  | General Operating and Flight Rules                                | 273      | 90,695 |

**Total:** 465 sections, 217,422 words

## Search

The FAA citation search API provides full-text search and citation lookup.

- Full-text search: `GET /api/faa-search?q=flight+review`
- Citation lookup: `GET /api/faa-search?cite=61.56`

Results include citation keys, section titles, snippets with highlighted matches, and parent path context.

## Data Pipeline

These files are generated from the FAA ingest pipeline:

1. `bun run faa fetch` -- download eCFR XML from the federal register
2. `bun run faa extract ecfr` -- extract text and markdown from XML
3. `bun run faa index` -- build citation index for search
4. `bun run faa pages` -- copy markdown to docs for browsing

## Last Extracted

Date: 2026-04-04T01:38:12.849Z

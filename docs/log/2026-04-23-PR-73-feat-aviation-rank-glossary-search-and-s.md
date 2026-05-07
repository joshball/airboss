---
pr: 73
date: 2026-04-23
title: "feat(aviation): rank glossary search and surface match provenance"
wp_id: null
bugs_fixed: []
summary: |
  Glossary search now ranks results instead of returning them in registration order, so q=adm lands on ADM first (was 4th behind FAA, TSA, Administrator). Each hit carries provenance (matchedField, matchedText, matchRange) so the card can <mark> the match and show "matched: *Federal Aviation Administration* (alias)" when the hit isn't on the title. Fixes the "why is FAA here for adm?" confusion.
---

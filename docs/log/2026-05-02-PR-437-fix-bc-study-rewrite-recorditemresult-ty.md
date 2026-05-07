---
pr: 437
date: 2026-05-02
title: "fix(bc-study): rewrite recordItemResult -- typed errors, no upsert, single tx, audit emit"
wp_id: null
bugs_fixed: []
summary: |
  Convergent root-cause fix for four findings in the chunk-2 study BC review (docs/work/reviews/2026-05-01-study-bc-domain-INDEX.md). All four pointed at recordItemResult in libs/bc/study/src/sessions.ts. The function silently inserted ghost slot rows on bad input, threw SessionNotFoundError for review-row misses (so 2am operators chased the wrong primary key), and ran its existence checks outside the transaction holding the actual write. Rewrote it once, at the root.
---

---
pr: 587
date: 2026-05-04
title: "fix(bc-study,security): Zod validation at goals BC boundary (chunk-2)"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Closes the chunk-2 security MAJOR "goals.ts skips BC-level Zod validation" finding. libs/bc/study/src/goals.ts now parses every write input via Zod at function entry; ZodError throws before any DB I/O.
---

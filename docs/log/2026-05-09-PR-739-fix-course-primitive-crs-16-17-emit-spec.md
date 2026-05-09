---
pr: 739
date: 2026-05-09
title: "fix(course-primitive): CRS-16/17 emit spec messages, not Zod defaults"
wp_id: course-primitive
bugs_fixed: []
summary: |
  Phase 7 smoke acceptance (#737, merged) caught a real gap: scenarios CRS-16 (step missing knowledge_node_id) and CRS-17 (section carrying knowledge_node_id) rejected correctly with no DB writes, but the rejection string came from Zod (steps.0.knowledge_node_id: Required / Unrecognized key(s) in object: 'knowledge_node_id') instead of the spec's verbatim seed-handler messages. The friendlier strings already existed in the seed handler at scripts/db/seed-courses.ts but were unreachable because Zod rejected the YAML first.
---

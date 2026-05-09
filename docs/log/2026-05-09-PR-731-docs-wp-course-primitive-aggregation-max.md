---
pr: 731
date: 2026-05-09
title: "docs(wp): course-primitive aggregation = MAX, not SUM"
wp_id: course-primitive
bugs_fixed: []
summary: |
  Phase 3 BC implementation (#730) surfaced that the WP docs said per-node weight is **summed** across reachable paths when a node is reached via multiple sources (course + syllabus, etc.), but the existing \getGoalNodeUnion\ semantic is **MAX-of-paths** (\"most-prominent context wins\" — matches the relevance-cache rebuild rule).
---

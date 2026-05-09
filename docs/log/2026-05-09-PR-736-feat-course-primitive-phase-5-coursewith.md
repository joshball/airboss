---
pr: 736
date: 2026-05-09
title: "feat(course-primitive): Phase 5 - courseWithCertOverlayLens + getCourseGaps"
wp_id: course-primitive
bugs_fixed: []
summary: |
  Phase 5 of the course-primitive WP. Ships the cert overlay lens and the standalone gap helper. Both share one canonical algorithm so a tree consumer (the lens) and a non-tree consumer (e.g. a "this course leaves N cert leaves uncovered" banner) produce the same gap list.
---

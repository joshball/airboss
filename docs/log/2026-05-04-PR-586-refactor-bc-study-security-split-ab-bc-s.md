---
pr: 586
date: 2026-05-04
title: "refactor(bc-study,security): split @ab/bc-study barrel from /build subpath (chunk-2)"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Closes the chunk-2 security MAJOR finding (docs/work/reviews/2026-05-01-study-bc-domain-security.md): build-only writers were exported from the BC barrel without auth gates, creating a latent IDOR/authz hazard if any future route imported them.
---

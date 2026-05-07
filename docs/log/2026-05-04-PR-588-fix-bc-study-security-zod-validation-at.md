---
pr: 588
date: 2026-05-04
title: "fix(bc-study,security): Zod validation at goals BC boundary (chunk-2)"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Closes the chunk-2 security MAJOR finding (docs/work/reviews/2026-05-01-study-bc-domain-security.md): goals.ts write helpers accepted typed inputs but never parsed them, so a cross-BC caller or script bypassing the route layer could inject oversized titles, oversized notes, out-of-range weights, malformed dates, or unknown domain slugs. The schemas already lived in credentials.validation.ts; the gap was the integration. Cards/scenarios already do the same pattern.
---

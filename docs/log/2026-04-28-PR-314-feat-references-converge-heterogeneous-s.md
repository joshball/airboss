---
pr: 314
date: 2026-04-28
title: "feat(references): converge heterogeneous synthetic refs into authored rows"
wp_id: null
bugs_fixed: []
summary: |
  Cert-syllabus phase 17 left 11 heterogeneous synthetic study.reference rows tagged seed_origin = 'migrate-references-to-structured-v1'. This PR converges them so a fresh bun run db reset --force produces zero synthetic rows.
---

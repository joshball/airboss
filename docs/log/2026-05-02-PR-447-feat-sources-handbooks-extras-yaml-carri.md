---
pr: 447
date: 2026-05-02
title: "feat(sources): handbooks-extras YAML carries subjects + primary_cert"
wp_id: null
bugs_fixed: []
summary: |
  Follow-up to #431 (WP-MTN). Closes the bug surfaced there: \bun run sources register handbooks-extras\ rewrites every produced manifest cleanly each run and previously stripped \subjects\ + \primary_cert\ because the producer didn't author them. Now the YAML is the canonical source for both fields and ingest writes them into every manifest.
---

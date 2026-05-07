---
pr: 91
date: 2026-04-24
title: "fix(study): biome import order in sessions.ts after CERTS migration"
wp_id: null
bugs_fixed: []
summary: |
  Follow-up to #90. Biome auto-fix for import order after CERTS moved into CERT_VALUES/Cert alphabet position. Wave B agent couldn't run bun run check in its sandbox, so this slipped through; caught locally and fixed with bunx biome check --write. bun run check now passes clean.
---

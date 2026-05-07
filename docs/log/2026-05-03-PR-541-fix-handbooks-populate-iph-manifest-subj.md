---
pr: 541
date: 2026-05-03
title: "fix(handbooks): populate IPH manifest subjects from yaml"
wp_id: null
bugs_fixed: []
summary: |
  Manifest at handbooks/iph/FAA-H-8083-16B/manifest.json had subjects: [], but the YAML at scripts/sources/config/handbooks/iph.yaml declares [procedures, navigation, flight-instruments]. The seed Zod schema requires ≥1 subject, so bun run db reset was failing during the handbooks phase.
---

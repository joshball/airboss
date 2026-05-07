---
pr: 556
date: 2026-05-03
title: "fix(seed): skip CFR Parts whose body files aren't registered yet (don't crash fresh dev seed)"
wp_id: null
bugs_fixed: []
summary: |
  The CFR manifest seeder hard-throws when a section's body markdown file is missing on disk. That's wrong on a fresh dev box: body files are gitignored per ADR 018 (developer-local cache derivative) and only materialize when the operator runs bun run sources register cfr --title=N --edition=YYYY-MM-DD. Result: every new dev box hits this seed crash, and the whole seed run aborts before cards / abby phases finish.
---

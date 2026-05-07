---
pr: 477
date: 2026-05-02
title: "fix(libs): browser-safe outbound-url + deck-spec, add lint guard + docs"
wp_id: null
bugs_fixed: []
summary: |
  Fix two more browser-safety bugs of the same class as PR #471: libs/utils/src/outbound-url.ts (which was crashing the login page with Module \"node:dns/promises\" has been externalized for browser compatibility) and libs/bc/study/src/deck-spec.ts (node:crypto). Both now lazy-load via process.getBuiltinModule(). Add a Biome correctness/noNodejsModules: error override in biome.json for the 12 client-bundled libs so this class of bug is caught at lint time, not at first browser load. Document the rule + pattern + escape hatches in CLAUDE.md (Critical Rules) and docs/agents/best-practices.md (new...
---

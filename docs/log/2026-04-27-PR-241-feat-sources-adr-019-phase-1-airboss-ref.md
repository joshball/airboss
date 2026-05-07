---
pr: 241
date: 2026-04-27
title: "feat(sources): ADR 019 phase 1 -- airboss-ref: identifier validator"
wp_id: reference-identifier-scheme-validator
bugs_fixed: []
summary: |
  Phase 1 of ADR 019 per the signed-off work package. Introduces a new \@ab/sources\ lib at \libs/sources/\ that owns the \airboss-ref:\ URI scheme: parser (§1.1 + §1.1.1), 15-rule validator (§1.5), and lesson Markdown walker (§3.4). Wired into \bun run check\ via a new \scripts/airboss-ref.ts\ step that runs alongside the legacy \[[id]]\ validator.
---

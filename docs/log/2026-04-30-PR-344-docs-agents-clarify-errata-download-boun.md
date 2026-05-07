---
pr: 344
date: 2026-04-30
title: "docs(agents): clarify errata download boundary (Python on-demand, not TS pre-fetch)"
wp_id: null
bugs_fixed: []
summary: |
  Codifies a design boundary in two agent docs: errata files are **not** downloaded by \bun run sources download\. They're fetched on-demand by the Python \apply_errata.py\ when \--apply-errata <id>\ runs.
---

---
pr: 304
date: 2026-04-28
title: "fix(db): import db/client from @ab/db/connection, not @ab/db"
wp_id: null
bugs_fixed: []
summary: |
  PR #285 (schema consolidation) moved the live db and client exports out of @ab/db/index.ts into the side-effectful @ab/db/connection. Five callers were not updated and broke at runtime once the change landed:
---

---
pr: 375
date: 2026-04-30
title: "feat(hangar): retire /admin/audit-ping (route gone, enum stays per ADR 004)"
wp_id: hangar-audit-explorer
bugs_fixed: []
summary: |
  Retires the scaffold-era /admin/audit-ping heartbeat. With hangar-audit-explorer (#365) and hangar-users-editing (#371) shipped, real BCs emit audit rows and the diagnostic role of the ping is over.
---

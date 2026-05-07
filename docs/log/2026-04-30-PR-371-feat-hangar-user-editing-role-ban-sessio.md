---
pr: 371
date: 2026-04-30
title: "feat(hangar): user editing -- role / ban / session revoke (first admin-write surface)"
wp_id: hangar-users-editing
bugs_fixed: []
summary: |
  The first **admin-write surface** in hangar. Turns the read-only /users/[id] directory into a real edit surface with five form actions: role assign, ban, unban, revoke single session, revoke all sessions. Sets the dual-gate pattern (per-page requireRole(ADMIN) + audit emission + typed-confirmation modal) that every later admin-write WP will follow.
---

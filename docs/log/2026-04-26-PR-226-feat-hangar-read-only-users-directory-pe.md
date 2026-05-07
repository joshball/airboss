---
pr: 226
date: 2026-04-26
title: "feat(hangar): read-only /users directory + per-user detail"
wp_id: null
bugs_fixed: []
summary: |
  New read-only admin surface at /users (list) and /users/[id] (detail) in the hangar app, listing every bauth_user with lastSeenAt aggregated from bauth_session. Search by name or email is server-side via Drizzle ilike, matching the /glossary pattern. Detail page shows profile (id, role badge, banned flag, created/updated, last seen), the last 10 sessions (token/ip/ua/timestamps), and the last 20 audit rows authored by the user. Nav (apps/hangar/src/lib/components/Nav.svelte) gains a Users link between Glossary and Jobs. Adds HANGAR_USERS and HANGAR_USER_DETAIL(id) to ROUTES and ROLE_VALUES +...
---

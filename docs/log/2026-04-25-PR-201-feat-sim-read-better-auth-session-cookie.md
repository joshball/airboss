---
pr: 201
date: 2026-04-25
title: "feat(sim): read better-auth session cookie"
wp_id: null
bugs_fixed: []
summary: |
  Item #3. Sim now reads the cross-subdomain bauth_session_token cookie and populates event.locals.user / event.locals.session. Sim does **not** host the login UI -- study owns that.
---

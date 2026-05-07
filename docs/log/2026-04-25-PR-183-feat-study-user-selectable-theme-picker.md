---
pr: 183
date: 2026-04-25
title: "feat(study): user-selectable theme picker"
wp_id: null
bugs_fixed: []
summary: |
  Adds a theme dropdown in the study app header (between HelpSearch and the identity menu) so the four registered themes (airboss/default, study/sectional, study/flightdeck, sim/glass) are actually choosable. Persists selection via a theme cookie mirroring the appearance-cookie pattern; POST /theme validates input through the registry so unknown ids can't slip in. Pre-hydration script in app.html reads the cookie and applies data-theme on <html> before first paint -- no flash of the wrong theme on reload. Picker iterates listThemes() and uses each theme's name field for the label -- no...
---

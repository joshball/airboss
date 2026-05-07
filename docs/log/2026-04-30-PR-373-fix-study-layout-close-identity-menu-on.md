---
pr: 373
date: 2026-04-30
title: "fix(study/layout): close identity menu on outside pointerdown"
wp_id: null
bugs_fixed: []
summary: |
  The identity menu (top-right user dropdown) hosts non-navigating controls (theme radios, sign-out form) so it does not auto-dismiss on link-click like the other nav menus do. This adds a window-level pointerdown listener that closes the menu when a click lands outside its details element. Clicks on appearance radios stay inside and are unaffected.
---

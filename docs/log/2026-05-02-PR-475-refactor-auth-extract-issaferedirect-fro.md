---
pr: 475
date: 2026-05-02
title: "refactor(auth): extract isSafeRedirect from login routes"
wp_id: null
bugs_fixed: []
summary: |
  Extract the isSafeRedirect helper from study and hangar login routes into @ab/auth. Closes the chunk-1 / chunk-3 security finding flagged in the 2026-05 review program (cited as the "isSafeRedirect extracted to @ab/auth" deferred item in the wave-9 PR bodies).
---

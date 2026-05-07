---
pr: 186
date: 2026-04-25
title: "feat(sim): pulse altitude-alert on first arm"
wp_id: null
bugs_fixed: []
summary: |
  Track 3a from the sim continuation handoff. The altitude-alert cue's setTarget(feet | null) API existed but was silent on arming -- only crossings of target +/- LEAD_FEET fired the tone. Real altitude-alerters give an audible confirmation when you dial in a new cleared altitude. Wire that.
---

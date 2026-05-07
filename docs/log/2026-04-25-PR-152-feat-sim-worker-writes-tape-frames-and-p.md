---
pr: 152
date: 2026-04-25
title: "feat(sim): worker writes tape frames and posts ReplayTape on outcome"
wp_id: null
bugs_fixed: []
summary: |
  Completes the Phase 4 worker side of the replay pipeline. The FDM worker now records frames into a FrameRing during a run and posts a TAPE message with the full ReplayTape on outcome.
---

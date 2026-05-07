---
pr: 189
date: 2026-04-25
title: "feat(sim): fire ap-disconnect cue on fault-activation edge"
wp_id: null
bugs_fixed: []
summary: |
  Track 3c. The ap-disconnect cue and firePilotDisconnect() trigger have been wired since Phase 5 but nothing called them. Per the handoff, AP_DISCONNECT lives in SIM_WARNING_CUES, not SIM_FAULT_KINDS, so the hookup is via warning-cue dispatch -- not fault evaluation.
---

---
pr: 58
date: 2026-04-23
title: "feat(sim): Phase 0.6 polish -- engine sound, WS swap, cheatsheet, mute icon"
wp_id: null
bugs_fixed: []
summary: |
  Procedural engine sound driven by FDM snapshots (two-oscillator additive synth + band-passed noise). RPM, throttle, AoA, and dynamic pressure all shape the timbre; mute is shared with the stall horn; sound stops at scenario outcome. W and S swapped so stick-forward semantics hold: W pushes the yoke forward (nose drops), S pulls back (nose rises). Arrow keys now share the same actions -- ArrowUp = pitch up, ArrowDown = pitch down. Mute and pause are state icons now, not verbs. Speaker icon flips to speaker-with-slash when muted; play-triangle flips to pause-bars when running. aria-label and...
---

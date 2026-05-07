---
pr: 126
date: 2026-04-24
title: "feat(sim): spring-centered primary controls + hold-ramp throttle"
wp_id: null
bugs_fixed: []
summary: |
  Replace tap-based primary controls with a spring-centered ramp model. Elevator / aileron / rudder deflect while the direction key is held and return to neutral on release (~0.3 s to full, ~0.2 s to center). Throttle ramps while Shift/Ctrl is held (~0.4/s) and holds position on release -- real throttles don't self-center. Trim ([ / ]) and flaps (F / V) stay tap-based. Center/idle/full snap keys (X, C, Z, 0, 9) still work as instant overrides. requestAnimationFrame loop in the cockpit drives tickRamp each frame and posts minimal patches to the FDM worker. blur clears held keys so a key isn't...
---

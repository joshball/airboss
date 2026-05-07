---
pr: 523
date: 2026-05-03
title: "feat(constants): allocate port 9640 for flightbag dev server"
wp_id: flightbag-scaffold
bugs_fixed: []
summary: |
  Allocate PORTS.FLIGHTBAG = 9640 for the new flightbag app's dev server. Sequenced: 9600 study, 9610 sim, 9620 hangar, 9630 avionics, 9640 flightbag. Pre-shipped so the flightbag-scaffold agent (in flight) can use the constant rather than picking a free port at scaffold time.
---

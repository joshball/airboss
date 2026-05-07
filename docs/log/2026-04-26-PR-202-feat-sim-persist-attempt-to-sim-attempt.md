---
pr: 202
date: 2026-04-26
title: "feat(sim): persist attempt to sim.attempt on flight outcome"
wp_id: null
bugs_fixed: []
summary: |
  Item #4. Closes the data flow from completed flight to durable history. The cockpit POSTs the attempt to a new server endpoint when the worker emits TAPE; the endpoint validates, authorises, and inserts one row in sim.attempt.
---

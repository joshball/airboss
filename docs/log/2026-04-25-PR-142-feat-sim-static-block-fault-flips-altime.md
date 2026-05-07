---
pr: 142
date: 2026-04-25
title: "feat(sim): static-block fault flips altimeter to frozen reading (B5.alt)"
wp_id: null
bugs_fixed: []
summary: |
  First B5 fan-out PR. Replaces the static-block layer's no-op with the altimeter behavior: a blocked static port traps a single reference pressure inside the case, so the altimeter capsule stops responding to outside pressure changes and the indicated altitude freezes at whatever the port saw the moment it blocked.
---

---
pr: 120
date: 2026-04-24
title: "fix(sim): full-sweep VSI dial and full-width readout row"
wp_id: null
bugs_fixed: []
summary: |
  **VSI was a half-gauge.** The scale plotted across only the top half of the dial (0 at 9, +2000 at 12, -2000 at 6). Real VSIs sweep ~270° so climb arcs over the top to 3 o'clock and descent arcs under the bottom to 3 o'clock, with useful needle resolution near zero. **AGL / Alpha / Time was narrow and off-center.** It lived inside .engine-row next to the tach, capped at 2-instrument width, so it floated under the first two six-pack instruments instead of spanning the whole six-pack. **Alpha label.** Relabeled \"Alpha\" → \"Alpha / AOA\" so the modern GA terminology (angle of attack indicator)...
---

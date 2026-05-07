---
pr: 88
date: 2026-04-24
title: "fix(study): further tighten dashboard grid spacing"
wp_id: null
bugs_fixed: []
summary: |
  Follow-up to 86c1bf4 dashboard grid tightening. Collapses separate column-gap / row-gap into a single \gap\ expression, drops redundant overrides at the sm breakpoint, and tightens xs to \--space-lg\. Adds \box-sizing: border-box\ on \.slot\ so cell padding never exceeds the grid track width.
---

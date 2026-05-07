---
pr: 118
date: 2026-04-24
title: "fix(sim): restore \"5\" on altimeter and add bordered digital readout"
wp_id: null
bugs_fixed: []
summary: |
  Follow-up to #116. The earlier altimeter fix skipped both the \"5\" tick line and the \"5\" digit at 6 o'clock so the digital readout had clear air, but that broke the 0..9 scale reading -- a pilot glancing at the gauge saw 0,1,2,3,4,_,6,7,8,9.
---

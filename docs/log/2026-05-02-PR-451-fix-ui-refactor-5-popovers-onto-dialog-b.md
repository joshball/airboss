---
pr: 451
date: 2026-05-02
title: "fix(ui): refactor 5 popovers onto Dialog + Button, fix CitationPicker stuck-loading"
wp_id: null
bugs_fixed: []
summary: |
  Five popovers (SnoozeReasonPopover, SharePopover, JumpToCardPopover, CitationPicker, PfdKeyboardLegend) each reinvented scrim, focus trap, close button, and primary/ghost button styles despite Dialog and Button existing. This PR migrates all five onto the shared primitives, fixes a CitationPicker correctness bug found in the same review, and tightens the focus-trap allocation in Dialog / Drawer.
---

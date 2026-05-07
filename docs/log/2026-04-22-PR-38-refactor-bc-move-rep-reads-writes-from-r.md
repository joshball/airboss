---
pr: 38
date: 2026-04-22
title: "refactor(bc): move rep reads + writes from rep_attempt onto session_item_result (ADR 012 phase 5)"
wp_id: null
bugs_fixed: []
summary: |
  Phase 5 of ADR 012. Every BC function that currently reads or writes repAttempt now reads or writes session_item_result. The rep_attempt table is still in the schema (Phase 4 drops it in the next PR), but no code path reads or writes it anymore.
---

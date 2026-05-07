---
pr: 76
date: 2026-04-23
title: "docs(theme-overhaul): reconcile #1 acceptance with its non-goals"
wp_id: null
bugs_fixed: []
summary: |
  Package #1's acceptance said \"grep for \--ab-\ returns zero across \apps/\ and \libs/ui/\\", contradicting its Non-goals which reserves the page-level \apps/study\ sweep for package #5. Realigns #1's acceptance to cover only the 12 \libs/ui/\ primitives; study routes keep rendering via a compatibility-alias block in \generated/tokens.css\ that re-emits legacy \--ab-*\ names against the new role-token palette. Adds an explicit note to package #5 that it inherits the app-wide sweep + must remove the alias block as part of its acceptance.
---

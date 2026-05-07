---
pr: 12
date: 2026-04-21
title: "chore(scripts): single-word dispatcher pattern for all scripts"
wp_id: spaced-memory-items
bugs_fixed: []
summary: |
  Adopt the command-dispatcher pattern used in airboss-firc and legion-overwatch: every package.json script is a single word (no colons) that delegates to scripts/<name>.ts, and each dispatcher handles its own subcommands.
---

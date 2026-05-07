---
pr: 503
date: 2026-05-03
title: "docs(claude): never interrupt current work for mid-task requests"
wp_id: null
bugs_fixed: []
summary: |
  Mid-task requests get queued to the END of the todo list with a one-line ack. Don't stop, don't switch, don't partially address. Original plan continues. Exceptions: explicit stop/switch, clarification of the in-flight task, or new info that blocks the current task.
---

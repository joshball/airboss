---
id: bug-flightbag-ssr-stream-closed
title: Flightbag SSR crashes on parallel handbook section requests
product: flightbag
severity: major
status: open
discovered_pr: null
discovered_date: 2026-05-04
fix_pr: null
fix_wp: null
repro: |
  Hit N handbook section URLs concurrently against the flightbag SSR
  surface. Each request alone works fine; the parallel set throws
  "ReadableStream is already closed" inside the figure-streaming path.
tags: [flightbag, ssr, handbook]
---

# Flightbag SSR crashes on parallel handbook section requests

The flightbag SSR figure-streaming path throws
`ReadableStream is already closed` when several handbook section URLs are
requested in parallel. Single requests are unaffected.

## Investigation notes

- Surfaced in the multi-agent cleanup aggregate (2026-05-04) at
  `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` section 4.
- Reproducible via the new representative-pages e2e spec when it hits N
  handbook URLs concurrently.
- Likely a shared stream consumer that gets terminated by the first
  response and then reused by the second; figure delivery should mint a
  fresh stream per request.

## Cross-references

- This blocks anything that wants to fan out parallel handbook requests
  from flightbag (preloading, cross-app deep-links, batched audit).

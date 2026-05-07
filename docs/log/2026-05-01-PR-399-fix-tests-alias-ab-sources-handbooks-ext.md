---
pr: 399
date: 2026-05-01
title: "fix(tests): alias @ab/sources/handbooks-extras and stub all corpora in register --all tests"
wp_id: library-by-cert
bugs_fixed: []
summary: |
  Add @ab/sources/handbooks-extras to vitest aliases so scripts/sources/register.test.ts can import the dispatcher (suite was failing to load). Stub all six corpora in register.test.ts --all block. The dispatcher iterates cfr / handbooks / handbooks-extras / aim / ac / acs, but the tests only stubbed three -- the others called real runners and timed out.
---

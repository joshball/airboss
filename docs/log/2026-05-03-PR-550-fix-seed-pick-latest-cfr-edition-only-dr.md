---
pr: 550
date: 2026-05-03
title: "fix(seed): pick latest CFR edition only; drop stale 49 CFR snapshot"
wp_id: null
bugs_fixed: []
summary: |
  Fixes bun run db reset --force crash on a fresh dev box: the reference manifest dispatcher walked every on-disk CFR edition, but seedCfrManifest writes to a single (document_slug, edition='current') row regardless of snapshot date (CFR is rolling per ADR 019). The older snapshot's body markdown is gitignored per ADR 018, so the seeder threw missing body file for 49cfr830 §830.1 before any CFR section landed in the DB. Add ROLLING_EDITION_CORPORA + a pickEditions helper. For corpora listed there (just regulations today) the dispatcher picks the lexicographically-latest snapshot and skips older...
---

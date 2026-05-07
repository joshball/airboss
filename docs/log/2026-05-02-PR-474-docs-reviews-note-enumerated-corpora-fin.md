---
pr: 474
date: 2026-05-02
title: "docs(reviews): note ENUMERATED_CORPORA finding already closed"
wp_id: null
bugs_fixed: []
summary: |
  Verify-and-close on chunk-4 architecture#2 ("ADR 019 open corpus promise broken"). The review flagged ENUMERATED_CORPORA as a closed hand-maintained array; the current implementation at libs/sources/src/registry/corpus-resolver.ts:97 is a live iterable view backed by the resolver registry, and CR-08 in corpus-resolver.test.ts pins this property.
---

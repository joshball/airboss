---
pr: 482
date: 2026-05-02
title: "refactor(constants): add SOURCE_CACHE subdir block; route ingest paths through it"
wp_id: null
bugs_fixed: []
summary: |
  Closes a chunk-4 patterns major: every ingest pipeline was hardcoding its corpus subdirectory name ('ac', 'acs', 'aim', 'handbooks', 'regulations') when joining paths under the cache root or the in-repo derivative root, even though the cache root resolution itself was already centralised in @ab/constants/source-cache.
---

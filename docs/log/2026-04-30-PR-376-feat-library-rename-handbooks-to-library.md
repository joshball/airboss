---
pr: 376
date: 2026-04-30
title: "feat(library): rename /handbooks to /library, group by subject, expose every reference kind"
wp_id: null
bugs_fixed: []
summary: |
  Renames /handbooks to /library and rebuilds the index from a flat publisher-format grid into a **subject-grouped** browse over **every** reference kind (handbook, CFR, AC, ACS, PTS, AIM, PCG, NTSB, POH, other) -- not just FAA handbooks. Adds study.reference.subjects[] (1-3 from AVIATION_TOPICS) and authors subjects on every reference YAML entry + each ingested handbook manifest. Centralizes external-URL building in externalUrlForReference(kind, slug, edition, fallbackUrl) so a CFR slug like 14cfr91 always resolves to the right eCFR page; YAML url: fields remain a fallback. Catch-all 308...
---

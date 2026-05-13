---
id: whole-doc-promotion
title: 'Whole-Doc Handbook Promotion'
product: study
category: content
type: umbrella
status: in-flight
agent_review_status: done
human_review_status: pending
created: '2026-05-02'
shipped_prs: [504, 508, 509, 535]
tags: [umbrella, handbooks, ingestion]
---

# Whole-Doc Handbook Promotion

Umbrella WP. Coordinates the promotion of 5 whole-doc-shape FAA handbooks (RMH, AIH, IFH, IPH, MTN-Tips) to the section-tree shape used by PHAK, AFH, and AVWX. The umbrella itself ships nothing of its own; each handbook is promoted by its own sibling WP. Per-handbook OOS lives in those sibling WPs.

## Sub-packages (siblings)

| Handbook                       | Sub-WP                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| Tips on Mountain Flying        | [`wp-mtn-section-tree`](../wp-mtn-section-tree/)               |
| Risk Management Handbook       | [`wp-rmh-section-tree`](../wp-rmh-section-tree/)               |
| Aviation Instructor's Handbook | [`wp-aih-section-tree`](../wp-aih-section-tree/)               |
| Instrument Flying Handbook     | [`wp-ifh-section-tree`](../wp-ifh-section-tree/)               |
| Instrument Procedures Handbook | [`wp-iph-section-tree`](../wp-iph-section-tree/)               |
| Handbooks-extras corpus retire | [`wp-handbooks-extras-retire`](../wp-handbooks-extras-retire/) |

## Coordination artifacts (in this dir)

- [research.md](./research.md) -- per-handbook source availability, embedded outline state, recommended extraction strategy.
- [sequence.md](./sequence.md) -- parallel-dispatch tracking from 2026-05-03 (the 7 background agents).
- [post-promotion-checklist.md](./post-promotion-checklist.md) -- cleanup checklist run after all 5 land.
- [source-tocs/](./source-tocs/) -- live, in-use data. `ifh.md` is referenced by `scripts/sources/config/handbooks/ifh.yaml` as the `toc_file` input to the `toc-file-sidecar` ingest strategy. Do not move without updating the YAML and re-running ingest. `rmh.md` and `avwx.md` are historical artifacts; safe to archive when their handbooks no longer reference them.

## Status

All 5 promotions plus the handbooks-extras-retire sub-WP shipped between PR #504 (2026-05-02) and the wave-2 PRs in May 2026 (see `docs/work/SHIPPED.md`). The umbrella stays `in-flight` until the user signs off; flipping to `shipped` requires the human-review gate.

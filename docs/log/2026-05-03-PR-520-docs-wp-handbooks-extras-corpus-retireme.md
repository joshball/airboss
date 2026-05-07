---
pr: 520
date: 2026-05-03
title: "docs(wp): handbooks-extras corpus retirement spec"
wp_id: null
bugs_fixed: []
summary: |
  Draft spec for retiring the handbooks-extras corpus once all 5 whole-doc promotions land. Per the no-legacy rule: when the corpus is empty (after WP-MTN, RMH, AIH, IPH, IFH all ship), delete the dispatcher case, schema discriminator, ingest module, override dir, configs, and associated docs. Sequenced after the 5 promotion WPs in flight.
---

---
pr: 71
date: 2026-04-23
title: "docs(hangar): lock plan decisions -- TOML-hybrid, job rows, multi-user"
wp_id: null
bugs_fixed: []
summary: |
  Glossary + sources move to checked-in TOML files under libs/db/seed/ Hangar mirrors them into DB tables at runtime; sync service writes TOML back + commits (local mode in dev, gh PR in prod) Real hangar.job rows day one (in-process worker, polled UI); /jobs route ships in wp-hangar-sources-v1 Multi-user from day one (actor-logged audits, concurrent-safe queue, manual DB seeding for MVP) Work packages reshuffled: scaffold -> **registry (new)** -> sources-v1 -> non-textual
---

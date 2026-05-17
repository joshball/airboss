---
name: FAA Document Families reference
status: in-progress
parent: ../README.md
---

# FAA Document Families

A reference page for every family of FAA documentation a pilot meets. Each page is a
standalone, citable entry: what the family is, whether it binds you or guides you, how its
identifiers are built, how it supersedes itself, where to find it online, how it cross-
references the other families, and the misreads that bite people.

This index table is the map the FAA does not publish. The FAA has no single browsable
directory of its documentation: the old master checklist of advisory circulars, AC 00-2,
was cancelled, and the Dynamic Regulatory System at `drs.faa.gov` is a search tool, not a
map. These pages are that missing map, one family at a time.

## How to use this reference

- Scan the family table below for the whole ecosystem at a glance.
- Open a family page for the full treatment: identifier anatomy, currency, cross-
  reference, gotchas, and verified sources.
- Or jump from any course step, scenario, or knowledge node via its inline link to a
  family page.

The pedagogical treatment of the navigation skills (the discovery walks for the AC
numbering system, citation anatomy, and cross-reference triangulation) lives in the
[knowledge graph](../../../knowledge/regulations/). These reference pages are the answer
key those nodes point at.

## The load-bearing distinction: binding or advisory

The one idea that organizes the whole ecosystem is regulatory versus advisory. A binding
document compels you: you can be violated for ignoring it. An advisory document guides
you: it shows an acceptable means of compliance, and you may comply another way. Confuse
the two and you either over-constrain (treating guidance as law) or under-constrain
(treating a rule as optional). Three families bind a pilot directly (14 CFR, Airworthiness
Directives, NOTAMs). The rest guide. FAA Orders are a special case: they bind the FAA and
its inspectors, not the pilot directly.

## Family catalog

| Family                          | Code        | Binding    | Issuer                         | Page                                                                     |
| ------------------------------- | ----------- | ---------- | ------------------------------ | ------------------------------------------------------------------------ |
| Title 14, CFR                   | 14 CFR      | Regulatory | Congress + FAA rulemaking      | [14-cfr](14-cfr/page.md)                                                 |
| Advisory Circulars              | AC          | Advisory   | FAA (subject-series office)    | [advisory-circulars](advisory-circulars/page.md)                         |
| Aeronautical Information Manual | AIM         | Advisory   | FAA Aeronautical Info Services | [aim](aim/page.md)                                                       |
| Pilot/Controller Glossary       | P/CG        | Advisory   | FAA Aeronautical Info Services | [pilot-controller-glossary](pilot-controller-glossary/page.md)           |
| Airman Certification Standards  | ACS         | Advisory   | FAA Flight Standards           | [airman-certification-standards](airman-certification-standards/page.md) |
| FAA Handbooks                   | FAA-H       | Advisory   | FAA Flight Standards           | [faa-handbooks](faa-handbooks/page.md)                                   |
| Orders and Notices              | Order / N   | Advisory   | FAA (issuing line of business) | [orders-and-notices](orders-and-notices/page.md)                         |
| Technical Standard Orders       | TSO         | Advisory   | FAA Aircraft Certification     | [technical-standard-orders](technical-standard-orders/page.md)           |
| Airworthiness Directives        | AD          | Regulatory | FAA Aircraft Certification     | [airworthiness-directives](airworthiness-directives/page.md)             |
| SAFOs and InFOs                 | SAFO / InFO | Advisory   | FAA Flight Standards           | [safo-and-info](safo-and-info/page.md)                                   |
| Notices to Air Missions         | NOTAM       | Regulatory | US NOTAM System                | [notams](notams/page.md)                                                 |
| Chart Supplements               | CS          | Advisory   | FAA Aeronautical Info Services | [chart-supplements](chart-supplements/page.md)                           |

## Status legend

- **done** - full treatment: binding status, identifier anatomy, currency, cross-reference, gotchas, verified sources.
- **draft** - full treatment authored, awaiting review.
- **stub** - page exists with frontmatter and a one-line description; full treatment pending.

## Authoring

New families: copy `_template.md` to `{slug}/page.md`, fill in the frontmatter, write the
body. Update this index table. Keep `related_families` and `related_knowledge_nodes`
frontmatter pointing at real targets.
</content>

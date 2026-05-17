---
id: faa-doc-advisory-circulars
title: Advisory Circulars
family_code: AC
binding: advisory
issuer: 'FAA (the responsible office for the subject series: Flight Standards, Aircraft Certification, Airports, and others)'
update_cadence: 'Per-document: each AC carries its own revision letter; a new revision or a change page supersedes the prior edition'
status: draft
authoritative_sources:
  - source: 'FAA Advisory Circulars portal'
    url: 'https://www.faa.gov/regulations_policies/advisory_circulars'
    note: 'The FAA-hosted, searchable list of current Advisory Circulars by number and subject.'
    verified: true
  - source: 'Dynamic Regulatory System (DRS)'
    url: 'https://drs.faa.gov'
    note: 'The modern FAA-wide search tool that replaced the cancelled AC 00-2 master checklist. Search, do not browse.'
    verified: true
  - source: 'AC 00-2 (cancelled), Appendix 1 -- Advisory Circular Numbering System'
    url: 'https://www.faa.gov/regulations_policies/advisory_circulars'
    note: 'The historical source for the subject-series prefix scheme. AC 00-2 itself is cancelled; the numbering convention it documented is still in use.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-ac-numbering-system
  - reg-faa-citation-anatomy
  - reg-faa-cross-reference-triangulation
related_families:
  - 14-cfr
  - faa-handbooks
  - technical-standard-orders
---

# Advisory Circulars

> FAA guidance that shows ONE acceptable means of complying with a regulation. An AC is not itself a rule, and you may comply another way.

## What it is

An Advisory Circular is the FAA's way of telling the public how it interprets a regulation
and what it will accept as compliance. When a 14 CFR section states a requirement in terse
legal language, the matching AC unpacks it: here is what we mean, here is a method that
satisfies it, here are the pitfalls. ACs are issued by whichever FAA office owns the
subject. Flight Standards owns most of the airmen and operations ACs; Aircraft
Certification owns the aircraft and equipment series; the Office of Airports owns the
150-series. There is no single office that owns "all ACs." The AC system covers everything
from how to log instrument experience to how to design a runway, and the numbering scheme
(see below) is the map into it.

## Binding or advisory

Advisory. This is the single most important fact about the family, and the one most often
gotten wrong. An AC presents *one* acceptable means of compliance with a rule. It is not
*the* means and it is not itself enforceable. If you comply with the underlying 14 CFR
section by a different method that the FAA would also accept, you have met your legal
obligation even though you did not follow the AC. The flip side is the real trap: a pilot
who treats an AC as law over-constrains, refusing operations the regulation actually
permits. The rule is the floor; the AC is a worked example of standing on it. Read the AC
to understand the rule, then comply with the rule.

## How it is identified

An AC number is not arbitrary. It mirrors the subject structure of 14 CFR. Take `AC 00-45H`:

```text
AC 00-45H
|  |  | |
|  |  | +-- revision letter H (the 8th revision)
|  |  +---- sequence number 45 within the 00 series
|  +------- subject series 00 (general)
+---------- document-type prefix "AC"
```

The leading number is a subject series, and for most series it tracks the parallel 14 CFR
part. The everyday series:

| Series | Subject                                              |
| ------ | ---------------------------------------------------- |
| 00     | General                                              |
| 20     | Aircraft                                             |
| 60     | Airmen (general)                                     |
| 61     | Certification: pilots, flight and ground instructors |
| 70     | Airspace                                             |
| 90     | Air traffic and general operating rules              |
| 120    | Air carrier and commercial operations                |
| 150    | Airports                                             |

There is no separate `91` series. The `90` series is air traffic and general operating
rules - the territory of 14 CFR Part 91 and the air-traffic parts (91, 93, 95, 97, 99). A
specific AC within that series is numbered after the CFR part it most directly supports, so
`AC 91-73` is a 90-series AC numbered `91` because it supports Part 91. So `AC 61-65` is
guidance about 14 CFR Part 61, and `AC 91-73` is guidance about Part 91. The skill of
predicting an AC's subject from its number is worth practicing, because it turns a wall of
acronyms into a navigable index. The identifier locates the document; the title ("Aviation
Weather Services" for AC 00-45H) describes it.

## Revisions and currency

An AC revises by letter. The first edition has no letter; the first revision is A, then B,
and so on. `AC 00-45H` is the eighth revision of AC 00-45. A revision letter means the
whole document was reissued. A separate, smaller update is a Change: "Change 1" or "CHG 2"
amends specific pages of the current edition without a new revision letter. A document can
also be Cancelled, with or without a successor. AC 00-6A was cancelled but a successor,
AC 00-6B, exists, so the family continues. AC 00-2, the old master checklist of all ACs,
was cancelled with no successor document at all: the Dynamic Regulatory System replaced it
as a search tool, not as a new circular. The habit to build: before relying on an AC,
check the FAA AC portal or DRS for the current revision letter and confirm the document
has not been cancelled.

## Where to find it

The FAA Advisory Circulars portal at `faa.gov/regulations_policies/advisory_circulars` is
the searchable, current list, organized by number. The Dynamic Regulatory System at
`drs.faa.gov` is the FAA-wide search tool and the modern replacement for the cancelled
AC 00-2 master checklist; it searches across ACs, Orders, and other document types at
once. Individual ACs are served as PDFs from the FAA document library; a direct link
follows the flat pattern `faa.gov/documentLibrary/media/Advisory_Circular/AC_00-45H.pdf`,
so a URL of that shape is a direct-to-PDF link to a specific AC.

## How it relates to the others

The AC sits one layer out from 14 CFR:

- It explains and shows compliance with a **14 CFR** section. The rule is the obligation;
  the AC is the worked method.
- It often points the reader to a **FAA handbook** for training-depth treatment of the
  same subject, and to the **AIM** for the operational procedures.
- Equipment-related ACs cross-reference **Technical Standard Orders**, since a TSO sets
  the performance standard an article must meet.

When you find a CFR rule that is terse and you want to know "how do I actually satisfy
this," the AC is the next stop.

## Common gotchas

- An AC is not a regulation. Following it is one way to comply; it is not the only way and
  it is not legally mandatory.
- Treating an AC as law over-constrains you. The rule permits whatever the rule permits,
  not only what the AC illustrates.
- The revision letter is part of the document's identity. Citing "AC 00-45" without the
  letter is ambiguous about which edition you mean.
- A cancelled AC can still be informative history, but it no longer represents current FAA
  position. Always confirm the document is current.
- There is no single browsable master list anymore. AC 00-2 was the index and it is gone;
  use DRS search or the AC portal.

## Related families

- [14-cfr](../14-cfr/page.md) - the binding rules that Advisory Circulars show acceptable means of complying with.
- [faa-handbooks](../faa-handbooks/page.md) - the training-depth references an AC often points to for fuller treatment.
- [technical-standard-orders](../technical-standard-orders/page.md) - the equipment performance standards equipment-related ACs cross-reference.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where advisory guidance sits in the family map.
- [The AC numbering system](../../../knowledge/regulations/ac-numbering-system/node.md) - predicting an AC's subject from its number.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - parsing an AC number, series, and revision letter.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - walking from a CFR rule to its supporting AC.
</content>

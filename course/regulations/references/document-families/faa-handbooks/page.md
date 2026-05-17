---
id: faa-doc-faa-handbooks
title: FAA Handbooks
family_code: FAA-H
binding: advisory
issuer: 'FAA (Flight Standards Service / Airman Testing Standards Branch), with subject-matter offices'
update_cadence: 'Per-document: each handbook is reissued as a new edition; editions are years apart, not on a fixed cycle'
status: draft
authoritative_sources:
  - source: 'FAA Handbooks and Manuals'
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation'
    note: 'The FAA-hosted index of current pilot and aviation handbooks, each served as a PDF.'
    verified: true
  - source: 'AC 00-45H, Aviation Weather Services'
    url: 'https://www.faa.gov/regulations_policies/advisory_circulars'
    note: 'Example of a handbook-grade reference issued in the AC system; cross-listed because weather guidance spans both families.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-cross-reference-triangulation
related_families:
  - aim
  - advisory-circulars
  - airman-certification-standards
---

# FAA Handbooks

> The training-depth references: the books that teach a subject in full, the way a textbook does. PHAK, AFH, IFH, the Aviation Weather Handbook, and others. Advisory.

## What it is

The FAA handbooks are the agency's training textbooks. Where the AIM tells you the
procedure and 14 CFR states the rule, a handbook explains the subject in depth, with the
background, the diagrams, and the worked reasoning a learner needs to actually understand
it. The core pilot handbooks a private, instrument, or commercial student meets are:

| Handbook                                   | Common name | FAA number    |
| ------------------------------------------ | ----------- | ------------- |
| Pilot's Handbook of Aeronautical Knowledge | PHAK        | FAA-H-8083-25 |
| Airplane Flying Handbook                   | AFH         | FAA-H-8083-3  |
| Instrument Flying Handbook                 | IFH         | FAA-H-8083-15 |
| Instrument Procedures Handbook             | IPH         | FAA-H-8083-16 |
| Aviation Weather Handbook                  | AWH         | FAA-H-8083-28 |
| Weight and Balance Handbook                |             | FAA-H-8083-1  |

The family is larger than this list (there are handbooks for helicopters, gliders,
balloons, aviation maintenance, and more), but these are the ones the typical
fixed-wing pilot studies. Each is a full reference book, organized into chapters.

## Binding or advisory

Advisory. A handbook is a teaching reference, not a rule and not a procedure mandate.
Nothing in PHAK or the AFH is enforceable in itself. Their authority is pedagogical: they
are the FAA-published explanation of a subject, and the Airman Certification Standards
point at specific handbook chapters as the source material for assessed knowledge. So a
handbook does not bind you, but it is the FAA's own answer to "where do I learn this," and
what it teaches is what the checkride expects you to know.

## How it is identified

A handbook is identified by an FAA document number of the form `FAA-H-NNNN-NN`, often with
a revision letter, and chapters within it are cited by chapter (and sometimes section)
number:

```text
FAA-H-8083-25B, Chapter 12
|     | |    | |          |
|     | |    | |          +-- chapter 12 within the handbook
|     | |    | +------------- revision letter B
|     | |    +--------------- sequence number 25
|     | +-------------------- series 8083 (airman training handbooks)
|     +---------------------- "H" -- handbook
+---------------------------- issuing authority "FAA"
```

The `8083` series is the airman training handbooks specifically. The `-25` identifies PHAK
within that series; the trailing letter is the edition. As always, the number locates the
book and the title ("Pilot's Handbook of Aeronautical Knowledge") describes it. Many
pilots only ever use the common name, but the FAA-H number is the unambiguous identifier
and the one a citation should carry.

## Revisions and currency

Handbooks are reissued as whole new editions, identified by the revision letter on the
FAA-H number. Editions are not on a fixed calendar; a handbook is updated when the subject
has moved enough to warrant it, which can be several years. Because a handbook can be a
decade old, currency matters: an older edition may predate an airspace change, an
equipment change, or a revised procedure. The Aviation Weather Handbook (FAA-H-8083-28) is
itself a relatively recent consolidation that pulled together material previously spread
across several older weather publications. To confirm currency, download the handbook from
the FAA handbooks index, which serves the current edition, and check the edition letter
and date on the title page.

## Where to find it

The FAA handbooks index at `faa.gov/regulations_policies/handbooks_manuals/aviation`
lists every current pilot and aviation handbook, each served as a free PDF. A direct link
follows the FAA document library pattern, for example
`faa.gov/.../handbooks_manuals/aviation/phak/`. The handbooks are free from the FAA;
commercial reprints exist but the faa.gov PDF is the authoritative current copy.

## How it relates to the others

The handbooks are the training-depth layer of the ecosystem:

- They explain, in depth, the subjects that **14 CFR** regulates and the **AIM** turns
  into procedure.
- They overlap with the **Advisory Circulars**: some subjects are covered by a handbook,
  some by an AC, and weather in particular spans both (the Aviation Weather Handbook
  FAA-H-8083-28 and the AC 00-45 series both treat aviation weather).
- The **Airman Certification Standards** cite specific handbook chapters as the reference
  for assessed knowledge elements, which makes the handbooks the study source the ACS
  points to.

When the question is "I need to truly understand this, not just look up the rule," the
handbook is the family to open.

## Common gotchas

- A handbook is not a regulation and not a procedures mandate. It teaches; it does not
  compel.
- Editions can be many years apart. An old handbook can describe superseded airspace,
  equipment, or procedure. Check the edition date.
- The common name and the FAA-H number both circulate. "PHAK" and "FAA-H-8083-25" are the
  same book; the number is the precise citation.
- Weather guidance is split across families. If a weather topic is not in the Aviation
  Weather Handbook, check the AC 00-45 series, and vice versa.
- Some retired handbooks were folded into newer consolidations. An old weather handbook
  reference may now point into FAA-H-8083-28.

## Related families

- [aim](../aim/page.md) - the operational-procedure layer the handbooks teach the depth behind.
- [advisory-circulars](../advisory-circulars/page.md) - the guidance family that overlaps the handbooks, weather especially.
- [airman-certification-standards](../airman-certification-standards/page.md) - the standard that cites specific handbook chapters as assessed knowledge sources.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where the training-depth layer sits in the family map.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - dropping into a handbook chapter for the depth behind a rule.
</content>

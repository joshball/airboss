---
id: faa-doc-airman-certification-standards
title: Airman Certification Standards
family_code: ACS
binding: advisory
issuer: 'FAA (Flight Standards Service, Airman Testing Standards Branch)'
update_cadence: 'Per-document: each ACS carries a revision designation and an effective date; reissued as standards change'
status: draft
authoritative_sources:
  - source: 'FAA Airman Certification Standards and Test Information'
    url: 'https://www.faa.gov/training_testing/testing/acs'
    note: 'The FAA-hosted home for every current ACS and the test information that supports it.'
    verified: true
  - source: 'FAA training and testing portal'
    url: 'https://www.faa.gov/training_testing'
    note: 'The broader hub for airman knowledge tests, practical tests, and the standards behind them.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-cross-reference-triangulation
related_families:
  - 14-cfr
  - faa-handbooks
  - advisory-circulars
---

# Airman Certification Standards

> The document that says exactly what a checkride tests, task by task: the knowledge, the risk management, and the flying skill required for a certificate or rating. It replaced the older PTS.

## What it is

The Airman Certification Standards is the FAA's statement of what an applicant must know,
consider, and be able to do to pass a knowledge test and a practical test for a given
certificate or rating. There is an ACS for the private pilot, the instrument rating, the
commercial pilot, and so on. Each ACS is organized into Areas of Operation, and each Area
breaks into Tasks. Every Task lists, in three parallel columns, the Knowledge elements,
the Risk Management elements, and the Skill elements an examiner will assess, each tagged
with a code. The ACS replaced the older Practical Test Standards (PTS): the PTS covered
skill and a thinner set of knowledge; the ACS integrates knowledge, risk management, and
skill into one structure and ties each element back to the regulations and reference
handbooks. An applicant studying for a checkride is studying the relevant ACS.

## Binding or advisory

Advisory in the regulatory sense: the ACS is not a 14 CFR section and you cannot be
"violated" for an ACS element. But it is the operative standard for a very specific
event. The legal requirement to hold a certificate lives in 14 CFR Part 61; the ACS is the
detailed standard the FAA's designated examiner uses to decide whether you meet that Part
61 requirement. So the ACS does not bind you in flight the way a rule does, yet it
completely governs the checkride. The clean way to hold it: Part 61 says you must pass a
practical test; the ACS defines what passing that practical test means.

## How it is identified

An ACS is identified two ways: by its FAA document number and by its internal element
codes. The document carries a designation such as "FAA-S-ACS-6" for the Private Pilot
Airplane ACS, with a revision letter. Inside the document, every assessed element has a
code that pins it to an Area of Operation, a Task, and the element type. A code like
`PA.I.A.K1` reads as:

```text
PA.I.A.K1
|  | | | |
|  | | | +-- element 1
|  | | +---- type K (Knowledge); R = Risk Management, S = Skill
|  | +------ Task A within the Area
|  +-------- Area of Operation I
+----------- ACS code PA (Private Pilot - Airplane)
```

This coding is what lets a study product, a knowledge node, or a lesson plan map a piece
of content directly to the exact thing a checkride will test.

## Revisions and currency

Each ACS carries an effective date and a revision designation, and the FAA reissues an ACS
when the standard changes (new tasks, retitled areas, updated references). A change to the
ACS changes what your checkride covers, so currency is not optional here. To confirm you
have the current standard, download the ACS for your certificate from the FAA ACS page,
which always serves the current revision, and check the effective date. Studying an
out-of-date ACS means studying to the wrong target.

## Where to find it

Every current ACS is hosted on the FAA's Airman Certification Standards page at
`faa.gov/training_testing/testing/acs`, served as a PDF per certificate or rating, along
with the test information that supports it. The broader training and testing portal at
`faa.gov/training_testing` carries the knowledge-test and practical-test material around
it.

## How it relates to the others

The ACS sits at the "what the checkride tests" end of the cross-reference chain:

- It implements a **14 CFR Part 61** requirement: Part 61 says a practical test is
  required; the ACS defines that test.
- Each ACS element references the **FAA handbooks** and **Advisory Circulars** that teach
  the underlying knowledge, so the ACS doubles as a study map: it tells you which handbook
  chapter answers which assessed element.
- When you triangulate a topic across the ecosystem, the ACS is the family that answers
  "and how will I be examined on this."

## Common gotchas

- The ACS is not a regulation. You are not violated for an ACS element. It governs the
  checkride, not flight operations.
- The ACS replaced the PTS. A study guide built around the old PTS misses the integrated
  risk-management elements the ACS added.
- There is a separate ACS per certificate and category. The Private Pilot Airplane ACS is
  not the Private Pilot Rotorcraft ACS.
- ACS element codes are document-specific. `PA.I.A.K1` is meaningful only within the
  Private Pilot Airplane ACS.
- An out-of-date ACS sends you to the wrong study target. Confirm the effective date.

## Related families

- [14-cfr](../14-cfr/page.md) - the Part 61 certification requirement the ACS defines the practical test for.
- [faa-handbooks](../faa-handbooks/page.md) - the training references each ACS element points to for the underlying knowledge.
- [advisory-circulars](../advisory-circulars/page.md) - additional guidance the ACS references for assessed elements.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where the checkride-standard layer sits in the family map.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - walking a topic out to the ACS task that examines it.
</content>

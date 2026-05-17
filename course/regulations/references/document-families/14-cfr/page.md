---
id: faa-doc-14-cfr
title: Title 14, Code of Federal Regulations
family_code: 14 CFR
binding: regulatory
issuer: 'United States Congress (statutory authority) and the FAA (rulemaking), codified by the Office of the Federal Register'
update_cadence: 'Continuous: amended rule by rule through notice-and-comment rulemaking; the eCFR reflects changes within days'
status: draft
authoritative_sources:
  - source: 'eCFR, Title 14 (Aeronautics and Space)'
    url: 'https://www.ecfr.gov/current/title-14'
    note: 'The continuously updated, legally accurate working copy of the regulations. The version to read day to day.'
    verified: true
  - source: 'Federal Register'
    url: 'https://www.federalregister.gov/agencies/federal-aviation-administration'
    note: 'Where every rule change is proposed (NPRM) and finalized. The audit trail behind each amendment to 14 CFR.'
    verified: true
  - source: 'FAA regulations and policies portal'
    url: 'https://www.faa.gov/regulations_policies/faa_regulations'
    note: 'The FAA-hosted entry point to the regulations, with plain-language indexes by part.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
  - reg-faa-cross-reference-triangulation
related_families:
  - advisory-circulars
  - airworthiness-directives
  - orders-and-notices
---

# Title 14, Code of Federal Regulations

> The actual aviation law: the binding rules a pilot, mechanic, or operator can be violated for breaking. "FAR" is the colloquial name for the same thing.

## What it is

Title 14 of the Code of Federal Regulations is the body of federal aviation regulation.
Congress wrote the enabling statute; the FAA writes the detailed rules under that authority
through notice-and-comment rulemaking; the Office of the Federal Register codifies the
result into 14 CFR. When a pilot says "the FARs," they mean this. "FAR" (Federal Aviation
Regulations) is an informal label that predates the current codification scheme and is
still in everyday use, but the regulations are not published as a document called "the
FAR" anywhere. They are Title 14 of the CFR, organized into chapters, subchapters, parts,
subparts, and sections. The parts a pilot meets first are Part 1 (definitions), Part 61
(certification of pilots and instructors), Part 91 (general operating and flight rules),
Part 141 (pilot schools), and Part 135 (commuter and on-demand operations).

## Binding or advisory

Binding, without qualification. This is the load-bearing fact about 14 CFR: a section of
Title 14 is law. A pilot who operates contrary to a 14 CFR section can be subject to a
certificate action or a civil penalty. There is no "one acceptable means" softness here.
Where an Advisory Circular says "here is a way to satisfy the rule," the rule itself is
the thing you must satisfy. If you confuse the two, you either treat advisory guidance as
mandatory (over-constraining yourself) or treat a binding section as optional
(under-constraining, and exposed). When in doubt, the question to ask is: "is this a CFR
section, or guidance about a CFR section?" Only the first compels you.

## How it is identified

A 14 CFR citation pulls apart cleanly. Take `14 CFR 91.103(a)(2)`:

```text
14 CFR 91.103(a)(2)
|  |   |  |   |  |
|  |   |  |   |  +-- subparagraph (2)
|  |   |  |   +----- paragraph (a)
|  |   |  +--------- section 103
|  |   +------------ part 91
|  +---------------- "CFR" -- Code of Federal Regulations
+------------------- title 14 -- Aeronautics and Space
```

Read it as: Title 14, part 91, section 103, paragraph (a), subparagraph (2). The section
number's leading digits repeat the part number, so `91.103` is always inside Part 91 and
`61.51` is always inside Part 61. Sections nest into subparts (lettered groupings inside a
part), but the subpart letter is not part of the everyday citation. The identifier locates
the rule; it does not describe it. "14 CFR 91.103" is the address; "Preflight action" is
the title. Both matter, but only the address is unambiguous.

## Revisions and currency

14 CFR does not revise as whole editions. It changes one rule at a time. Each amendment is
proposed in the Federal Register as a Notice of Proposed Rulemaking (NPRM), opened for
public comment, then issued as a Final Rule with an effective date. The eCFR (Electronic
Code of Federal Regulations) is the continuously updated working copy and reflects each
amendment within a few days of its effective date. The annually printed CFR volumes are a
snapshot and go stale the moment the next rule is finalized. To confirm currency, read the
section in the eCFR and check the "amendment" history shown for that part. Never rely on a
printed FAR/AIM book or a PDF for a date-sensitive regulatory question without confirming
against the eCFR.

## Where to find it

The canonical, legally accurate working copy is the eCFR at `ecfr.gov`. Title 14 lives at
`https://www.ecfr.gov/current/title-14`, and an individual section has a stable deep link,
for example `https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/section-91.103`.
The FAA's own portal at `faa.gov/regulations_policies/faa_regulations` indexes the parts
with plain-language summaries and links back to the eCFR. The Federal Register at
`federalregister.gov` carries the rulemaking record: the NPRM, the comments, and the Final
Rule behind every amendment.

## How it relates to the others

14 CFR is the anchor of the whole ecosystem. Every other family either implements it,
explains it, or operates around it:

- An **Advisory Circular** shows one acceptable means of complying with a CFR section. AC
  61-65 is guidance about Part 61; the rule still lives in Part 61.
- An **Airworthiness Directive** is issued under the authority of 14 CFR Part 39 and is
  itself binding, but it targets a specific aircraft or article rather than stating a
  general rule.
- **FAA Orders** direct FAA inspectors in how to administer and enforce 14 CFR.
- The **AIM** and the **FAA handbooks** explain how to operate within the rules but do not
  themselves carry regulatory force.

When you need to know what is *required*, you end up in 14 CFR. Everything else tells you
how to satisfy it, how it is enforced, or how to operate well inside it.

## Common gotchas

- "FAR" and "14 CFR" are the same thing. "FAR" also stands for the Federal Acquisition
  Regulation in government contracting, which is why the FAA's own writing prefers "14
  CFR."
- A printed FAR/AIM book is a snapshot. It can be months stale. For any date-sensitive
  question, confirm against the eCFR.
- An Advisory Circular is not the rule. Doing what an AC says is *a* way to comply; the
  legal obligation is the CFR section the AC supports.
- Section numbers repeat the part number, so `91.3` and `61.3` are different sections in
  different parts. Always carry the part number.
- "FAR Part 23" style references to airworthiness standards describe the certification
  basis of an aircraft; a pilot rarely operates under Part 23 directly but the airplane
  was certified to it.

## Related families

- [advisory-circulars](../advisory-circulars/page.md) - the guidance layer that shows acceptable means of complying with these rules.
- [airworthiness-directives](../airworthiness-directives/page.md) - binding corrective actions issued under the authority of 14 CFR Part 39.
- [orders-and-notices](../orders-and-notices/page.md) - the internal FAA direction for administering and enforcing these rules.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where binding rules sit in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - how to read a 14 CFR section, paragraph, and subparagraph citation.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - walking a question from a CFR rule out to its supporting guidance.
</content>

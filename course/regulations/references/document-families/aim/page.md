---
id: faa-doc-aim
title: Aeronautical Information Manual
family_code: AIM
binding: advisory
issuer: 'FAA (Mission Support Services / Aeronautical Information Services), published with the support of Flight Standards'
update_cadence: 'Reissued on a fixed cycle, historically about twice a year, with change pages between full editions'
status: draft
authoritative_sources:
  - source: 'FAA Aeronautical Information Manual'
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html'
    note: 'The official online AIM, chapter by chapter, in the current edition.'
    verified: true
  - source: 'FAA air traffic publications portal'
    url: 'https://www.faa.gov/air_traffic/publications'
    note: 'The hub for the AIM, the Pilot/Controller Glossary, and the Order JO 7110.65 controller handbook.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
  - reg-faa-cross-reference-triangulation
related_families:
  - pilot-controller-glossary
  - 14-cfr
  - faa-handbooks
  - chart-supplements
---

# Aeronautical Information Manual

> The FAA's operational how-to: the procedures, phraseology, and good-practice guidance for flying in the National Airspace System. Advisory, not regulatory.

## What it is

The Aeronautical Information Manual is the FAA's official guide to the procedures and
practices of flying in United States airspace. Where 14 CFR states the rules, the AIM
tells you how to operate within them: how to fly a traffic pattern, how to read an
approach, how to talk to ATC, how to use the airspace classes, what wake turbulence and
icing and hypoxia do to you and how to manage them. It is written for pilots, in pilot
language, and it is organized into numbered chapters, sections, and paragraphs. The AIM is
the document a pilot opens to answer "how is this actually done," as distinct from "what
is required" (14 CFR) or "how does this work in depth" (an FAA handbook).

## Binding or advisory

Advisory. The AIM describes recommended procedures and good operating practice. It is not
regulatory in itself, and the FAA states this directly in the manual's own preface. That
said, the AIM is not optional reading: many of the procedures it describes are the
operational expression of a 14 CFR rule, and deviating from an AIM procedure can put you
in conflict with the regulation the procedure implements, or simply make you unpredictable
to ATC and other traffic. The distinction to hold: the AIM tells you the FAA-recommended
way; the legal obligation, where there is one, lives in the CFR section behind it. Treat
the AIM as the standard of practice, and read the regulation when you need to know what is
strictly required.

## How it is identified

An AIM citation is a chapter-section-paragraph triple. Take `AIM 7-1-6`:

```text
AIM 7-1-6
|   | | |
|   | | +-- paragraph 6
|   | +---- section 1
|   +------ chapter 7
+---------- "AIM"
```

Read it as: AIM, chapter 7, section 1, paragraph 6. Chapter 7 is "Safety of Flight,"
section 1 is "Meteorology," and paragraph 6 within it is a specific topic. Some references
add a sub-paragraph in lower-case letters, for example `7-1-6 a`. The numbering is stable
within an edition, which is why a course or a knowledge node can deep-link to an AIM
paragraph. As with every FAA document, the identifier (`7-1-6`) locates the content and
the title ("Categorical Outlooks," in this example) describes it.

## Revisions and currency

The AIM is reissued as whole editions on a fixed cycle, historically roughly twice a year,
and the FAA also publishes change pages between full editions. Each edition carries an
effective date and a change record up front. Because the AIM tracks live procedures and
airspace practice, a stale edition can describe a procedure that has since changed. To
confirm currency, use the online AIM at faa.gov, which always serves the current edition,
and check the edition date and change list at the front of the manual. A printed FAR/AIM
book is a snapshot of one edition and should be cross-checked for anything procedure-
sensitive.

## Where to find it

The official online AIM lives at `faa.gov/air_traffic/publications/atpubs/aim_html`,
served chapter by chapter in the current edition. The broader air traffic publications
hub at `faa.gov/air_traffic/publications` carries the AIM alongside the Pilot/Controller
Glossary and the controller handbook Order JO 7110.65. The AIM is also bundled with 14 CFR
in the commercially printed "FAR/AIM" books, but the faa.gov copy is the authoritative,
current one.

## How it relates to the others

The AIM is the operational-procedure layer of the ecosystem:

- It implements **14 CFR** rules as flyable procedures. The CFR says you must do X; the
  AIM shows the FAA-recommended way to do X.
- It shares its vocabulary with the **Pilot/Controller Glossary**: a term used in the AIM
  and a term used on the radio are defined in the same place, so the P/CG and the AIM are
  read together.
- It hands off to the **FAA handbooks** for training-depth treatment of a subject the AIM
  covers briefly.
- It points to the **Chart Supplement** and the charts for the airport- and airspace-
  specific data behind a procedure.

When the question is "how do I actually do this in the airplane," the AIM is the answer;
when it is "what am I legally required to do," follow the AIM's reference back to 14 CFR.

## Common gotchas

- The AIM is not a regulation. It describes recommended procedure; the binding rule, where
  there is one, lives in 14 CFR.
- "Not regulatory" does not mean "ignore it." Deviating from an AIM procedure can still
  put you in conflict with the rule it implements and makes you unpredictable in the
  system.
- A printed FAR/AIM is a single edition and goes stale. For procedure-sensitive questions,
  use the online AIM and check the edition date.
- The AIM and the Pilot/Controller Glossary are different documents that travel together.
  A precise definition of a term used in the AIM is in the P/CG.
- The AIM is United States procedure. International operations follow ICAO documents and
  the relevant State's equivalent of the AIM.

## Related families

- [pilot-controller-glossary](../pilot-controller-glossary/page.md) - the shared vocabulary that backs the AIM and ATC phraseology.
- [14-cfr](../14-cfr/page.md) - the binding rules the AIM's procedures implement.
- [faa-handbooks](../faa-handbooks/page.md) - the training-depth references the AIM hands off to.
- [chart-supplements](../chart-supplements/page.md) - the airport and facility data behind an AIM procedure.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where the operational-how-to layer sits in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - reading an AIM chapter-section-paragraph citation.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - walking from a CFR rule to the AIM procedure that implements it.
</content>

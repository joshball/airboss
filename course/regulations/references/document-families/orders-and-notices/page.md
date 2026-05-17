---
id: faa-doc-orders-and-notices
title: FAA Orders and Notices
family_code: Order / N
binding: advisory
issuer: 'FAA (the issuing line of business or office; for example Air Traffic Organization, Flight Standards)'
update_cadence: 'Per-document: Orders carry change pages and are reissued by edition; Notices are short-lived and expire'
status: draft
authoritative_sources:
  - source: 'Dynamic Regulatory System (DRS)'
    url: 'https://drs.faa.gov'
    note: 'The FAA-wide search tool that indexes Orders and Notices across the agency. The practical way to find an Order.'
    verified: true
  - source: 'FAA Order JO 7110.65, Air Traffic Control'
    url: 'https://www.faa.gov/air_traffic/publications'
    note: 'The controller handbook, hosted with the AIM and P/CG on the air traffic publications portal.'
    verified: true
  - source: 'FAA orders and notices index'
    url: 'https://www.faa.gov/regulations_policies/orders_notices'
    note: 'The FAA-hosted listing of current Orders and Notices by number.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
  - reg-faa-cross-reference-triangulation
related_families:
  - 14-cfr
  - aim
  - pilot-controller-glossary
---

# FAA Orders and Notices

> The FAA's internal direction: how the agency tells its own offices and inspectors to do their jobs. An Order binds the FAA, not the pilot directly.

## What it is

An FAA Order is a directive that the FAA issues to itself. It tells an FAA line of
business, an office, or a class of FAA employees how to carry out a function. Two Orders a
pilot hears about constantly are Order JO 7110.65, the air traffic control handbook that
tells controllers exactly how to separate and instruct traffic, and Order 8900.1, the
Flight Standards Information Management System that tells aviation safety inspectors how to
conduct surveillance, certification, and enforcement. A Notice is the short-lived sibling
of an Order: an interim directive that conveys a change or an instruction for a limited
time, after which it expires or is folded into an Order. Together, Orders and Notices are
the internal operating instructions of the agency.

## Binding or advisory

This family needs a careful answer. An Order is binding on the FAA: a controller is
required to follow JO 7110.65, and an inspector is required to follow 8900.1. But an Order
does not directly regulate a pilot. A pilot is not violated for an 8900.1 paragraph,
because 8900.1 is not addressed to the pilot. In the scheme this course uses, an Order is
filed as advisory *to the pilot*, with the important caveat that it binds the agency. The
practical value to a pilot is indirect and large: reading JO 7110.65 tells you what a
controller is required to do, which tells you what to expect on the radio and where the
controller has no discretion. So the Order does not compel you, but it tells you the rules
the other side of the conversation is playing by.

## How it is identified

An Order is identified by a number, often with a `JO` prefix for a "joint Order" issued by
the Air Traffic Organization, and a subject number:

```text
Order JO 7110.65, paragraph 2-1-6
|     |  |       |           |
|     |  |       |           +-- chapter-section-paragraph within the Order
|     |  |       +-------------- "65" -- the specific Order in the series
|     |  +---------------------- subject number 7110
|     +------------------------- "JO" -- joint Order (Air Traffic Organization)
+------------------------------- document type "Order"
```

Inside an Order, content is cited by a chapter-section-paragraph number much like the AIM.
A Notice carries an `N` designation and a subject number, for example `N JO 7110.xxx`. A
"CHG" suffix on an Order indicates a change package amending specific pages of the current
edition.

## Revisions and currency

Orders are maintained through change pages and reissued as new editions; each Order's
front matter records its change history. JO 7110.65 in particular is updated frequently
because ATC procedures evolve. Notices are inherently temporary: a Notice carries an
expiration date and either lapses or is incorporated into a permanent Order. To confirm
currency, search the Order in DRS or the FAA orders index, check the edition and change
number, and for a Notice check that it has not expired.

## Where to find it

The Dynamic Regulatory System at `drs.faa.gov` is the practical search tool for Orders and
Notices across the whole agency. The FAA orders and notices index at
`faa.gov/regulations_policies/orders_notices` lists them by number. Order JO 7110.65, the
controller handbook, is published on the air traffic publications portal at
`faa.gov/air_traffic/publications` alongside the AIM and the Pilot/Controller Glossary,
because a pilot studying ATC expectations reads all three together.

## How it relates to the others

Orders sit on the "internal direction" side of the ecosystem:

- They tell FAA staff how to administer **14 CFR**. Order 8900.1 is how an inspector
  applies the regulations a pilot must follow.
- Order JO 7110.65 is the controller-side mirror of the **AIM**: the AIM tells the pilot
  the recommended procedure, JO 7110.65 tells the controller the required procedure, and
  the two share the **Pilot/Controller Glossary** for vocabulary.
- Reading the relevant Order is how a pilot learns what the FAA, not the pilot, is
  obligated to do.

## Common gotchas

- An Order binds the FAA, not the pilot. You are not violated for an Order paragraph.
- An Order is still worth reading: it tells you what a controller or inspector is required
  to do, which is exactly what to expect from them.
- A Notice is temporary. Always check whether a Notice has expired before relying on it.
- JO 7110.65 is the controller's required procedure; the AIM is the pilot's recommended
  procedure. They are companions, not duplicates.
- There is no single browsable map of all Orders. Use DRS search or the FAA orders index.

## Related families

- [14-cfr](../14-cfr/page.md) - the binding rules that Orders direct FAA staff to administer and enforce.
- [aim](../aim/page.md) - the pilot-side procedure manual that mirrors the controller handbook JO 7110.65.
- [pilot-controller-glossary](../pilot-controller-glossary/page.md) - the shared vocabulary JO 7110.65 and the AIM both use.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where internal FAA direction sits in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - reading an Order number and an internal paragraph citation.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - using an Order to learn the controller-side or inspector-side of a question.
</content>

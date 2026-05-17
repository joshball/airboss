---
id: faa-doc-technical-standard-orders
title: Technical Standard Orders
family_code: TSO
binding: advisory
issuer: 'FAA (Aircraft Certification Service)'
update_cadence: 'Per-document: each TSO carries a revision letter; reissued as the minimum performance standard is updated'
status: draft
authoritative_sources:
  - source: 'FAA Technical Standard Orders'
    url: 'https://www.faa.gov/aircraft/air_cert/design_approvals/tso'
    note: 'The FAA-hosted home for the TSO program and the searchable list of current TSOs.'
    verified: true
  - source: '14 CFR Part 21, Subpart O -- Technical Standard Order Approvals'
    url: 'https://www.ecfr.gov/current/title-14/part-21'
    note: 'The regulation that establishes the TSO authorization process. The binding rule behind the TSO program.'
    verified: true
  - source: 'Dynamic Regulatory System (DRS)'
    url: 'https://drs.faa.gov'
    note: 'FAA-wide search that indexes TSOs alongside ACs and Orders.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
related_families:
  - 14-cfr
  - advisory-circulars
  - airworthiness-directives
---

# Technical Standard Orders

> The minimum performance standard an article of equipment must meet. A TSO is a spec sheet for a part, not a rule for a pilot.

## What it is

A Technical Standard Order is a minimum performance standard issued by the FAA for a
specified article: an instrument, an avionics box, a seat, a life preserver, a navigation
receiver. The TSO says what the article has to do and how well it has to do it. When a
manufacturer designs a part to a TSO and the FAA grants a TSO authorization (TSOA), the
manufacturer may produce and mark that article as TSO-approved. The TSO family is how the
FAA standardizes the equipment that goes into aircraft without certifying every part from
scratch each time. TSOs are administered by the Aircraft Certification Service. For a
pilot, a TSO is most often encountered as a marking on equipment or a line in an
equipment list, for example a GPS receiver approved under a specific TSO-C number.

## Binding or advisory

This one rewards precision. A TSO itself is a standard, and in the regulatory scheme it is
advisory in the sense that it does not impose a duty on a pilot. The TSO program, however,
sits on a binding rule: 14 CFR Part 21 Subpart O establishes TSO authorizations, and a
manufacturer that wants to mark an article as TSO-approved must meet the TSO. So the TSO
binds the manufacturer's article, not the pilot's conduct. Where a pilot does meet a
binding consequence is when an operating rule requires TSO-approved equipment for a given
operation: then the rule (a 14 CFR section) is the obligation, and the TSO is the spec the
required equipment must satisfy. The TSO does not compel you to fly a certain way; it
defines what "approved equipment" means when a rule asks for it.

## How it is identified

A TSO is identified by a `TSO-C` number with a revision letter:

```text
TSO-C145e
|   ||  |
|   ||  +-- revision letter e
|   |+----- article number 145 within the C series
|   +------ class "C" (the principal TSO class for civil aircraft articles)
+---------- document type "TSO"
```

`TSO-C145` covers a particular class of GPS/SBAS navigation equipment, and the trailing
`e` is the edition of that standard. The "C" is the main TSO designation series for civil
aircraft equipment. As with every FAA document, the number identifies the standard and the
title describes the article class it covers. Equipment markings, avionics manuals, and
aircraft equipment lists cite the TSO number so a reader can confirm an article meets a
specific standard.

## Revisions and currency

A TSO is revised by appending a letter, so `TSO-C145d` and `TSO-C145e` are successive
editions of the same standard. A revision usually reflects a tightened or updated
performance requirement. Articles approved under an earlier revision generally remain
approved under the terms of that revision; a new revision applies to new authorizations.
To confirm currency, check the FAA TSO list or DRS for the current revision letter of the
TSO in question, and confirm which revision a given article was actually approved to,
because that determines what the article is certified to do.

## Where to find it

The FAA TSO program home is at `faa.gov/aircraft/air_cert/design_approvals/tso`, with the
searchable list of current TSOs. The Dynamic Regulatory System at `drs.faa.gov` indexes
TSOs alongside ACs and Orders. The binding rule behind the program, 14 CFR Part 21
Subpart O, is on the eCFR at `ecfr.gov/current/title-14/part-21`.

## How it relates to the others

The TSO sits in the equipment-standards corner of the ecosystem:

- It is authorized by **14 CFR Part 21**, the binding rule that creates the TSO process.
- An operating-rule section of **14 CFR** (a Part 91 equipment requirement, for example)
  can require TSO-approved equipment; then the rule is the obligation and the TSO is the
  spec.
- An **Advisory Circular** often accompanies a TSO, giving guidance on showing compliance
  with the standard.
- An **Airworthiness Directive** can target an article originally approved under a TSO
  when a defect in that article is found.

## Common gotchas

- A TSO is an equipment standard, not a pilot rule. It binds an article's design, not your
  conduct.
- "TSO'd" equipment is required only when an operating rule asks for it. The rule is the
  obligation; the TSO defines the spec.
- The revision letter matters: an article is approved to the TSO revision in effect when
  it was authorized, which may not be the latest revision.
- A TSO authorization (TSOA) is design and production approval for the article. It is not
  by itself installation approval in a specific aircraft; installation is a separate
  airworthiness step.

## Related families

- [14-cfr](../14-cfr/page.md) - Part 21 authorizes the TSO program, and operating rules can require TSO-approved equipment.
- [advisory-circulars](../advisory-circulars/page.md) - the guidance that accompanies a TSO on showing compliance.
- [airworthiness-directives](../airworthiness-directives/page.md) - the binding corrective action when a defect is found in a TSO-approved article.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where equipment standards sit in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - reading a TSO-C number and revision letter.
</content>

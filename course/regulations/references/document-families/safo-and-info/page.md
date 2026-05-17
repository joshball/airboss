---
id: faa-doc-safo-and-info
title: SAFOs and InFOs
family_code: SAFO / InFO
binding: advisory
issuer: 'FAA (Flight Standards Service)'
update_cadence: 'Continuous: each SAFO or InFO is issued as a numbered, dated item when the need arises; not on a cycle'
status: draft
authoritative_sources:
  - source: 'FAA Safety Alerts for Operators (SAFO)'
    url: 'https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/safo'
    note: 'The FAA-hosted index of current and archived SAFOs.'
    verified: true
  - source: 'FAA Information for Operators (InFO)'
    url: 'https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/info'
    note: 'The FAA-hosted index of current and archived InFOs.'
    verified: true
  - source: 'Dynamic Regulatory System (DRS)'
    url: 'https://drs.faa.gov'
    note: 'FAA-wide search that indexes SAFOs and InFOs alongside ACs, Orders, and other document types.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
related_families:
  - advisory-circulars
  - airworthiness-directives
  - orders-and-notices
---

# SAFOs and InFOs

> Two short FAA bulletins from Flight Standards. A SAFO flags a safety concern; an InFO shares operational information. Both are advisory, and both are quick reads.

## What it is

SAFOs and InFOs are the FAA's short-form way of getting a single message to the operator
community quickly. A SAFO, a Safety Alert for Operators, conveys important safety
information and, often, a recommended action: a hazard that has shown up, a procedure
worth reinforcing, a risk the FAA wants front of mind. An InFO, Information for Operators,
carries operational information that is valuable but does not rise to the safety-alert
level: a clarification, a reminder, an announcement of a resource. Both are issued by
Flight Standards, both are typically one to a few pages, and both are aimed primarily at
operators, training providers, and the broader aviation community. They are the bulletin
layer of the FAA's communication: faster and lighter than an Advisory Circular, never as
heavy as a rule.

## Binding or advisory

Advisory, both of them. A SAFO is a safety *alert*, not a regulation: it recommends, it
does not compel, and you cannot be violated for a SAFO. An InFO is even lighter, sharing
information with no mandatory weight at all. The distinction worth holding is intensity
within the advisory band: a SAFO is high-priority advisory (the FAA wants you to act on
it, and a SAFO can be a precursor to a future rule or AD if the concern grows), while an
InFO is ordinary-priority advisory. Neither one binds you. If the FAA needs to *require*
an action, it does not issue a SAFO; it issues an AD or amends a regulation. A SAFO that
you ignore is a risk you accepted, not a rule you broke.

## How it is identified

A SAFO and an InFO each carry a number that encodes the year and a sequence:

```text
SAFO 23010
|    | |
|    | +-- sequence number 010 within the year
|    +---- year 23 (2023)
+--------- document type "SAFO"
```

An InFO uses the identical pattern, for example `InFO 24005`. The two-digit year leads,
the sequence follows. Each item also carries a subject line and an issue date. The number
locates the bulletin; the subject line describes it. Because the format is short and
self-contained, a SAFO or InFO is usually read whole rather than cited by an internal
paragraph.

## Revisions and currency

SAFOs and InFOs are generally not revised in place. A bulletin is issued, and if the topic
needs updating the FAA issues a newer bulletin rather than amending the old one. Many
SAFOs and InFOs are also time-bound in their relevance: a SAFO about a seasonal hazard or a
specific event loses currency once the situation passes, even though the document stays in
the archive. To gauge currency, check the issue date and consider whether the underlying
situation still applies; for an active concern, search DRS for any later bulletin on the
same subject.

## Where to find it

SAFOs are indexed on the FAA site at
`faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/safo`, and InFOs at
the parallel `.../info` path. The Dynamic Regulatory System at `drs.faa.gov` searches both
alongside ACs, Orders, and the rest of the FAA document set, which is the easiest way to
find a bulletin on a given subject without knowing its number.

## How it relates to the others

SAFOs and InFOs are the fast, light end of FAA communication:

- A **SAFO** can be the early warning of a concern that later becomes an **Airworthiness
  Directive** or a rule change. SAFO and AD are the soft and hard ends of one safety-
  communication spectrum: advisory alert at one end, mandatory action at the other.
- An **Advisory Circular** is the heavier, more durable guidance document; a SAFO is the
  quick bulletin. A topic important enough to outlive a bulletin migrates into an AC.
- An **Order or Notice** directs FAA staff; a SAFO or InFO speaks outward to operators.

When you see a SAFO, the question to ask is "is this still just an alert, or has it
escalated into a rule or an AD." Checking that is the cross-reference skill.

## Common gotchas

- A SAFO is not a regulation. It alerts and recommends; it does not compel. You cannot be
  violated for a SAFO.
- A SAFO is still high-priority. Treat it as the FAA telling you a risk is real, and check
  whether it later escalated.
- An InFO is lighter still: information sharing, not a safety alert. Do not over-weight it.
- Many bulletins are time-bound. Check the issue date and whether the situation still
  applies.
- If the FAA needs to require something, it uses an AD or a rule, not a SAFO. A SAFO that
  reads like a mandate is still advisory.

## Related families

- [advisory-circulars](../advisory-circulars/page.md) - the heavier, durable guidance document a lasting topic migrates into.
- [airworthiness-directives](../airworthiness-directives/page.md) - the mandatory end of the safety-communication spectrum a SAFO can precede.
- [orders-and-notices](../orders-and-notices/page.md) - the internal-direction family, contrasted with bulletins that speak outward to operators.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where safety bulletins sit in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - reading a SAFO or InFO year-sequence number.
</content>

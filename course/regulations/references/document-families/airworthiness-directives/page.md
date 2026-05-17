---
id: faa-doc-airworthiness-directives
title: Airworthiness Directives
family_code: AD
binding: regulatory
issuer: 'FAA (Aircraft Certification Service), issued as legally binding rules'
update_cadence: 'Continuous: a new AD is issued whenever an unsafe condition is found; ADs are amended and superseded individually'
status: draft
authoritative_sources:
  - source: 'Dynamic Regulatory System (DRS)'
    url: 'https://drs.faa.gov'
    note: 'The FAA-wide search tool that replaced the legacy AD search; the practical way to find ADs applicable to a make and model.'
    verified: true
  - source: '14 CFR Part 39 -- Airworthiness Directives'
    url: 'https://www.ecfr.gov/current/title-14/part-39'
    note: 'The regulation that defines what an AD is and makes compliance mandatory. The binding authority for the whole family.'
    verified: true
  - source: 'Federal Register'
    url: 'https://www.federalregister.gov/agencies/federal-aviation-administration'
    note: 'Where ADs are published as rules; an AD is a Final Rule with a Federal Register record.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
related_families:
  - 14-cfr
  - technical-standard-orders
  - safo-and-info
---

# Airworthiness Directives

> A legally binding, mandatory corrective action on a specific aircraft, engine, propeller, or appliance with a known unsafe condition. An AD is a rule, and ignoring it grounds the aircraft.

## What it is

An Airworthiness Directive is the FAA's mechanism for correcting an unsafe condition once
that condition is identified in a type design already in service. When the FAA finds that
an unsafe condition exists in an aircraft, engine, propeller, or appliance and is likely to
exist or develop in others of the same type, it issues an AD. The AD identifies the
affected products, describes the unsafe condition, and prescribes the corrective action,
the inspection, or the operating limitation required, along with a compliance time. ADs
are issued by the Aircraft Certification Service. Unlike a general regulation, an AD is
narrow and specific: it names a make, model, and often a serial-number range or a part
number. The owner or operator is responsible for ensuring every applicable AD has been
complied with.

## Binding or advisory

Binding, fully and explicitly. This is the load-bearing fact about the AD family, and it
puts ADs alongside 14 CFR and NOTAMs as the mandatory documents a pilot deals with. An AD
is issued as a Final Rule and codified under 14 CFR Part 39, the regulation that defines
ADs and states plainly that no person may operate a product to which an AD applies except
in accordance with that AD. An aircraft with an overdue AD is not airworthy and may not be
flown. There is no "one acceptable means" softness: the AD prescribes the action and the
deadline, and compliance is the law. An alternative method of compliance (AMOC) can be
approved, but only by the FAA, in writing, against that specific AD.

## How it is identified

An AD number encodes the year and the issuance sequence:

```text
AD 2024-13-05
|  |    |  |
|  |    |  +-- sequence number 05 (the 5th AD in that biweekly batch)
|  |    +----- biweekly issue number 13
|  |    (the FAA issues ADs in biweekly batches)
|  +---------- year 2024
+------------- document type "AD"
```

So `AD 2024-13-05` is the fifth AD in the thirteenth biweekly batch of 2024. Each AD
identifies its applicability precisely (make, model, and often serial or part numbers) and
states an effective date and a compliance time. When a later AD replaces an earlier one,
the later AD is said to supersede it, and the superseded AD number is recorded. The number
locates the directive; the AD's subject line describes the unsafe condition it corrects.

## Revisions and currency

ADs are not revised by a letter. A new AD supersedes the old one outright, and the
superseding AD records the number it replaces. There can also be a correction to an AD or
an amendment to its applicability or compliance terms. Currency for an AD is not just
"which edition" but "have we complied": an owner must track every AD applicable to the
specific aircraft and confirm each has been actioned on time. The practical currency
check is a DRS search against the aircraft's make, model, and engine, comparing the result
against the aircraft's AD compliance record.

## Where to find it

The Dynamic Regulatory System at `drs.faa.gov` is the search tool for ADs; it replaced the
legacy AD database and lets you filter by make and model. Every AD is also published in
the Federal Register at `federalregister.gov` as a Final Rule, which is its formal legal
home. The defining regulation, 14 CFR Part 39, is on the eCFR at
`ecfr.gov/current/title-14/part-39`.

## How it relates to the others

The AD is the binding corner of the airworthiness ecosystem:

- It is issued under the authority of **14 CFR Part 39** and is itself a regulation, so it
  belongs in the same binding tier as the rest of 14 CFR.
- It can target an article originally approved under a **Technical Standard Order** when a
  defect is found in that article.
- It is the mandatory escalation of a safety concern. A **SAFO** is an advisory safety
  alert; when a condition is serious enough to require action by rule, an AD is the
  instrument. SAFO and AD are the soft and hard ends of the same safety-communication
  spectrum.

## Common gotchas

- An AD is mandatory. It is a rule, not guidance. An overdue AD makes the aircraft
  unairworthy.
- ADs apply to a specific product. Read the applicability block carefully: a serial-number
  range or a part number can put your aircraft in or out of scope.
- A new AD supersedes the old one; do not comply with a superseded AD and assume you are
  current. Find the latest AD on the product.
- An alternative method of compliance must be FAA-approved in writing against that AD. You
  cannot self-select an alternative.
- AD applicability can extend to engines, propellers, and appliances independently of the
  airframe. Search all of them.

## Related families

- [14-cfr](../14-cfr/page.md) - Part 39 defines ADs and makes compliance mandatory; an AD is itself a rule.
- [technical-standard-orders](../technical-standard-orders/page.md) - the equipment standard an AD can target when a defect is found in an approved article.
- [safo-and-info](../safo-and-info/page.md) - the advisory safety alert at the soft end of the same safety-communication spectrum.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where mandatory airworthiness action sits in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - reading an AD year-batch-sequence number.
</content>

---
id: faa-doc-chart-supplements
title: Chart Supplements
family_code: CS
binding: advisory
issuer: 'FAA (Aeronautical Information Services), the same office that produces the aeronautical charts'
update_cadence: 'Fixed 56-day cycle, aligned with the aeronautical chart change schedule'
status: draft
authoritative_sources:
  - source: 'FAA Chart Supplement'
    url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd'
    note: 'The FAA digital Chart Supplement, the authoritative current airport and facility data, on the 56-day cycle.'
    verified: true
  - source: 'FAA aeronautical charts and products'
    url: 'https://www.faa.gov/air_traffic/flight_info/aeronav'
    note: 'The Aeronautical Information Services hub for the Chart Supplement and the chart products it accompanies.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-cross-reference-triangulation
related_families:
  - notams
  - aim
  - 14-cfr
---

# Chart Supplements

> The book of airport and facility data: runway dimensions, frequencies, services, hazards, special procedures. Formerly the Airport/Facility Directory. Issued on a 56-day cycle.

## What it is

The Chart Supplement is the FAA's directory of detailed data on airports, heliports,
seaplane bases, and air navigation facilities. For each airport it gives the runway
lengths and surfaces, the lighting, the radio frequencies, the available services, the
field elevation, the traffic-pattern altitude, the airport diagram, remarks about
obstructions and noise-sensitive areas, and any special operating procedures. It is the
reference a pilot uses to plan the airport end of a flight: which runway, which frequency,
what services, what to watch for. The Chart Supplement was for decades called the
Airport/Facility Directory (the "A/FD"); the FAA renamed it to Chart Supplement, and many
pilots still use the old name. It is published as a set of regional volumes and, now,
digitally.

## Binding or advisory

Advisory. The Chart Supplement is reference data, not a regulation. The runway and
frequency information it carries is authoritative published data, but the document itself
imposes no duty. The binding does come in around it: 14 CFR 91.103 requires a pilot to be
familiar with all available information for a flight, and the Chart Supplement is part of
that information, so using it is part of meeting a rule. And the data it carries can have
regulatory weight in context (a runway length sets what you can legally operate from with
your performance numbers). But the family itself is advisory: it informs your planning, it
does not command your conduct.

## How it is identified

The Chart Supplement is not cited by an internal paragraph number the way the AIM is. It
is identified by its regional volume and its edition (the 56-day cycle date), and an entry
within it is located by the airport identifier:

```text
Chart Supplement, North Central volume, entry: KMSP
|                 |                          |
|                 |                          +-- airport identifier KMSP
|                 +----------------------------- regional volume (one of seven US volumes)
+----------------------------------------------- the publication name
```

A reader looks up an airport by its identifier in the correct regional volume for the
current 56-day cycle. The digital Chart Supplement is searchable directly by identifier.
The publication name and volume locate the data; the airport identifier is the access key
within it.

## Revisions and currency

The Chart Supplement is reissued on a fixed 56-day cycle, the same schedule the
aeronautical charts follow. Every 56 days a new edition supersedes the prior one, with
updated frequencies, runway data, and remarks. This makes currency simple to state and
easy to get wrong: a Chart Supplement is good for exactly one 56-day cycle, and an
expired volume can carry a superseded frequency or a closed runway as if it were current.
Confirm you are using the volume for the cycle that covers your flight date. And because
56 days is still a long time, anything that changed since the cycle began is communicated
by NOTAM, not by the Chart Supplement.

## Where to find it

The FAA digital Chart Supplement is at
`faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd`, served for the current
56-day cycle. The Aeronautical Information Services hub at
`faa.gov/air_traffic/flight_info/aeronav` carries the Chart Supplement together with the
sectional, terminal, and instrument chart products it accompanies. Printed regional
volumes are also published on the same cycle, and electronic flight bag apps deliver the
data digitally.

## How it relates to the others

The Chart Supplement is the published static data the live layers patch:

- It is paired with **NOTAMs**: the Chart Supplement gives the airport's data on the
  56-day cycle, and a NOTAM tells you what changed since the cycle started. Reading one
  without the other leaves a gap. The Chart Supplement is the baseline; the NOTAM is the
  patch.
- It supports planning under **14 CFR 91.103**, the preflight-action rule, by supplying
  the airport information a pilot must become familiar with.
- It complements the **AIM**: the AIM gives the general procedure, the Chart Supplement
  gives the airport-specific data the procedure is flown against.

## Common gotchas

- The Chart Supplement was the Airport/Facility Directory. Old training material and old
  pilots still say "A/FD"; it is the same publication, renamed.
- It is good for one 56-day cycle. An expired volume can carry a stale frequency or a
  closed runway. Confirm the cycle date.
- The Chart Supplement does not reflect changes since the cycle began. Those are NOTAMs.
  Always check NOTAMs alongside it.
- There are seven regional US volumes. Make sure you are in the correct one for the
  airport.
- It is advisory data, but the runway and performance numbers it carries feed directly
  into what you can legally and safely operate from.

## Related families

- [notams](../notams/page.md) - the live time-critical patch on the 56-day Chart Supplement data.
- [aim](../aim/page.md) - the general procedures flown against the Chart Supplement's airport-specific data.
- [14-cfr](../14-cfr/page.md) - 91.103 makes becoming familiar with airport information a preflight duty.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where published airport data sits in the family map.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - pairing the Chart Supplement with NOTAMs and the preflight rule.
</content>

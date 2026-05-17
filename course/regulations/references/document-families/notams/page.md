---
id: faa-doc-notams
title: Notices to Air Missions
family_code: NOTAM
binding: regulatory
issuer: 'FAA (and other authorities) via the United States NOTAM System; originated by airports, facilities, and the FAA'
update_cadence: 'Continuous and time-critical: NOTAMs are issued, amended, and cancelled around the clock'
status: draft
authoritative_sources:
  - source: 'FAA NOTAM Search'
    url: 'https://notams.aim.faa.gov'
    note: 'The official FAA NOTAM search, the authoritative source for current NOTAMs.'
    verified: true
  - source: 'AIM, Chapter 5, Section 1 -- Preflight (NOTAM coverage)'
    url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html'
    note: 'The AIM treatment of NOTAM categories, distribution, and the pilot responsibility to obtain them.'
    verified: true
  - source: '14 CFR 91.103 -- Preflight action'
    url: 'https://www.ecfr.gov/current/title-14/section-91.103'
    note: 'The regulation requiring a pilot to become familiar with all available information before a flight, which makes obtaining NOTAMs a duty.'
    verified: true
related_knowledge_nodes:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
  - reg-faa-cross-reference-triangulation
related_families:
  - 14-cfr
  - chart-supplements
  - aim
---

# Notices to Air Missions

> Time-critical notices of changes to the National Airspace System: a closed runway, an out-of-service navaid, a temporary flight restriction. Obtaining the relevant NOTAMs is a regulatory duty.

## What it is

A NOTAM, a Notice to Air Missions (formerly "Notice to Airmen"), is a notice of a change
to the National Airspace System that is too time-critical or too short-lived to print on a
chart or in the Chart Supplement. A runway closed for repaving, a VOR out of service, a
new obstruction, a temporary flight restriction over a stadium or a wildfire, a change to
an instrument approach, a GPS outage test: all of these are communicated by NOTAM. NOTAMs
are originated by airports, by facility operators, and by the FAA, and they flow through
the United States NOTAM System. They are the live patch layer on top of the static
published data, the thing that tells you what is different today from what your chart
shows.

## Binding or advisory

This needs care, because the NOTAM family is binding in two distinct ways. First, the
*content* of many NOTAMs is mandatory: a Temporary Flight Restriction issued by NOTAM is
regulatory airspace, and busting it is a violation; a NOTAM closing a runway means that
runway is legally closed. Second, the *act of obtaining* NOTAMs is itself a regulatory
duty: 14 CFR 91.103 requires a pilot to become familiar with all available information
concerning a flight before departing, and NOTAMs are squarely "available information." So
the family is binding from both directions. A NOTAM is not advisory guidance you may weigh
and discard. The change it announces is real and often regulatory, and checking for
applicable NOTAMs is a rule, not a courtesy.

## How it is identified

A modern domestic NOTAM is identified by an accountability location and a NOTAM number,
and it follows a structured, abbreviated format. A NOTAM number looks like:

```text
!BOS 09/123
| |  |  |
| |  |  +-- sequence number 123
| |  +----- month 09 (the month it was issued)
| +-------- accountability location identifier BOS
+---------- "!" -- domestic NOTAM marker in the legacy text format
```

The body uses standard NOTAM contractions and a fixed order: the affected facility or
airspace, the condition, and the effective time window in UTC, often with `WIE` (with
immediate effect) for the start and `PERM` or an explicit end time for the finish. NOTAMs
fall into categories a pilot should recognize, including aerodrome NOTAMs, en-route and
navaid NOTAMs, FDC NOTAMs (Flight Data Center NOTAMs, which carry regulatory items such as
TFRs and amendments to instrument procedures), and military NOTAMs. The identifier locates
the notice; the body, once decoded, tells you what changed and for how long.

## Revisions and currency

NOTAMs are the most time-sensitive family in the entire ecosystem. A NOTAM has an explicit
effective window, and it is issued, amended (a replacement NOTAM cancels and reissues),
and cancelled continuously. There is no edition letter and no fixed cycle; currency means
"what is in effect for my route, right now, for my time of flight." A NOTAM briefing
pulled an hour ago can already be stale. The only way to be current is to obtain NOTAMs
close to departure and again, where possible, en route, scoped to the actual route and
time window.

## Where to find it

The official FAA NOTAM Search is at `notams.aim.faa.gov`, and it is the authoritative
source for current NOTAMs. NOTAMs are also delivered through a standard preflight briefing
(Leidos Flight Service and other approved briefing providers), through electronic flight
bag apps, and in flight through FIS-B on ADS-B for many categories. The AIM, Chapter 5
Section 1, describes the NOTAM categories and the pilot's responsibility to obtain them.

## How it relates to the others

NOTAMs are the live-changes layer over the static published data:

- They are the time-critical patch on the **Chart Supplement** and the charts. The Chart
  Supplement gives the airport's published data on a 56-day cycle; a NOTAM tells you what
  changed since that cycle. Read them together.
- FDC NOTAMs amend instrument approach procedures and carry TFRs, which makes them an
  extension of regulatory airspace under **14 CFR**.
- The duty to obtain them is created by **14 CFR 91.103**, the preflight-action rule, so
  the NOTAM family is woven directly into the regulations.
- The **AIM** explains the categories and the distribution system.

## Common gotchas

- NOTAMs are binding in two ways: the content is often mandatory (a TFR, a closed runway),
  and obtaining them is itself required by 14 CFR 91.103.
- A NOTAM briefing goes stale fast. Pull NOTAMs close to departure and re-check en route.
- Times are in UTC. A NOTAM effective window misread as local time is a classic trap.
- A NOTAM can cancel or amend a prior NOTAM. Make sure you are reading the current notice,
  not a superseded one.
- "NOTAM" now stands for Notice to Air Missions; older material says "Notice to Airmen."
  Same system, renamed.
- FDC NOTAMs are easy to overlook because they are not airport-specific in the obvious
  way, yet they carry TFRs and approach-procedure changes.

## Related families

- [chart-supplements](../chart-supplements/page.md) - the 56-day published airport data that NOTAMs patch with live changes.
- [14-cfr](../14-cfr/page.md) - 91.103 makes obtaining NOTAMs a duty, and FDC NOTAMs carry regulatory TFRs.
- [aim](../aim/page.md) - the manual that explains NOTAM categories and the distribution system.

## Related knowledge nodes

For the discovery-walk treatment of the navigation skill this page supports, see:

- [The FAA document ecosystem](../../../knowledge/regulations/faa-document-ecosystem/node.md) - where time-critical mandatory notices sit in the family map.
- [FAA citation anatomy](../../../knowledge/regulations/faa-citation-anatomy/node.md) - reading a NOTAM accountability location and number.
- [Cross-reference triangulation](../../../knowledge/regulations/faa-cross-reference-triangulation/node.md) - pairing a NOTAM with the Chart Supplement and the preflight rule.
</content>

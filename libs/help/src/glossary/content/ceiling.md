---
key: ceiling
term: Ceiling
related: [metar-cloud-cover, flight-rule-tiers, metar-visibility]
---

# Ceiling

A **ceiling** is the height above ground level of the **lowest cloud layer reported as broken (`BKN`) or overcast (`OVC`)**, or the vertical visibility into an indefinite obscuration. It is the lowest cloud cover dense enough to be treated as a roof over the airport.

The defining word is "broken." A scattered (`SCT`) or few (`FEW`) layer is not a ceiling no matter how low its bases sit -- the sky between the clouds is still open. Only `BKN` and `OVC` close enough of the sky to count. So a station reporting `SCT006 BKN025` has a **2,500 ft ceiling**, not a 600 ft one: the 600 ft layer is only scattered.

A METAR does not label the ceiling explicitly. You read it: scan the cloud groups lowest-first and take the height of the first `BKN` or `OVC` group. When the sky is fully obscured (fog, heavy snow) the observer reports `VV` followed by a height -- vertical visibility -- and that height serves as the ceiling.

Ceiling is one of the two inputs (with [visibility](/reference/glossary/metar-visibility)) to the flight-rule tier, and it is the number that most directly governs whether a VFR departure, a pattern, or an approach is workable. It is the single most-quoted field in a weather briefing for a reason: it is the roof you have to operate under.

References: **AC 00-45H** (Aviation Weather Services, METAR/SPECI section) for the reporting rules; **Pilot/Controller Glossary** for the formal definition; **AIM 7-1** for operational use.

Learn more: [wx-reading-metars](/reference/knowledge/wx-reading-metars).

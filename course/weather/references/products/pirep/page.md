---
id: wx-ref-pirep
title: Pilot Report (UA / UUA)
short_code: UA / UUA
category: pirep
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Chapter 3 -- Observations, §3.2 (Aircraft Observations and Reports -- Pilot Weather Reports (PIREP))'
    note: 'The canonical PIREP format: field codes (/OV /TM /FL /TP /SK /WX /TA /WV /TB /IC /RM), UA vs UUA distinction, intensity scales for turbulence and icing.'
    verified: true
  - source: AIM
    section: '7-1-18 -- Pilot Weather Reports (PIREPs)'
    note: 'Why and how to file, the UUA trigger list, the role of PIREPs in the weather system.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, PIREPs chapter'
    note: 'Pilot-pitch treatment: how to read a PIREP, how to weigh aircraft type, how to triage a route worth of reports.'
    verified: true
related_knowledge_nodes:
  - wx-product-pireps
related_products:
  - airmet
  - sigmet
  - convective-sigmet
  - cwa
  - metar
---

# Pilot Report (UA / UUA)

> A weather report authored by a pilot in flight describing actual conditions encountered. Routine (UA) for normal observations, urgent (UUA) for specific hazards. The only product where another pilot tells you what the airframe is actually feeling at altitude.

## What it is

A PIREP is a weather report authored by a pilot in flight, describing conditions encountered in real time. Pilots file via Flight Service (1-800-WX-BRIEF), Flight Service Stations (FSS), ATC on whatever frequency is open, or an EFB that supports submission. The receiver encodes the report into the fixed-format PIREP string and pushes it into the national weather system, where it becomes immediately available to other pilots, dispatchers, and forecasters.

There are two classes. **UA** is routine -- everything from "smooth ride at FL340" to "tops 9,000, clear above." **UUA** is urgent, and the triggers are specific: severe icing, severe or extreme turbulence, hail, low-level wind shear within 2,000 ft AGL, volcanic ash, and tornadoes / funnel clouds / waterspouts. Anything outside that list is a UA, no matter how unpleasant the ride was.

PIREPs are the only product authored by another pilot in real time. Every other weather product is either machine-generated (METAR, radar, satellite) or forecaster-generated (TAF, AIRMET, SIGMET, CWA, prog charts). PIREPs are ground-truth: a real airframe at a real altitude is telling you what it's actually feeling, right now. That is the highest-fidelity signal you can get for icing intensity, turbulence intensity, cloud tops, and ride quality -- the things instruments and forecasts can only estimate.

## When you read it

- **Preflight, after you've built the synoptic picture.** Once you have the METAR/TAF/AIRMET/SIGMET layer, canvas the route for PIREPs. The question shifts from "what does the forecast say?" to "what are pilots actually seeing in the area the forecast is talking about?"
- **En route, continuously.** Whenever the picture changes -- transiting an AIRMET / SIGMET polygon, descending through a cloud layer the briefing flagged for icing, approaching a frontal boundary -- pull the latest PIREPs in that area. They are the freshest data you have.
- **Pair every AIRMET / SIGMET with a PIREP search.** The polygon tells you where the forecaster expects a hazard. The PIREPs in or near that polygon tell you whether the hazard has actually materialized, how bad it is, and at what altitudes. A SIGMET for severe icing with no recent PIREPs is a different decision than the same SIGMET with three UUAs for severe mixed icing at your planned altitude.
- **The decision PIREPs inform.** Altitude selection (find a smooth or ice-free band), route selection (avoid a corridor pilots are reporting hazards in), continue vs divert (a fresh UUA on your route at your altitude is a strong divert signal), and confidence in the forecast (matching PIREPs raise it, contradicting PIREPs lower it).

## How to read it

A PIREP is a fixed-order encoded string. The header is `UA` (routine) or `UUA` (urgent), followed by slash-prefixed field codes. Not every field appears in every PIREP -- pilots include what's relevant -- but the order is consistent.

| Code  | Example                    | Meaning                                                                                                                                                                                                         |
| ----- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UA`  | `UA`                       | Routine pilot report.                                                                                                                                                                                           |
| `UUA` | `UUA`                      | Urgent pilot report. Triggers: severe icing, severe/extreme turbulence, hail, LLWS <2,000 AGL, volcanic ash, tornado/funnel cloud/waterspout.                                                                   |
| `/OV` | `/OV ORD090040`            | Location, relative to a VOR or fix: VOR identifier + radial (3 digits) + distance NM (3 digits). `ORD090040` = on the 090 radial off ORD, 40 NM (40 NM east of ORD). May also be a fix name.                    |
| `/TM` | `/TM 1815`                 | Time of the observation in Zulu, HHMM.                                                                                                                                                                          |
| `/FL` | `/FL080`                   | Altitude in hundreds of feet MSL. `FL080` = 8,000 ft. `UNKN` if pilot did not specify; `DURGC` during climb; `DURGD` during descent.                                                                            |
| `/TP` | `/TP C172`                 | Aircraft type. Matters for interpretation: a moderate report from a C172 is a different ride than moderate from a B737.                                                                                         |
| `/SK` | `/SK BKN030-TOP050 OVC080` | Sky condition encountered. Bases and tops of layers the pilot flew through or observed. `TOP050` = layer top at 5,000.                                                                                          |
| `/WX` | `/WX RA`                   | Weather encountered, using the METAR phenomenon codes (RA rain, SN snow, FG fog, BR mist, TS thunderstorm, etc.). Visibility may appear here as `FV03SM` (flight visibility 3 SM).                              |
| `/TA` | `/TA M05`                  | Outside air temperature in degrees Celsius. `M` prefix for negative. `M05` = -5 C.                                                                                                                              |
| `/WV` | `/WV 27045KT`              | Wind at altitude. Direction (true) + speed in knots. `27045KT` = 270 true at 45 KT.                                                                                                                             |
| `/TB` | `/TB MOD CHOP 060-080`     | Turbulence: intensity + type + altitude band. Intensity scale: `LGT` light, `MOD` moderate, `SEV` severe, `EXTRM` extreme. Type: `CHOP` (rapid bumps), `CAT` (clear air), `OCNL` occasional, `CONT` continuous. |
| `/IC` | `/IC MOD MXD 060-090`      | Icing: intensity + type + altitude band. Intensity scale: `TRC` trace, `LGT` light, `MOD` moderate, `SEV` severe. Type: `RIME`, `CLR` clear, `MXD` mixed.                                                       |
| `/RM` | `/RM SMOOTH ABOVE FL120`   | Remarks. Free-form. Where pilots add the texture the encoded fields cannot capture (wind-shear specifics, cloud structure, ride trend, encounter narrative).                                                    |

A few format rules worth internalizing. The `/OV` group is **relative**, not absolute -- it locates the report by bearing and distance from a fix, not by latitude/longitude. The `/FL` group is the aircraft's altitude at the time of the report, not the altitude of any hazard the report mentions (hazard altitude bands live in `/TB`, `/IC`, or `/RM`). All times in `/TM` are Zulu. All temperatures in `/TA` are Celsius.

## Annotated example(s)

### Example 1 -- routine smooth ride at FL330 (UA from an airliner)

Raw product text:

```text
BIV UA /OV PMM /TM 0020 /FL330 /TP B739 /TB NEG /RM SMOOTH
```

Decoded:

- `BIV` -- the report was filed through, or relayed near, the South Haven (BIV) VOR area. The archive prepends the nearest reporting site; the PIREP body proper begins at `UA`.
- `UA` -- routine PIREP. Nothing in this report meets the UUA criteria.
- `/OV PMM` -- over the Pullman (PMM) VOR in southwest Michigan.
- `/TM 0020` -- 00:20 Zulu.
- `/FL330` -- flight level 330, i.e. 33,000 ft MSL.
- `/TP B739` -- Boeing 737-900. A transport-category jet.
- `/TB NEG` -- no turbulence reported.
- `/RM SMOOTH` -- the remarks confirm it: nothing to report, ride is smooth.

What this PIREP is telling other pilots: at FL330 over southwest Michigan, the ride is smooth. The report is sparse on purpose -- when there is nothing operationally significant, the pilot fills in only what matters. A jet-aircraft "smooth" at FL330 is a useful baseline but only loosely portable to a light single at 8,000 ft; the airframes feel different scales of motion. Still, "smooth" in the upper levels is a useful confirmation that any forecast turbulence is staying below cruise altitudes. Pilots planning a high-altitude crossing of this region get a green light at this level.

Source: Iowa Environmental Mesonet PIREP archive (mesonet.agron.iastate.edu), report 202401150020.

### Example 2 -- UUA, moderate rime icing in a business jet during descent (the kind of PIREP that re-routes other pilots)

Raw product text:

```text
RFD UUA /OV 10 NW JVL /TM 0042 /FL030 /TP CL35 /TA M06 /IC MOD RYME /RM CONTINUOUSLY FROM 070 TO 030 LANDING JVL
```

Decoded:

- `RFD` -- the report was filed through the Rockford (RFD) area; the PIREP body proper begins at `UUA`.
- `UUA` -- urgent PIREP.
- `/OV 10 NW JVL` -- 10 NM northwest of Janesville (JVL), southern Wisconsin.
- `/TM 0042` -- 00:42 Zulu.
- `/FL030` -- aircraft at 3,000 ft MSL at the time of the report.
- `/TP CL35` -- Bombardier Challenger 350. A business jet -- ice-protected, with performance reserve.
- `/TA M06` -- outside air temperature -6 C. Squarely in the icing band (roughly -10 to 0 C is the highest-risk range for supercooled liquid water).
- `/IC MOD RYME` -- moderate rime icing. `RYME` is the pilot's spelling of "rime" as it came across the wire; the encoded severity is what counts and it reads moderate. Rime ice is the rough, milky, fast-building accretion typical of small supercooled droplets.
- `/RM CONTINUOUSLY FROM 070 TO 030 LANDING JVL` -- the remarks carry the part the encoded fields cannot: the icing was continuous through a 4,000 ft band, from 7,000 down to 3,000 ft, encountered on the descent into Janesville.

What this PIREP is telling other pilots: a continuous 4,000 ft band of moderate rime, from 7,000 to 3,000 ft, over southern Wisconsin. Even a Challenger -- ice-protected and powerful -- judged this urgent enough to file UUA. For a light single without known-ice certification, that band is a wall: any pilot planning to descend through 7,000-3,000 in this area has just had the decision made for them. Stay above the layer, divert, or do not go. The UUA tag pushes this into the urgent stream where dispatchers, ATC, and other pilots see it immediately; SIGMET forecasters use it to validate or upgrade an existing icing AIRMET or SIGMET.

Source: Iowa Environmental Mesonet PIREP archive (mesonet.agron.iastate.edu), report 202412200042.

## Common gotchas

- **The `/OV` location is relative, not lat/long.** `/OV ORD090040` means 40 NM **on the 090 radial off ORD** -- i.e. 40 NM east of ORD. Not latitude 090, not 40 deg N of ORD. Pilots used to GPS lat/long sometimes misread the radial as a heading or a bearing in some other reference frame. It is always a VOR radial + distance, or a named fix.
- **The `/FL` altitude is the aircraft's altitude at the time of the report.** It is **not** the altitude of the hazard. If a pilot at FL240 reports severe turbulence between FL180 and FL220, `/FL240` is the airplane's level; `/TB SEV 180-220` is where the hazard lives. Read both, separately.
- **Turbulence intensity scale: light, moderate, severe, extreme.** "Severe" means a brief loss of control or large abrupt altitude/attitude changes -- not just an uncomfortable ride. "Extreme" is practically uncontrollable, structural damage possible. Use the words precisely.
- **Icing intensity scale: trace, light, moderate, severe.** Different from turbulence (note: no "extreme" tier on icing). "Severe" icing means the accretion rate exceeds the airframe's ability to shed it -- not just "a lot of ice." Severe icing is an immediate UUA trigger and an immediate-exit condition for the reporting airframe.
- **UUA triggers are specific.** Not every uncomfortable ride generates a UUA. Moderate turbulence is a UA; severe turbulence is a UUA. Moderate icing is a UA; severe icing is a UUA. Hail, LLWS within 2,000 AGL, volcanic ash, and tornadoes / funnel clouds / waterspouts are always UUAs regardless of intensity wording. Everything else is UA.
- **Time is Zulu.** `/TM 1432` is 14:32 UTC. A PIREP filed two hours ago that you're reading at 14:50Z is 18 minutes old; one you're reading at 16:30Z is two hours stale. Always check the gap between `/TM` and current Zulu before weighting the report.
- **Aircraft type changes the meaning.** Moderate turbulence reported by a B737 at FL340 and moderate turbulence reported by a C172 at 6,000 are calibrated by very different airframes. Both are labeled "moderate" per the same scale, but a heavy jet's "moderate" in cruise is often a light single's "severe" in the same air. Always look at `/TP` before interpreting intensity.
- **PIREPs decay -- but the decay rate depends on what's being reported.** A PIREP from 90 minutes ago over rapidly-evolving convection is mostly worthless; the cells have moved, built, or collapsed. A 90-minute-old PIREP of smooth air at FL300 in a stable upper-level pattern is still useful. Match the freshness threshold to the phenomenon.
- **Absence of PIREPs is not absence of hazard.** An empty PIREP map inside an active AIRMET or SIGMET polygon may mean the hazard hasn't materialized -- or it may mean no pilots have flown through that air recently. Do not interpret silence as a green light.
- **`/SK TOP` is the top of a layer, not the top of all clouds.** `/SK OVC050-TOP100` means an overcast layer based at 5,000 with its top at 10,000. There may be more cloud above. Read remarks for clarification.

## Triage

You have 60 seconds. Where do your eyes go first?

1. **UA or UUA?** UUA is the urgent stream and immediately changes the priority. If there is a UUA on or near your route at your altitude, read it first, completely, before anything else.
2. **Location (/OV) relative to your route.** Inside 100 NM? On the route corridor or near it? PIREPs outside that radius are situational awareness; inside it, they are decision input.
3. **Time (/TM) vs now.** Less than 60 minutes old is gold. 60-120 minutes is useful with caveats. Older than 2 hours is treated as historical -- still informative for trends, not for "what's happening now."
4. **Altitude (/FL) vs your planned altitude.** A PIREP at your altitude or in your climb/descent path is a direct input. One 10,000 ft above or below is bracket information, useful for finding an exit band but not directly comparable.
5. **Aircraft type (/TP).** Calibrate the intensity language. A "moderate" from an airframe much heavier or much lighter than yours needs translation.
6. **The hazard fields (/TB, /IC) and remarks (/RM).** Intensity, altitude band, and any narrative the pilot added. The /RM field is where the texture lives.
7. **Cross-reference the active advisories.** Does this PIREP confirm or contradict a current AIRMET / SIGMET / CWA in the same area? Matching = the forecast verified. Contradicting = re-evaluate.
8. **File your own.** If your own observations would help the next pilot -- smooth ride confirming a clear band, ice you encountered, turbulence in a specific layer -- file. The system depends on pilot input; the value of the PIREP network scales with how many pilots contribute, not with how many consume.

The question you're asking the whole time: **what is the freshest, closest, most-relevant-altitude report on my route, and does it change my altitude, route, or go/no-go?**

What changes the decision: a fresh UUA on your route at your altitude (icing, turbulence, LLWS, volcanic ash, hail, tornadic activity); a cluster of PIREPs at your altitude reporting hazards your airframe cannot handle; a pattern of cloud-top reports that means your planned VFR-on-top altitude does not exist where you thought it did; or repeated reports of smooth/ice-free conditions that justify continuing through a forecast hazard area that did not materialize.

## Related products

- [AIRMET](../airmet/page.md) -- the area forecast for IFR conditions, mountain obscuration, turbulence, icing, freezing level, and surface winds. PIREPs validate or refute AIRMET predictions.
- [SIGMET](../sigmet/page.md) -- the severe-hazard area advisory (severe turbulence, severe icing, dust storms, volcanic ash). PIREPs are often the trigger for issuing or upgrading a SIGMET.
- [Convective SIGMET](../convective-sigmet/page.md) -- thunderstorm and severe convective activity. PIREPs in or near convective SIGMET polygons confirm cell intensity, tops, and hail.
- [CWA](../cwa/page.md) -- Center Weather Advisory, the short-fuse local advisory issued by a Center Weather Service Unit. PIREPs are a primary input for CWAs.
- [METAR](../metar/page.md) -- the surface observation; PIREPs fill in what METARs cannot see (cloud tops, en-route icing, turbulence aloft, ride at altitude).

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Chapter 4 (Pilot and Radar Weather Reports). The canonical PIREP format spec: field codes, ordering, the UA vs UUA distinction, the intensity scales for turbulence and icing, and the encoding conventions for location and altitude.
- **AIM** -- 7-1-19, Pilot Weather Reports (PIREPs). Why and how to file, the urgent (UUA) trigger list, and the operational role PIREPs play in the national weather system. The reference paragraph pilots are expected to know.
- **FAA-H-8083-28** -- Aviation Weather Handbook, PIREPs chapter. Pilot-pitch treatment: how to read a PIREP at speed, how aircraft type calibrates intensity, and how to triage a route's worth of reports.
- **Service docs** -- [aviationweather.gov/data/pirep](https://aviationweather.gov/data/pirep) for the product home, current PIREPs on the map, and filing entry points. FIS-B and ADS-B weather rebroadcast PIREPs in flight.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Pilot Reports](../../../../knowledge/weather/product-pireps/node.md) -- the decode / understand / triage ladder for PIREPs, with emphasis on why pilot-authored ground-truth occupies a unique slot in the weather product family.

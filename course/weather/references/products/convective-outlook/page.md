---
id: wx-ref-convective-outlook
title: Convective Outlook (SPC)
short_code: SPC
category: chart
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services -- Convective Outlook / SPC Products section'
    note: 'Categorical risk tiers, probabilistic forecast convention, Day 1 / 2 / 3 / 4-8 windows, issuance cadence.'
    verified: true
  - source: AIM
    section: '7-1 -- National Weather Service Aviation Products'
    note: 'Operational use of SPC convective outlooks in flight planning, layered with Convective SIGMET and AIRMET.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.16.1 (Convective Outlook (AC)); Chapter on Convective Weather'
    note: 'Outlook context within the broader forecast suite and the underlying convective-weather chapter.'
    verified: false
related_knowledge_nodes:
  - wx-product-convective-outlook
  - wx-thunderstorm-hazards
related_products:
  - convective-sigmet
  - cwa
  - radar-mosaic
  - satellite
  - gfa
---

# Convective Outlook (SPC)

> The Storm Prediction Center's strategic forecast of severe convective storm risk across the continental US for the next 1 through 8 days. The strategic backdrop behind every Convective SIGMET decision.

## What it is

The Convective Outlook is a graphical and text forecast product issued by the Storm Prediction Center (SPC) in Norman, Oklahoma. It covers severe convective storm risk across the continental US for four forecast windows:

- **Day 1** -- now through 12Z tomorrow.
- **Day 2** -- 12Z tomorrow through 12Z the day after.
- **Day 3** -- 12Z day after tomorrow through 12Z the day after that.
- **Day 4-8 extended** -- a 5-day band published as percent-probability of severe weather, not categorical labels (forecast skill is too soft that far out for clean categories).

For Days 1, 2, and 3 the categorical risk scale runs in six tiers:

- **General Thunderstorms (TSTM)** -- ordinary (non-severe) convection expected.
- **Marginal (MRGL, 1)** -- isolated severe possible.
- **Slight (SLGT, 2)** -- scattered severe.
- **Enhanced (ENH, 3)** -- numerous severe.
- **Moderate (MDT, 4)** -- widespread severe likely.
- **High (HIGH, 5)** -- widespread severe and intense.

The categorical risk grades two things together: the probability of severe weather within 25 miles of any point inside the polygon AND the expected intensity (hail size, wind gust speed, tornado density). In parallel, SPC publishes separate **probabilistic** polygon overlays for the three classes of severe weather:

- **Tornado probability** -- percent probability of a tornado within 25 miles of a point.
- **Hail probability** -- percent probability of severe (>= 1 inch) hail within 25 miles of a point.
- **Wind probability** -- percent probability of severe (>= 58 mph) convective wind within 25 miles of a point.

Each outlook carries a detailed text discussion explaining the synoptic reasoning: trough position, dryline, instability budget (CAPE), shear environment, and timing. The map without the discussion is a guess about a guess; the discussion is where the SPC forecaster shows the work.

## When you read it

- **Preflight, on any day with the potential for convection.** This is broadly March through October in the continental US, year-round in the Gulf and Florida, and any time the synoptic pattern suggests organized convection elsewhere. If a current outlook shows a categorical risk over your route, departure, or destination, the rest of the convective brief (Convective SIGMET, radar, satellite, GFA, CWA) moves from background reading to active monitoring.
- **Multi-day trip planning.** When METARs and TAFs only cover ~30 hours and the GFA caps at +15 hours, the Day 2, Day 3, and Day 4-8 outlooks are the only forecast products giving you a strategic picture of severe weather for the back half of a multi-day trip. They will not give you a go/no-go answer; they will tell you which days deserve a second look at the morning brief.
- **Strategic, not tactical.** The Convective Outlook describes a risk region over a multi-hour window. The Convective SIGMET (when one fires) describes a specific 2-hour polygon of currently-active severe convection. The outlook sets expectations; the SIGMET is the tactical advisory you avoid. Reading the outlook does not substitute for reading current SIGMETs and radar.
- **The decision it informs.** Not "go" or "no-go" by itself. The outlook is the trigger to start watching: "this day, this corridor, expect active management of convective avoidance." For a light single, that activation threshold sits around SLGT; for a turboprop with onboard radar, around ENH.

## How to read it

The product is a categorical map plus probabilistic overlays plus a text discussion. Build the read in three passes.

**Pass 1: categorical risk polygons (colored).** The Day 1, Day 2, and Day 3 graphics show nested polygons colored by tier. The order is fixed.

| Tier | Label        | Color       | Severe coverage               | Operational meaning for a VFR light single                                               |
| ---- | ------------ | ----------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| TSTM | Thunderstorm | Light green | Ordinary (non-severe) TS      | Convection expected but below severe criteria. Background monitoring.                    |
| 1    | MRGL         | Dark green  | Isolated severe possible      | Background monitoring; check morning SIGMETs; no advance route change yet.               |
| 2    | SLGT         | Yellow      | Scattered severe              | Active planning. Pre-plan diverts; expect Convective SIGMETs during the window.          |
| 3    | ENH          | Orange      | Numerous severe               | Significant constraint. Most light singles re-plan around the corridor or delay the day. |
| 4    | MDT          | Red         | Widespread severe likely      | High-impact day. Most non-radar GA flights cancel or postpone in the affected corridor.  |
| 5    | HIGH         | Magenta     | Widespread severe and intense | Outbreak-day language. The SPC reserves HIGH for the worst severe-weather setups.        |

The polygons nest: a HIGH polygon sits inside an MDT polygon, which sits inside an ENH polygon, and so on out to the broad TSTM area. Reading inward gives the worst-case core; reading outward gives the area that will see severe somewhere inside it.

**Pass 2: probabilistic polygons (tornado / hail / wind).** Three separate maps, one per hazard, published alongside Day 1 and Day 2 outlooks. Each shows percent probability of that specific hazard within 25 miles of any point. The percent IS NOT "percent chance of getting hit." It is the probability anywhere inside the polygon experiences the hazard within the 25-mile point radius during the window. Tornado probabilities of 5% / 10% / 15% / 30% / 45% / 60% are meaningful gradations; 10% tornado is a serious tornado-day pattern.

**Pass 3: text discussion.** A multi-paragraph forecaster narrative. Read for: the synoptic driver, expected timing of initiation ("...convection should develop along the dryline by 21Z..."), motion vector, the corridor where the worst hazards are expected, and where the forecaster's confidence is high vs marginal. The discussion is where the difference between a "low-confidence ENH" and a "high-confidence ENH" lives.

**Day 1 update cycle.** Day 1 is reissued frequently as the forecast firms up:

| Issuance time (Z) | Notes                                            |
| ----------------- | ------------------------------------------------ |
| 0100              | Late evening reissue carrying into the next day. |
| 0600              | Overnight reissue, often the first morning read. |
| 1300              | Late-morning update.                             |
| 1630              | Early-afternoon update.                          |
| 2000              | Mid-afternoon update.                            |

(Approximate; SPC posts off-cycle updates when convection significantly outpaces or under-runs the standing outlook.)

Day 2 is issued at 0600Z and 1730Z. Day 3 at 0830Z. Day 4-8 at 0830Z. A pre-noon morning brief that pulls Day 1, Day 2, and Day 3 in one pass is the standard preflight pattern on a convective day.

## Annotated example(s)

### Example 1 -- Day-1 ENH outlook over the central Plains (17 May 2026)

Chart product (description in lieu of the graphic; the SPC convective outlook is a graphic plus a narrative discussion, not a raw text bulletin):

```text
SPC Day 1 Convective Outlook
Valid: 170100Z through 171200Z

Categorical risk:
  ENH (orange) -- northern Kansas into southern Nebraska,
    the area mostly north of I-70.
  Lower-tier SLGT / MRGL / TSTM areas surround the ENH and
    extend across the central and southern Plains.

Discussion (paraphrase): an upscale-growing, organizing
cluster of storms over northern Kansas and southern Nebraska
is the focus. Significant-caliber damaging winds are the
leading threat -- measured 85 mph gusts were reported near
Colby, Kansas. Large hail and a couple of tornadoes are also
possible. The risk area was adjusted south across northern
Kansas as the post-01Z damaging-wind potential increased.
```

Decoded:

- **ENH (orange) over northern Kansas into southern Nebraska** -- the worst-case core. An organizing storm cluster is the threat, with damaging wind the leading mode. For a VFR or non-radar IFR light single, this corridor is the planning constraint for the entire valid window.
- **The surrounding lower tiers (SLGT / MRGL / TSTM)** -- scattered to isolated severe possible at the edges, ordinary thunderstorms over the broad TSTM area. A "no-ENH" location is not a "no-thunderstorm" location: cells reach 30,000-40,000 ft with embedded turbulence, lightning, and heavy rain.
- **Damaging wind as the leading threat** -- the 85 mph measured gust near Colby, Kansas is the kind of observation that confirms the outlook is verifying. An organizing cluster producing significant-caliber wind is a forward-propagating system; it moves, and it moves the hazard with it.
- **Large hail and a couple of tornadoes possible** -- even when wind is the headline, an organizing Plains cluster carries hail and an embedded tornado risk.
- **The southward adjustment** -- the SPC moved the ENH area south across northern Kansas as the overnight damaging-wind potential grew. Outlooks are living products; the polygon you brief in the morning is not the polygon that verifies.

What this is telling you: if your flight crosses northern Kansas or southern Nebraska during this window, your route and an organizing severe cluster are in the same corridor. The decision frame is not "deviate around cells"; it is "delay the leg, route well north or south of the ENH area, or sit on the ramp until the cluster passes." Onboard radar or datalink does not buy enough margin to fly through an organizing severe cluster. The Day 1 outlook does the strategic planning; the day-of Convective SIGMETs fire inside this area and you should expect them.

Source: NOAA Storm Prediction Center Day 1 Convective Outlook (spc.noaa.gov), valid 2026-05-17 0100Z-1200Z. Categorical area and discussion content drawn from the live SPC product; the text block above paraphrases the graphic and narrative rather than quoting a raw bulletin.

### Example 2 -- Summer MRGL outlook over the Southeast with pulse air-mass thunderstorms

Chart product:

```text
SPC Day 1 Convective Outlook
Issued: 1300Z
Valid: 1300Z today through 12Z tomorrow

Categorical risk:
  MRGL (dark green) -- central and southern Georgia, the
    Florida panhandle, southern Alabama, eastern Mississippi.
  TSTM (light green) -- broad area covering most of the
    Southeast and Florida peninsula.
  (No SLGT, ENH, MDT, or HIGH risk anywhere in the CONUS.)

Probabilistic Day 1:
  Tornado:  No 2%+ area drawn.
  Hail:     5% across the MRGL.
  Wind:     5% across the MRGL.

Discussion (excerpt): "Weak mid-level flow and a moist,
unstable airmass will support diurnal pulse convection
across the Southeast through the afternoon and evening.
Storm motion 10-15 kt. Isolated marginally severe wind
gusts and sub-severe to marginally severe hail possible
with the strongest pulse storms; severe coverage too
isolated for a higher categorical tier."
```

Decoded:

- **MRGL over central/southern Georgia, Florida panhandle, southern Alabama** -- isolated severe possible. The SPC does not expect organized severe; just that one or two of the dozens of pulse cells will briefly cross the severe-criteria line.
- **TSTM area covering most of the Southeast** -- ordinary thunderstorms are the rule, not the exception. This is the standard summer Southeast pattern: weak flow, deep moisture, daytime heating fires pulse cells across the region by early afternoon.
- **No tornado probability drawn, 5% hail, 5% wind** -- the probabilistic story confirms the categorical: a low-end day for severe weather, but a normal-to-high day for non-severe convection.
- **Discussion -- "diurnal pulse convection," motion 10-15 kt** -- the cells will pop, drift slowly, rain out in 30-60 minutes, and pop again somewhere else through the afternoon. This is air-mass thunderstorm behavior: short-lived, surface-driven, generally avoidable by VFR visual deviation in clear-air gaps.

What this is telling you: this is not a "stay home" day. It is a "summer Southeast afternoon" day. The plan: depart early enough (before 19Z if possible) to land before the afternoon pulse cells go up, or plan a late-afternoon delay until the cells dissipate at sunset. En route, expect to deviate around individual visible cells; the gaps will be ample because storm motion is slow and coverage is scattered, not organized. The Convective SIGMETs that fire today will be brief (1-2 hour validity for individual cells), few, and tactical -- not strategic constraints on the whole region. Cross-checking radar mosaic and satellite will be a higher-bandwidth task than reading the outlook itself; the outlook just told you the day's pedagogy.

## Common gotchas

- **The categorical tiers are about SEVERE convection only.** Severe = >= 1 inch hail, >= 58 mph (50 kt) wind gusts, or a tornado. A TSTM (or even a "no risk drawn anywhere" outlook) day still has ordinary thunderstorms with tops to FL400+, embedded turbulence, lightning, downburst microbursts, and locally heavy rain -- all of which are aviation hazards. "Not a severe-weather day" is not "not a thunderstorm day."
- **The probabilistic percentages are FOR A POINT, not "% chance my flight gets hit."** A "10% tornado" polygon means there is roughly a 10% probability of a tornado within 25 miles of any single point in that polygon during the window. The probability that SOMEWHERE in the polygon a tornado occurs is much higher; the probability that your specific airport sees one is much lower. Read the percent as a hazard density indicator over a large area, not a personal odds bet.
- **The discussion text is more useful than the graphic alone.** A high-confidence MDT and a low-confidence MDT print identically on the map. The difference -- expected timing, the synoptic driver, where the forecaster's confidence is highest, what would force a downgrade or an upgrade -- lives in the discussion. Reading only the colored polygons is reading the rendering and ignoring the reasoning.
- **A categorical risk polygon is not a "no-fly zone."** It is a probability surface over a multi-hour window. A SLGT or even ENH polygon over your route at 14Z does not mean storms are over your route at 14Z; it means scattered or numerous severe storms are expected somewhere in that polygon at some time before 12Z tomorrow. Combine with the discussion's timing language and the current Convective SIGMET picture to decide what your specific corridor looks like at your specific flight time.
- **Day 4-8 uses percent probabilities, not categories, on purpose.** Forecast skill is too soft that far out for clean categorical bins. A 30% probability is meaningful information; calling it "Slight" would imply confidence the model doesn't have. The categorical labels reappear as forecast confidence rises in Day 1-3.
- **The outlook is CONUS only.** Alaska, Hawaii, and offshore areas have their own convective products (CWAs and area SIGMETs issued by the Alaska Aviation Weather Unit and CWSU offices). The SPC Convective Outlook does not cover them.
- **The Day 1 update cycle reissues frequently; an early-morning brief can go stale by afternoon.** A 0600Z outlook may show a SLGT over your destination; the 1630Z update may have upgraded that to ENH as the morning soundings and the developing surface pattern firmed the picture. Pull the most recent issuance before launch, not the one you read at breakfast.

## Triage

On a planning morning with potential convection along the route, eyes go in this order:

1. **Day 1 categorical graphic.** Is there a categorical risk over my route, departure, or destination? What tier? What part of the corridor is inside the highest tier vs the outer rings?
2. **Discussion text.** Read it. The timing line ("convection should initiate by 21Z along the dryline") is the most important sentence on the page -- it tells you whether your flight window is before, during, or after the convective onset. If timing puts initiation east of you by your arrival, the planning problem is different than if initiation is right over your destination at landing.
3. **Probabilistic overlays.** What is the tornado %, hail %, wind % over my corridor? A hatched (significant) area is a strong upgrade signal regardless of the categorical tier. A 10% hatched tornado area is a different day than a 10% non-hatched.
4. **Layering against tactical products.** Current Convective SIGMETs, radar mosaic, satellite, and GFA. The outlook tells you what to expect; the SIGMETs and radar tell you what's actually happening right now. A SLGT polygon with no current WST and a clear radar at takeoff time can still have a WST in your corridor by arrival -- that's why you read the outlook before you read the radar, not instead of it.
5. **The decision.** Categorical risk + significant-hazard hatching + timing inside my flight window -> shift from monitoring to active planning. Cancel, delay, route significantly, or reposition. Save "press on and deviate" for MRGL or TSTM days with adequate gaps and equipment.

## Related products

- [Convective SIGMET (WST)](../convective-sigmet/page.md) -- the tactical complement. Convective SIGMETs are 2-hour polygons of currently-active severe convection; the outlook is the multi-day strategic picture from which most WSTs eventually emerge.
- [CWA](../cwa/page.md) -- Center Weather Advisory, issued by individual ARTCC CWSUs for developing convective hazards inside their airspace, often before a Convective SIGMET amendment catches up.
- [Radar mosaic](../radar-mosaic/page.md) -- ground-truth current radar returns. The outlook tells you to expect storms; the radar tells you where they actually are right now.
- [Satellite](../satellite/page.md) -- cloud-top imagery, especially IR. Useful for confirming top heights, finding overshooting tops, and watching anvil shields develop in real time.
- [GFA](../gfa/page.md) -- Graphical Forecasts for Aviation. The +15-hour forecast layer that bridges between the outlook (multi-day strategic) and current observations (METAR / radar / SIGMET).

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Convective Outlook / SPC Products section. Categorical tiers, probabilistic forecast convention, Day 1 / 2 / 3 / 4-8 windows, issuance cadence.
- **AIM** -- 7-1, National Weather Service Aviation Products. Operational use of SPC outlooks inside the convective brief, layered with Convective SIGMET, AIRMET, and CWA.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 27 Forecasts (Section 27.16.1 Convective Outlook (AC)) and the broader Convective Weather chapter.
- Service docs: <https://www.spc.noaa.gov/> for the live outlooks, archive, discussion text, and probabilistic graphics.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [Convective Outlook (AC)](../../../../knowledge/weather/product-convective-outlook/node.md) -- the discovery walk through categories, cadence, and the strategic-vs-tactical layering against Convective SIGMET and radar.
- [Thunderstorm hazards](../../../../knowledge/weather/thunderstorm-hazards/node.md) -- the underlying physics behind what the outlook's "severe" thresholds actually mean to a flight: hail throw, lightning radius, microburst footprint, embedded turbulence, the 20 NM cell separation rule.

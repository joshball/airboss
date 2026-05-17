---
id: wx-ref-prog-chart
title: Surface Prognostic Chart (Prog)
short_code: PROG
category: chart
tier: 1
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: Prognostic Charts
    note: Format and symbology for the surface progs (short-range, medium-range, extended) and the legacy Low-Level Sig Wx Prog.
    verified: true
  - source: AIM
    section: 7-1 area
    note: Aviation weather services context; surface progs as forecast counterpart to the surface analysis.
    verified: true
  - source: FAA-H-8083-28
    section: Prognostic Charts chapter
    note: Aviation Weather Handbook, Prognostic Charts -- WPC surface forecast progs, OPC offshore progs, retired Low-Level Sig Wx Prog history.
    verified: true
related_knowledge_nodes:
  - wx-chart-type-surface-analysis
  - wx-airmasses-and-fronts
related_products:
  - surface-analysis
  - gfa
  - taf
  - airmet
  - convective-outlook
  - sigwx-prog
---

# Surface Prognostic Chart (Prog)

> Forecast equivalent of the surface analysis: predicted positions of fronts, isobars, and pressure centers at standard forecast hours (commonly 12, 24, 36, 48, 60, 72 hr). The synoptic story projected into tomorrow and the day after.

## What it is

A surface prognostic chart, or **prog**, is an NWS-issued forecast chart that shows the predicted positions of fronts, isobars, and pressure centers at a fixed forecast hour. It looks like a surface analysis -- the same symbology, the same scale, the same kind of pen -- but the valid time on the panel is in the future. Each panel is labeled with its valid Zulu time.

The surface-prog family is issued **4x daily** in a series of panels at standard lead times:

- **Short-range** -- 12, 24, 36, 48 hr progs.
- **Medium-range** -- 60, 72 hr progs.
- **Extended** -- 96 hr and beyond, with progressively wider error bars.

The primary issuing office is the NWS **Weather Prediction Center (WPC)** for CONUS surface forecasts; the **Ocean Prediction Center (OPC)** issues offshore Atlantic and Pacific surface progs with slightly different conventions for ocean traffic. The text-equivalent forecast discussions explain why the model thinks what it thinks.

Two adjacent products commonly confused with the surface prog:

- The **Low-Level Significant Weather Prog** (covering surface to FL240) was formally retired in CONUS in 2017. Its content -- precipitation areas, freezing precipitation, IFR / MVFR zones, turbulence, freezing level -- now lives across the surface prog plus the **GFA** hazards layers and the in-flight AIRMET / SIGMET bulletins.
- The **Mid / High Significant Weather Prog (SIGWX Prog)** -- FL250 to FL630 -- is a separate product on its own page ([sigwx-prog](../sigwx-prog/page.md)).

This page covers the surface-prog family.

## When you read it

- **Preflight**, paired with the current surface analysis. The analysis tells you where the synoptic features are now; the prog tells you where they will be when you fly.
- **For flights more than 12 hours out**, the prog *is* your synoptic picture. Today's METARs and TAFs don't extend into tomorrow afternoon; the 24 / 36 / 48 hr progs do.
- **Trip planning, not in-flight.** Progs frame the briefing. Once you're closer to launch, the GFA, TAFs, AIRMETs, and current observations refine what the prog only sketches.

What it decides:

- **Trip-go / trip-no-go** for flights one or more days out. A 48 hr prog showing a cold front cutting through your destination at your ETA changes the trip.
- **Route shaping at the synoptic scale.** If tomorrow morning's 24 hr prog parks a deep low north of your route, you fly the south side of it with a tailwind; if it deepens, you fly farther south.
- **Outlook framing.** Progs set expectations for the AIRMETs and TAFs that will be issued for your flight window. If the 24 hr prog has a front bisecting your destination at ETA, expect a SIERRA AIRMET and a TAF with a TEMPO or FM line around that time.

What it replaces or supplements: the prog is the multi-day synoptic forecast layer. It sits alongside the surface analysis (the now-snapshot), the GFA (the multi-hour hazards layer), the convective outlook (multi-day convective risk), and the SIGWX prog (mid / high level features).

## How to read it

Each panel is a chart of CONUS (or the offshore basin, for OPC progs) with a **valid time in Zulu** clearly labeled in the corner or title block. Read each panel as a snapshot in the future: it shows the synoptic state the model expects at that moment.

The symbology is the **same alphabet as the surface analysis** (see [surface-analysis](../surface-analysis/page.md) for the shared symbols), with a few prog-specific additions for forecast precipitation and freezing precipitation areas:

| Symbol                                                    | Meaning                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| H                                                         | Forecast high pressure center; the number near it is the forecast central MSL pressure in mb.                      |
| L                                                         | Forecast low pressure center; the number near it is the forecast central MSL pressure in mb.                       |
| Solid line w/ triangles                                   | Cold front -- triangles point in the direction of front motion.                                                    |
| Solid line w/ semicircles                                 | Warm front -- semicircles point in the direction of front motion.                                                  |
| Alternating triangles + semicircles, same side            | Stationary front -- alternating warm / cold barbs on the same side of the line.                                    |
| Alternating triangles + semicircles, opposite sides       | Stationary front -- (older convention; same meaning).                                                              |
| Triangles + semicircles, same side, pointing the same way | Occluded front -- cold front catching the warm front.                                                              |
| Solid isobar (labeled mb)                                 | Forecast surface isobar at the panel's valid time, typically every 4 mb (e.g. 1000, 1004, 1008).                   |
| Shaded / hatched area                                     | Forecast precipitation area -- continuous, intermittent, or showery (see the chart legend for the specific hatch). |
| Shaded area w/ freezing label                             | Forecast freezing precipitation zone (where shown on the surface prog).                                            |
| Dashed line                                               | Forecast trough -- a feature without a closed circulation but enough convergence to organize weather.              |
| Arrow with speed                                          | Forecast movement vector for a low or front (when annotated).                                                      |

For the shared frontal-symbol vocabulary and isobar mechanics, the surface-analysis page is the master reference; the prog adds the forecast-precipitation and forecast-freezing-precipitation hatching, plus the explicit valid-time label per panel.

Read a multi-panel prog as a **time series**. Lay the panels in order -- 12, 24, 36, 48 -- and watch the features move. A front sliding southeast across three panels is a moving cold front; a low deepening (central pressure dropping) across three panels is cyclogenesis; isobars tightening across panels means winds increasing.

## Annotated example(s)

### Example 1 -- 12 / 24 hr progs, Pacific Northwest cold front crossing the Great Plains

The 12 hr prog, valid tomorrow 06Z, shows a deep low centered near the Idaho / Montana border at about 992 mb, with a cold front draped southeast from the low through eastern Wyoming, the Colorado Front Range, and into eastern New Mexico. Isobars wrap tightly around the low, spaced roughly 4 mb apart out through the high plains -- a tight pressure gradient. To the east, behind the front (north and west of it), shaded continuous precipitation extends from western Montana through northern Wyoming and into the western Dakotas.

The 24 hr prog, valid tomorrow 18Z (twelve hours later), shows the same low having tracked east-northeast into northern Minnesota, central pressure now 988 mb (deeper -- the model has it intensifying). The cold front has swept east with it: by 18Z the front is draped from northern Minnesota through Iowa, eastern Kansas, central Oklahoma, and into north Texas. Precipitation hatching has migrated with the front; the back edge of the precipitation is now somewhere over the Dakotas and the leading edge is along the Iowa / Missouri border. Isobars are even tighter around the low's new position, and a wide pressure gradient stretches from the low southward through the Great Plains.

How to read the two panels for a flight from KMSP to KDEN tomorrow morning departing around 14Z (between the two panels):

- At 12Z (just before departure), the front is well west of the route -- you're in the warm sector, with southerly flow and likely high ceilings but possible pre-frontal cumulus and gusty south winds.
- By 18Z, the front has crossed Iowa and is approaching the Mississippi. KMSP at 18Z is *behind* the front in the cold sector -- arrival weather there in the late afternoon will look different from departure weather in the morning. But the flight is westbound, and KDEN is well south and west of the low; by 18Z KDEN is on the southern flank, in the warm sector, but with the front approaching from the north. ETA at KDEN around 17Z puts you on the ground before the front arrives.
- The tight isobars across the route mean strong winds aloft. Cross-reference with the winds-temps aloft chart -- this is a strong westbound headwind, not a tailwind.
- The leading edge of precipitation on the 24 hr panel is east of the route, so the route itself is dry, but expect turbulence south of the low and gusty surface winds on arrival at KDEN if the front speed has been underestimated.

The two panels together tell a coherent story: a cold front sweeping east, a deepening low, tightening winds. The 12 hr panel is the departure environment; the 24 hr panel is the arrival environment. Reading either one alone misses the trend.

### Example 2 -- 48 hr prog, Gulf Coast cyclogenesis from a weak trough

The current surface analysis shows a weak dashed trough over the eastern Gulf of Mexico -- no closed circulation, no front, just a kink in the isobars and a hint of low-level convergence. The 12 hr and 24 hr progs show the trough persisting, isobars beginning to bow more sharply, but still no closed low.

The 48 hr prog, valid two days out at 18Z, tells a different story. The trough has organized into a closed surface low centered just off the Florida Panhandle coast, central pressure around 1004 mb. A warm front extends east from the low across central Florida into the Atlantic; a cold front extends southwest from the low into the central Gulf. Continuous precipitation hatching covers most of Florida and the western Atlantic offshore waters. Isobars wrap around the new low, with a clear pressure gradient north into Georgia and the Carolinas.

This is classic Gulf cyclogenesis -- a weak inverted trough riding a baroclinic zone, and 48 hours of upper-level support spinning it up into a closed surface low. The story to read:

- The model thinks the trough develops. The 12 hr and 24 hr progs are the precursors; the 48 hr prog is the punchline.
- For a flight planned along the eastern seaboard two days out (say KMIA to KCLT), the 48 hr prog says expect IFR conditions over Florida, a warm-front rain shield extending north into Georgia, and northeasterly flow ahead of the system bringing low ceilings and onshore moisture to the Carolinas. Cross-checking with the 48 hr GFA and the day-3 convective outlook will refine the picture for the actual flight day, but the prog is the first signal.
- The 60 and 72 hr progs (next panels in the series) will show whether the model takes the low northeast up the coast (classic nor'easter trajectory) or whether it stalls over the Florida peninsula. Watch the next prog cycle for confirmation; cyclogenesis forecasts at 48+ hours often shift in track and intensity from run to run.

A surface analysis showing only a trough today, and a 48 hr prog showing a closed low with fronts and a precipitation shield, is the synoptic-scale equivalent of a long-range alarm bell. Don't commit to a route two days out without re-checking the next prog cycle.

## Common gotchas

- **A prog is a forecast, not a snapshot.** Don't read a 72 hr panel as a commitment. Read it as the model's best current intent. The further out the panel, the wider the error bars on front position, low track, and intensity.
- **Always pair the 12 hr prog with the most recent surface analysis.** If the model's initial state (where the analysis says the features are now) doesn't match the analysis, the model is starting from the wrong place and the rest of the progs are suspect.
- **Front positions are point estimates.** A front drawn on a 24 hr prog may be off by 100 to 200 nm in either direction even when the model is doing well. Read the front as a band, not a line.
- **Low central pressures are estimates too.** A 48 hr prog showing a 1004 mb low can verify as 1000 mb (deeper, more energetic) or 1008 mb (shallower, less impressive). The deeper case is the one to plan around.
- **The Low-Level Sig Wx Prog as a separate product was retired in CONUS in 2017.** Old training materials and AC references still mention it; on the AWC website it's gone. Hazardous weather features that used to live on it now live on the surface prog (precipitation, freezing precipitation, fronts) plus the GFA hazards layers (ceilings / visibility, icing, turbulence) plus the in-flight advisories.
- **WPC vs OPC vs regional conventions.** The Weather Prediction Center issues CONUS surface progs; the Ocean Prediction Center issues offshore Atlantic and Pacific surface progs with conventions tuned for marine forecasting. Tropical Analysis and Forecast Branch covers the tropics. Don't assume one chart's legend transfers to another -- check each.
- **Multi-panel timing is by Zulu.** Read the valid time, not the panel position on the page. WPC publishes panels in a fixed layout, but the valid times advance left-to-right or top-to-bottom depending on the product. Confirm before reasoning about the time series.
- **Precipitation hatching is forecast continuous / intermittent / showery coverage, not intensity.** A hatched zone doesn't mean heavy rain -- it means the model expects measurable precipitation across that area at that time. Intensity comes from radar mosaics, TAFs, and the convective outlook.

## Triage

When you have 60 seconds with a multi-panel prog, your eyes go to four things in order:

1. **Where will the synoptic features be when I fly?** Find the panel whose valid time brackets your flight window. Note where the fronts and pressure centers sit relative to your route and your destination.
2. **Will my route cross a front during the flight?** Compare panel-to-panel -- if a front sits east of the route on the 12 hr panel and west of the route on the 24 hr panel, it crossed during your flight window. That's the most important fact on the chart.
3. **Are pressure gradients tightening?** Isobars getting closer panel-to-panel means winds are increasing. Cross-check with the winds-temps aloft forecast; a tightening gradient on the prog should match increasing wind speeds on the winds-temps chart.
4. **Are the fronts moving as expected from the analysis?** Lay the 12 hr prog next to the current surface analysis. If the 12 hr prog has the front 200 nm east of where the analysis has it now and the front is moving east at 20 KT, that's consistent (200 nm / 12 hr = ~17 KT). If the numbers don't reconcile, the model has front speed wrong and the later panels are suspect.

The trip-go / trip-no-go drivers:

- **A front bisecting destination at ETA** is a TAF / AIRMET trigger. Expect frontal weather on arrival; plan for the alternate.
- **A deepening low** (central pressure dropping panel-to-panel) means the storm system is intensifying. Surface winds, precipitation intensity, and AIRMET / SIGMET coverage will all grow.
- **A long-range prog showing organized weather two or three days out** is the early warning. Re-check the next prog cycle before committing to a multi-day trip.

## Related products

- [surface-analysis](../surface-analysis/page.md) -- the now-snapshot that the prog projects forward; same symbology, with the prog's initial conditions taken from it.
- [gfa](../gfa/page.md) -- Graphical Forecasts for Aviation; the multi-hour hazards layer that supplements the prog with ceilings, visibility, icing, turbulence, and AIRMET polygons.
- [taf](../taf/page.md) -- Terminal Aerodrome Forecast; the 24 to 30 hour forecast at a specific airport. The prog frames the synoptic story; the TAF tells you what the airport will look like at ETA.
- [airmet](../airmet/page.md) -- the in-flight advisory that catches the area-hazard implications of the synoptic features the prog forecasts.
- [convective-outlook](../convective-outlook/page.md) -- SPC convective outlook; the multi-day convective-risk layer that complements the surface prog's synoptic forecast with thunderstorm probability.
- [sigwx-prog](../sigwx-prog/page.md) -- mid / high level Significant Weather Prog (FL250 to FL630); the upper-level forecast counterpart to the surface prog.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Prognostic Charts section (format and symbology for surface progs, plus the now-retired Low-Level Sig Wx Prog).
- **AIM** -- 7-1 area, Aviation Weather Services (operational context for surface progs as the forecast counterpart to the surface analysis).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Prognostic Charts chapter (WPC surface forecast progs, OPC offshore progs, retirement history of the Low-Level Sig Wx Prog).
- **wpc.ncep.noaa.gov** -- Weather Prediction Center; current short-range and medium-range surface forecast progs, plus forecast discussions explaining the model reasoning.
- **ocean.weather.gov** -- Ocean Prediction Center; offshore Atlantic and Pacific surface progs.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the synoptic alphabet the prog is drawn in -- frontal symbols, isobars, pressure centers -- see:

- [Surface analysis chart type](../../../../knowledge/weather/chart-type-surface-analysis/node.md)
- [Airmasses and fronts](../../../../knowledge/weather/airmasses-and-fronts/node.md)

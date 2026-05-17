---
id: wx-ref-turbulence-gtg
title: Graphical Turbulence Guidance (GTG)
short_code: GTG
category: icing-turb
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: Turbulence Forecast / Graphical Turbulence Guidance
    note: Format, valid times, severity scale, and component-layer definitions for the GTG product.
    verified: true
  - source: AIM
    section: 7-1-23
    note: Turbulence -- operational classification, intensity definitions, PIREP weighting that GTG severity is calibrated against.
    verified: true
  - source: FAA-H-8083-28
    section: Chapter 19 -- Turbulence
    note: Aviation Weather Handbook turbulence chapter; CAT, mountain-wave, and convective turbulence sources that the GTG component layers map to.
    verified: false
related_knowledge_nodes:
  - wx-turbulence-types
related_products:
  - airmet
  - sigmet
  - pirep
  - winds-temps-aloft
  - gfa
---

# Graphical Turbulence Guidance (GTG)

> Gridded turbulence forecast issued by the Aviation Weather Center, available at each flight level from 1,000 ft to FL450 in 3-hour steps out to 18 hours. Total turbulence plus separate clear-air, mountain-wave, and convective-induced component layers, on a smooth / light / moderate / severe scale.

## What it is

GTG is the AWC's gridded turbulence forecast: a raster product, not a polygon advisory, that paints a color-coded turbulence intensity onto every grid cell of the CONUS at every flight level from 1,000 ft up through FL450 in 1,000 ft increments. It is generated algorithmically by blending numerical-weather-model dynamics (wind shear, deformation, Richardson number diagnostics, mountain-wave parameterizations, convective output) with recent PIREP and in-situ EDR (Eddy Dissipation Rate) reports that calibrate the model fields against observed turbulence.

The product is sliced four ways:

- **Total turbulence** -- the blended all-causes forecast. The default view; this is what most pilots scrub first.
- **Clear-air turbulence (CAT)** -- the upper-troposphere shear component, typically tied to jet streams and tropopause folds.
- **Mountain-wave turbulence** -- the orographic component triggered by cross-ridge flow over a stable layer.
- **Convective-induced turbulence (CIT)** -- the convective component, derived from the convective forecast (separate skill from CAT; the model handles convection on a different track than shear).

Forecasts are valid in 3-hour steps out to 18 hours. The severity scale is **smooth / light / moderate / severe**, displayed as a color ramp: green for smooth, yellow for light, orange for moderate, red for severe. The reference airframe for the severity calibration is a medium-jet (think regional or business jet) -- a load category that matters when a light GA aircraft reads the product.

## When you read it

- **Preflight** -- on any cross-country, especially when crossing mountain ranges, transiting near jet streams in winter or in transitional seasons, or operating in convective environments. GTG is the spatial picture; AIRMET Tango is the regulatory advisory. Read them together.
- **Cruise altitude selection** -- GTG's flight-level slider is the whole point. Scrub to your filed altitude, then scrub one level up and one level down to see whether a small altitude alternate moves you out of the orange band.
- **En route refresh** -- on EFB, after a PIREP confirms or refutes the forecast in your sector.

What it decides:

- **Altitude** -- the slider is built for this. If 12,000 ft MSL is solid orange and 14,000 ft is yellow on the same column, the answer is climb (winds and freezing level permitting).
- **Route** -- a mountain-wave band aligned with the Continental Divide may push the route north or south to a lower-terrain corridor.
- **Go / delay** -- a severe (red) area covering your only viable altitude band is a delay or a different day.

What it replaces or supplements: GTG is the model's quantitative best-guess of where the turbulence is. AIRMET Tango is the regulatory advisory that wraps the moderate-and-worse forecast in a polygon. PIREPs are the truth-up that calibrate (or refute) both. GTG sits in the middle: more spatial detail than AIRMET Tango, more confidence than a raw model field because of the EDR / PIREP calibration.

## How to read it

GTG is a chart product. The interface (aviationweather.gov/gtg, or the same data rendered inside EFBs and FIS-B receivers) has three primary controls:

| Control             | Range / options                                               | What it answers                                                                      |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Flight-level slider | 1,000 ft to FL450 in 1,000 ft steps                           | At my cruise altitude, what does the forecast look like over my route corridor?      |
| Component toggle    | Total / CAT / Mountain Wave / CIT                             | What is causing the turbulence -- is it shear, wave, or convection?                  |
| Valid-time stepper  | T+0, T+3, T+6, T+9, T+12, T+15, T+18 (3-hour steps)           | Where will the turbulence be when I'm there, not where it is right now?              |
| Severity legend     | Green (smooth) / Yellow (light) / Orange (mod) / Red (severe) | How bad, in medium-jet terms? Mentally bump one level worse for a light GA aircraft. |

The workflow is: pick your altitude, pick your valid time (the forecast step that brackets your ETA), look at Total first to see the picture, then toggle to CAT / Mountain Wave / CIT to identify the cause. Cause drives the avoidance option: shear-driven CAT escapes with a small altitude change; mountain wave needs lateral re-routing or a much larger altitude change; CIT escapes by deviating around the convection itself.

## Annotated example(s)

### Example 1 -- Rocky Mountain lee-wave day, moderate-severe mountain wave over the Divide

Setup: a winter afternoon with a 50 KT westerly at FL250, perpendicular to the spine of the Colorado Rockies. The 500 mb chart shows a strong west-northwest flow stacked through the column with a stable layer above the ridge tops. Pilot is planning a VFR Cessna 182 trip from KAPA (Centennial, Denver area) westbound across the Divide to KASE (Aspen) at 14,500 MSL.

What GTG shows:

- **Total layer, 14,000 ft slice** -- a band of orange (moderate) draped along the Front Range from roughly Cheyenne south to Pueblo, broadening over the Sawatch Range and the Elk Mountains. A pocket of red (severe) sits on the immediate lee of the Continental Divide between roughly 12,000 and 18,000 MSL.
- **Total layer, 25,000 ft slice** -- the orange band persists, narrower, with red still over the Sawatch. The wave is deep.
- **Mountain Wave component, 14,000 ft slice** -- the orange and red are almost entirely accounted for by mountain wave. Toggling to CAT shows mostly green at this level; CIT shows green (no convection in winter).
- **Mountain Wave component, 30,000 ft slice** -- still showing moderate. The wave extends well above the highest peaks. The signature is the smoking gun for cross-ridge wave.

What this is telling you: the model is forecasting a textbook mountain-wave day. The cause is unambiguous because the Mountain Wave layer carries the signal alone. The decision is altitude:

- **File above the wave?** The 182 doesn't have the climb performance to get above the wave reliably; the wave is forecast through FL250 and higher. Not an option for this aircraft.
- **File below the wave?** Below ridge top (the Sawatch peaks are above 14,000 MSL) is impossible because terrain wins. A VFR-IMC penetration of the wave at 14,500 puts the pilot in the worst of the rotor under the wave crest -- exactly where airframes fail per the turbulence-types reading. The mountain wave layer at 12,000-14,000 is showing the rotor zone, not the smooth wave above.
- **Delay or re-route.** The realistic options are wait for the cross-ridge wind to drop below 25 KT (check the winds-temps-aloft forecast and the synoptic trend), or route around the heavy wave activity to the north or south via a lower terrain crossing.

The GTG severity ramp is calibrated against a medium-jet airframe. The Cessna 182 feels one severity step worse -- the model's orange is the 182's red. That converts the decision from "moderate, manage it" to "severe, don't go."

### Example 2 -- Polar-front jet across the upper Midwest, CAT band from FL280 to FL410

Setup: an early-spring day with a 130 KT polar-front jet core at FL340 running from northern Montana across the Dakotas and Minnesota into Wisconsin. A 727 hPa shear zone sits in the upper troposphere on the cyclonic (cold) side of the jet. Two operations are reading the same GTG product:

- A regional jet at FL370 planning KMSP to KORD.
- A piston twin at 12,000 MSL planning the same route on an IFR flight plan.

What GTG shows:

- **Total layer, FL370 slice** -- a band of orange and red along the jet axis from western North Dakota across the Twin Cities into central Wisconsin. The band is roughly 200 NM wide and slopes downward to the east as the jet exit region descends.
- **Total layer, 12,000 ft slice** -- mostly green and yellow. A few light pockets near terrain in western South Dakota, otherwise smooth.
- **CAT component, FL370 slice** -- carries the entire signal. The orange and red on the Total view at FL370 are CAT. Mountain Wave at this level is green (no significant terrain forcing); CIT is green (no convection in this synoptic pattern).
- **CAT component, FL280 slice** -- yellow with isolated orange on the cyclonic side of the jet. The CAT band has structure: worst near the jet core, fading above and below.
- **CAT component, FL410 slice** -- yellow, no orange. Above the jet, the shear weakens.

What this is telling you, read two ways:

- **Regional jet at FL370.** You're flying directly through the CAT band's worst layer. The cause is clear: jet-stream shear. The avoidance is altitude. Check the CAT slice at FL410 (yellow, manageable) and FL310 (orange, worse). The answer is request a climb to FL410 or, if traffic and aircraft performance allow, FL430 to top the shear. The altitude change is 4,000 ft, well above the "1,000-2,000 ft up or down" rule for CAT because the shear layer is broad in this pattern.
- **Piston twin at 12,000 MSL.** GTG shows green / yellow at your altitude. The jet-stream CAT is 25,000 ft above you and has no effect on a 12,000 ft IFR flight. The right read of this product for this aircraft is "the jet is not your problem today." Don't be alarmed by the red band at FL370; check your altitude slice and brief the actual hazards at your level (none significant, in this example -- this is a routine 12,000 ft IFR day).

The point: the same product, read at two altitudes, gives two completely different operational pictures. The flight-level slider is not a convenience; it is the central control. A pilot who reads only the Total view at the highest altitude and assumes "GTG is bad today" is making the wrong call for a low-altitude flight.

## Common gotchas

- **GTG is FORECAST guidance, not measurement.** It is the model's best blend, calibrated against recent PIREPs and EDR. A grid cell rendering green is the model's claim, not a guarantee. When PIREPs in that cell report moderate or worse, the PIREPs are the truth and the model is wrong for that cell. PIREPs always trump the forecast.
- **Mountain-wave layer requires three ingredients.** Terrain, wind perpendicular to the ridge with sufficient speed (typically > 25 KT at ridge top), AND a stable layer aloft to cap the wave. Two out of three doesn't produce a wave. If the model predicts a mountain-wave band but the morning sounding shows no stable layer aloft, the wave probably won't materialize. Cross-check the synoptic ingredients before trusting the layer.
- **CAT is the clear-air component; convective turbulence is in the CIT layer.** Don't read CAT and conclude "no turbulence" if convection is present. Toggle CIT. CIT is derived from the convective forecast, which has its own skill ceiling (convection is harder to predict spatially than shear); a CIT layer that looks calm 18 hours out can be wrong if the convective initiation timing slips.
- **Severity calibration is for a medium-jet airframe.** AIM 7-1-23 already tells us turbulence intensity is per-airplane (a Citation's moderate is a Cherokee's severe). GTG is calibrated near the Citation end of that spectrum. A light GA aircraft (Cessna 172, Cherokee, light twin) should mentally bump severity one level worse: model yellow = light GA moderate; model orange = light GA severe. Don't trust the green on a 50 KT cross-ridge day in a 172.
- **The 3-hour steps drop detail.** GTG steps are T+0, T+3, T+6, ..., T+18. The 2-hour mark between steps is interpolated by the user, not by the model. A short-lived shear band can pulse between forecast steps. The 18-hour valid window is long; the 0-6 hour window is the trustworthy one.
- **The severity color ramp is not a linear scale.** Smooth to light is the smallest jump. Light to moderate is a real operational threshold (the AIRMET Tango trigger). Moderate to severe is the big jump (the SIGMET trigger if widespread). Two yellow cells next to each other can mean "noise at the edge of light"; an orange cell next to a yellow cell is a meaningful gradient.
- **GTG covers CONUS only.** Alaska, Hawaii, oceanic routes have separate products (AK-GTG and similar regional products). If you're flying outside the lower 48, this is not your product.
- **GTG and AIRMET Tango can disagree at the edges.** AIRMET Tango is issued on a 6-hour cycle as a polygon; GTG updates more often as a raster. A new GTG cycle can show moderate turbulence in an area Tango hasn't caught up to yet. Read both; trust GTG for spatial detail and Tango for the regulatory bracket.

## Triage

When you have 60 seconds with GTG on the EFB, your eyes go to four things in order:

1. **Scrub the flight-level slider to your cruise altitude.** Everything else on screen is irrelevant until you slice to your altitude. The high-altitude jet means nothing to a 12,000 ft flight; the low-altitude mountain wave means nothing to a FL370 flight.
2. **Read Total first.** Does any orange or red touch the route corridor at my altitude? If green / yellow only, this is a briefing-context check; move on.
3. **If orange or red touches my altitude band, toggle into the component layers.** CAT, Mountain Wave, CIT -- one of them owns the signal. The cause drives the avoidance: shear escapes via small altitude change, wave needs lateral re-routing or large altitude change, CIT escapes by deviating around convection.
4. **Step the valid-time forward to my ETA over each route segment.** A clean picture at T+0 over the destination can be a moderate band at T+6 when you arrive. Read the time, not just the place.

The decision drivers:

- **Moderate or worse at filed altitude over the route, GA aircraft, no climb option.** Re-evaluate: altitude alternate at least 4,000 ft different (CAT) or lateral route around the band (mountain wave). If neither works, delay.
- **Mountain Wave component lit up, light GA aircraft, no realistic over-the-top option.** The wave is forecast violently in the rotor under the crest. Re-route to lower terrain or wait for the cross-ridge wind to drop. Never penetrate visible rotor regardless of what the model shows.
- **CAT band at high altitude, low-altitude flight.** Briefing context only. Move on.
- **CIT lit up, convective day.** GTG is showing the convective component, but the actual convective forecast (and current radar / SIGMETs / Convective SIGMETs) is the load-bearing product for convection. GTG CIT is a hint; convective products are the answer.

## Related products

- [airmet](../airmet/page.md) -- AIRMET Tango is the regulatory advisory for moderate non-convective turbulence below FL180. GTG is the spatial picture behind the polygon; read them together.
- [sigmet](../sigmet/page.md) -- when GTG paints severe turbulence widespread, a SIGMET (severity tier above AIRMET) is the regulatory wrap. Severe / extreme turb that isn't convective triggers a SIGMET.
- [pirep](../pirep/page.md) -- the truth-up. A GTG green area with multiple moderate PIREPs is the PIREPs' world. File reports that confirm or refute the forecast.
- [winds-temps-aloft](../winds-temps-aloft/page.md) -- cross-ridge wind speed at ridge-top altitude is the mountain-wave trigger; jet-core speed and shear above and below set the CAT bands. Read winds aloft alongside GTG to validate the synoptic ingredients.
- [gfa](../gfa/page.md) -- Graphical Forecasts for Aviation displays GTG alongside AIRMETs, ceilings, visibility, and surface analysis on one map. The integrated briefing surface.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Turbulence Forecast / Graphical Turbulence Guidance chapter (product spec, severity scale, component layer definitions, valid times).
- **AIM** -- 7-1-23 Turbulence (intensity definitions and PIREP weighting against which GTG severity is calibrated).
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter 19 Turbulence (CAT, mountain-wave, and convective turbulence physics that the GTG component layers represent).
- **aviationweather.gov/data/turbulence** -- AWC turbulence product home.
- **aviationweather.gov/gtg** -- direct GTG viewer: flight-level slider, component toggle, valid-time stepper.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the turbulence types that GTG's component layers represent, see:

- [Turbulence Types and Causes](../../../../knowledge/weather/turbulence-types/node.md)

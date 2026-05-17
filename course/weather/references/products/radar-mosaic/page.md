---
id: wx-ref-radar-mosaic
title: Radar Mosaic (NEXRAD)
short_code: RADAR
category: radar-sat
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Radar / Convective Weather chapter'
    note: 'Authoritative product catalog for WSR-88D NEXRAD mosaics: base reflectivity, composite reflectivity, echo tops, VIL, storm-relative velocity, and the dBZ color scale.'
    verified: true
  - source: AIM
    section: '7-1-11 (Weather Radar Services) and 7-1-26 (Thunderstorms)'
    note: 'Operational role of ground-based radar in flight planning, FIS-B NEXRAD age limitations, and the PIREP feedback loop that confirms radar-implied hazards.'
    verified: true
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Radar chapter'
    note: 'Modern pilot-pitch treatment of WSR-88D products, beam geometry, anomalous propagation, bright-band artifacts, and the difference between base and composite reflectivity.'
    verified: true
related_knowledge_nodes:
  - wx-thunderstorm-hazards
related_products:
  - convective-sigmet
  - sigmet
  - airmet
  - pirep
  - satellite
---

# Radar Mosaic (NEXRAD)

> The real-time convective picture: a stitched view of WSR-88D returns across CONUS that tells you where the precipitation is, how intense it is, how tall the storms are, and which way they are moving.

## What it is

A composite image built by stitching together returns from the WSR-88D NEXRAD radar network -- 160-some sites across CONUS plus coverage in Alaska, Hawaii, Guam, and Puerto Rico -- into a single seamless mosaic. The mosaic ships as several distinct products driven by the same underlying volume scans, each answering a different question. **Base reflectivity** shows the precipitation intensity at the lowest scan tilt (about 0.5 degrees), which is closest to what is falling at the ground. **Composite reflectivity** shows the maximum return found anywhere in the vertical column above each pixel, which surfaces hail and strong updraft cores that the base tilt misses. **Echo tops** depict the highest altitude at which precipitation is detected, in hundreds of feet MSL -- the vertical extent of each cell. **VIL** (vertically integrated liquid) sums the liquid water content of the column and is a hail-likelihood proxy. **Storm-relative velocity** subtracts cell motion to expose rotation and microburst signatures, the products that drive tornado and downburst warnings.

The mosaic is available on aviationweather.gov, on every major EFB (ForeFlight, Garmin Pilot, FltPlan Go), and in the cockpit via ADS-B FIS-B (CONUS-wide and regional NEXRAD layers). On the ground the data updates at the volume-scan cadence (4-6 minutes); in the cockpit via FIS-B it arrives with additional latency, typically 5-15 minutes from observation. The mosaic is the single best real-time check on the convective picture the AIRMET / SIGMET / Convective SIGMET text products are forecasting.

## When you read it

- **Preflight, late in the briefing flow.** The synoptic charts (surface analysis, prog) frame the day; the AIRMETs, SIGMETs, and Convective SIGMETs flag where hazards are likely; the radar mosaic confirms (or contradicts) the current state of convection right now. Read it after the text and chart hazard products, not before -- the mosaic is the "is it actually happening?" check.
- **Continuously en route, especially with FIS-B.** Radar is the one weather product that changes meaningfully every six minutes. A pilot flying through a convectively active area who is not refreshing radar is flying with a stale picture. FIS-B NEXRAD in the cockpit closes the loop between the briefing-time forecast and the present-moment reality.
- **The decision it informs.** Go/no-go on a convective day. Route selection (which side of the line do I deviate around?). Altitude planning relative to echo tops. Tactical "land and wait" when a cell builds into the planned route. Confirmation that a Convective SIGMET polygon actually contains active convection (sometimes it does not; sometimes the activity has shifted out of the polygon and the next polygon is not yet issued).
- **What it does NOT replace.** Radar shows precipitation only. Clear-air turbulence, in-flight icing in stratus, mountain wave, and fog all return zero on the screen. The text hazard products (AIRMET / SIGMET / G-AIRMET / Icing / Turbulence) cover what radar cannot see.

## How to read it

The mosaic is dense: pick which product layer you are reading first, then walk the colors, motion vectors, and echo tops in order. Reading two layers at once before either one is decoded is the fastest way to misread the picture.

### dBZ color scale (base / composite reflectivity)

Reflectivity is reported in decibels relative to Z (dBZ), a logarithmic scale of the radar return strength. The standard NWS / aviation color ramp groups dBZ into bands that map cleanly to operational categories.

| dBZ band     | Color       | Operational meaning                                                                     |
| ------------ | ----------- | --------------------------------------------------------------------------------------- |
| < 15 dBZ     | Light blue  | Drizzle, very light rain, cloud-particle return. Often dry / virga.                     |
| 15 to 20 dBZ | Blue / cyan | Light precipitation. Stratiform rain, light snow. No convective concern.                |
| 20 to 30 dBZ | Green       | Light to moderate precipitation. Steady rain, building cumulus. Bumpy but flyable IFR.  |
| 30 to 40 dBZ | Yellow      | Moderate precipitation. Active showers and weak thunderstorms. Begin avoidance posture. |
| 40 to 50 dBZ | Orange      | Heavy precipitation. Strong thunderstorms. Hold the 20 NM rule.                         |
| 50 to 60 dBZ | Red         | Very heavy rain, hail likely, strong updraft. Avoid by margin, not by line.             |
| >= 60 dBZ    | Magenta     | Large hail, severe updraft. Tornado or significant downburst risk. Stay well clear.     |

Two operational rules read directly off the color ramp. First, the 20 NM avoidance distance from AC 00-24C engages at orange (40 dBZ); anything yellow or stronger is a thunderstorm by radar definition. Second, magenta is not "the same as red, only more." It is a categorically different threat -- large hail and severe updraft -- and a pilot who treats it as "just bigger red" is reading the chart wrong.

### Product layers and what each one is for

| Layer                   | What it shows                                            | When you read it                                                    |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Base reflectivity       | Lowest tilt (~0.5 deg), closest to surface precipitation | Default scan, ground-truth for "what is falling at the airport."    |
| Composite reflectivity  | Maximum dBZ in the full column above each pixel          | Reveals upper-altitude hail cores that base tilt cannot see.        |
| Echo tops               | Top of detected precipitation, in hundreds of feet MSL   | Vertical extent. "Tops to FL450" is a different decision than 25k.  |
| VIL                     | Vertically integrated liquid water content               | Hail-likelihood proxy. Used together with composite reflectivity.   |
| Storm-relative velocity | Doppler velocity minus average cell motion               | Rotation signatures (mesocyclone), microburst couplets.             |
| Storm motion vectors    | Direction-and-speed arrows on each cell                  | Project the cell forward to your route, your destination, your ETA. |
| Range rings             | Concentric circles centered on each NEXRAD site          | Beam-geometry sanity check. See gotchas.                            |

### Reading order

1. **Pick the product layer that answers your current question.** Composite for "is there a hail core hiding above the base tilt?"; base for "what is falling at my destination right now?"; echo tops for "can I top this with margin?"
2. **Find the strongest colors on or near your route.** Where are the oranges, reds, and magentas? Trace the polygon those colors fall inside.
3. **Read the storm motion vectors.** Direction and speed give you the cell's track. Project it forward by the time it will take you to reach the conflict point.
4. **Check echo tops along the route corridor.** Compare to your planned cruise altitude band. A cell with tops at FL420 and a planned cruise at 8,000 is a different decision than tops at 15,000 over the same line.
5. **Cross-check against the Convective SIGMET / AIRMET polygons.** Does the radar agree with the text? If the text flags an area and the radar is empty, the activity has not yet developed or has moved -- check the polygon's valid time. If the radar shows reds and magentas outside any active polygon, a new SIGMET may be in the pipeline; treat the area as hazardous.
6. **One operational sentence.** "Squall line through KSTL at 22Z, magenta core, tops FL500, moving east at 35 kt -- no transit, land at KCOU and wait." If you can land on a sentence like that, you have read the mosaic.

## Annotated example(s)

### Example 1 -- Mature squall line across the Mississippi Valley

The composite reflectivity mosaic, valid 22Z on a spring afternoon, shows a line of cells running roughly north-south from southern Wisconsin through Iowa, Missouri, and Arkansas, curving slightly back to the southwest into east Texas. The line is continuous on the chart for almost 900 NM. Along most of its length the colors stack from green on the eastern edge (the leading anvil drizzle), through yellow and orange in the middle, to red and magenta cores embedded every 30-60 NM along the spine. Half a dozen distinct magenta cells punch the line, the strongest one centered over St. Louis showing a tight magenta core surrounded by a red collar. The echo-tops layer, switched on, shows tops in the 50,000 to 55,000 ft band for the magenta cores, with 35,000 to 45,000 ft tops over the orange and red sections. Storm-motion arrows on each cell point east at 35 kt; the line as a whole is translating east at roughly the same speed.

What the pilot reads from this picture: the line is not gappy. The cells are linked through the yellow and orange precipitation between them, and the gaps that exist are filling in the cell-motion-relative sense as new cells develop on the southwest end. No safe penetration anywhere along 900 NM of line. Echo tops in the magenta cores are well above any non-pressurized aircraft service ceiling and at or near the service ceiling of pressurized GA twins -- topping the line is not on the table either. The line is moving east at 35 kt, which means an airfield 70 NM east of the current line position will be in the convective zone in two hours. A VFR flight planned westbound across the line is a "land and wait" decision. A flight east of the line has roughly the cell-distance-divided-by-35-kt window before the line arrives at the destination. The 20 NM rule from AC 00-24C engages from the leading edge of the orange band, not the magenta core -- magenta plus the surrounding red is already inside the exclusion zone for hail-throw distance. The operational sentence: "Linear convection MN through TX, magenta cores tops FL550, moving east at 35 kt -- no penetration, no top, plan to stop and wait if conflicted."

### Example 2 -- Afternoon air-mass thunderstorms over the Florida peninsula

The composite reflectivity mosaic, valid 20Z on a July afternoon, shows the Florida peninsula peppered with scattered, isolated cells. Roughly fifteen distinct cells dot the interior of the state from Lake Okeechobee north through Orlando and Gainesville, with another half-dozen along the west coast sea-breeze line and a smaller cluster on the east coast. Each cell is its own small island of color: a magenta or red core no more than 5-10 NM across, surrounded by orange, then yellow, then a brief green halo before fading to background. Between cells the chart is empty -- not green, not blue, just clear. The echo-tops layer shows tops to 40,000 to 45,000 ft over the magenta cores and 25,000 to 35,000 ft over the less-developed cells. Storm-motion arrows are short -- 5 to 10 kt -- and point inconsistently in different directions, some northeast, some east, some nearly stationary.

What the pilot reads from this picture: this is the air-mass thunderstorm formation, not a frontal system. There is no line, no organization, no synoptic boundary forcing the cells. Each cell stands or falls on its own buoyancy. The cells are slow-moving, which is bad in one sense (they hover over a fixed point) and good in another (you can plan around them in advance because they will not run you down). The empty space between cells is large enough to fly through with the 20 NM rule honored from every active cell -- a VFR flight from Tampa to Jacksonville can pick a route that threads the inter-cell gaps if it stays alert and willing to deviate. But the cells are growing and decaying on a 30-90 minute life cycle; an empty gap at 20Z may have a new cumulus tower by 21Z. The operational decision is different from the squall line: not "land and wait," but "fly with continuous radar refresh, pre-plan a divert airport every 30 NM, and accept that the route as planned will not survive contact with the airspace." The operational sentence: "Scattered air-mass convection over Florida, tops FL450, slow-moving -- transit feasible with continuous monitoring and pre-planned diverts; abort to ground if cells organize."

## Common gotchas

- **Radar shows PRECIPITATION, not turbulence and not icing.** A clean screen does not mean smooth and clear. Clear-air turbulence, mountain wave, jet-stream shear, and freezing rain at a warm-front overrun all return zero dBZ. The radar tells you where the rain and the hail are; AIRMETs / SIGMETs / G-AIRMET turbulence / G-AIRMET icing tell you about the hazards the radar cannot see. Cross-check both.
- **Base reflectivity misses storm tops.** The lowest tilt looks at the air below the cell core. A pilot reading base who sees yellow at the surface can be flying under a red or magenta core aloft. For vertical structure, switch to composite reflectivity and/or echo tops. The "yellow on base, red in the column" mismatch is exactly how the onboard-radar "green echo can hide a yellow cell at altitude" trap (per the thunderstorm-hazards knowledge node) applies to ground-based radar as well.
- **FIS-B NEXRAD is delayed.** The cockpit image is typically 5-15 minutes old. The age indicator on the EFB / MFD is load-bearing -- read it. Treat the FIS-B picture as historical, not current. For in-cockpit avoidance, give every cell extra room beyond the 20 NM rule to account for the cell's motion during the latency window. AIM 7-1-22 documents the latency; AC 00-24C and AIM 7-1-27 fold it into the strategic-versus-tactical rule (datalink NEXRAD is strategic; use it for the next-hour decision, not the next-three-minute decision).
- **Beam blockage in mountainous terrain.** The WSR-88D beam travels in a straight line through air that curves around the Earth, but mountains do not let it pass. Behind tall terrain, the radar simply cannot see -- a "shadow" sector with no return. The west, the Rockies, and parts of the Appalachians have known blocked sectors. A clear screen behind a known blockage is not evidence of clear air; it is evidence the radar cannot tell. Check the next adjacent site or, ideally, satellite.
- **Bright-band artifacts at the melting layer.** Snow falling through 0 deg C melts into rain, and the wet snowflakes are large with a high refractive index -- they return very brightly to the radar for the few hundred feet of the melting layer. The result is a thin ring of high dBZ centered on each radar site at the range corresponding to the freezing-level altitude. Pilots seeing this read it as "active convection" when it is in fact stratiform rain with a melting layer. Bright bands sit at fixed ranges from each site, are uniform, and do not have motion vectors or echo tops -- if a "cell" has those tells, treat it as artifact.
- **Anomalous propagation (AP).** Unusual atmospheric refraction can bend the radar beam down into terrain or sea surface and return ghost echoes that look like precipitation. AP is most common at night in stable air with a strong temperature inversion. AP echoes are usually low (under 10,000 ft), have no echo-tops correlation, and persist in shapes that follow terrain rather than wind. If a return looks "stuck" to a coastline or a ridge and does not move with the wind field, it is probably AP.
- **Range rings and beam height.** The WSR-88D's 0.5 deg tilt rises with range -- at 100 NM from the site the beam is roughly 7,000 ft above the ground; at 200 NM it is roughly 25,000 ft. At long range from the nearest site, base reflectivity is reading the middle of the troposphere, not the surface. The mosaic stitches multiple sites together to reduce this effect, but in remote regions (eastern Montana, western Texas, the Dakotas-Idaho gap) the nearest site can be over 100 NM away and the picture is compromised.
- **Storm motion vectors are averages.** The arrow shows the cell's translation, not the wind. A cell propagating to the south by new-cell formation on its southern flank can read as "moving south" on the vector while every individual cell within it is moving northeast. For squall lines especially, read the motion of the line as a whole, not the motion of any single cell within it.

## Triage

When you have 60 seconds to scan the radar mosaic, the questions are:

- **Where are the reds and magentas?** Trace the route corridor and ask which cells you will pass within 20 NM of, given current cell motion and your ETA at each conflict point.
- **What is the motion vector telling you?** Will the cell intersect your route while you are on it, or will it move out of the way before you arrive? Will it move into your destination's terminal area before you land?
- **When will the cells be at the airfields along your route?** Pre-plan a divert. If the line is 70 NM east of an airfield moving east at 35 kt, that airfield has two hours.
- **Echo tops above your altitude band?** If yes, topping is not a deviation strategy. Plan around laterally or land and wait.
- **On FIS-B, mentally project the radar age forward.** A 10-minute-old image of a 35-kt squall line is showing the cells 6 NM behind their current position. Treat the leading edge as 10-20 NM further along the motion vector than the picture shows.
- **One operational sentence.** "Squall line through STL at 22Z, magenta core, tops FL500, moving east at 35 kt -- no transit, divert to KCOU." That sentence is the read.

## Related products

- [Convective SIGMET](../convective-sigmet/page.md) -- the text hazard product that flags lines, areas, and isolated severe convection. Pair the polygon with the radar to confirm activity is where the text says it is.
- [SIGMET](../sigmet/page.md) -- non-convective severe hazards (severe icing, severe / extreme turbulence, dust, volcanic ash). Radar does not show these; SIGMETs do.
- [AIRMET](../airmet/page.md) -- moderate hazards over broad areas (IFR ceilings, mountain obscuration, moderate icing / turbulence). The radar's clear sectors do not rule out AIRMET hazards.
- [PIREP](../pirep/page.md) -- pilot reports of actual conditions encountered. The feedback loop on radar-implied hazards: "tops FL450" on echo tops gets confirmed (or contradicted) by a PIREP of "tops FL500" from a transiting aircraft.
- [Satellite](../satellite/page.md) -- complementary view. Where radar is blocked by terrain or beyond range, IR and visible satellite still see cloud tops; together they fill each other's gaps.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Radar / Convective Weather chapter. Authoritative product catalog for WSR-88D NEXRAD mosaics: base reflectivity, composite reflectivity, echo tops, VIL, storm-relative velocity, and the dBZ color scale.
- **AIM 7-1-22** -- Weather Radar Services. Operational role of ground-based radar in flight planning and the FIS-B NEXRAD age caveats.
- **AIM 7-1-26** -- PIREP for Thunderstorms. The reporting-back side of the radar / pilot-report feedback loop.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Radar chapter. Modern pilot-pitch treatment of WSR-88D products, beam geometry, anomalous propagation, bright-band artifacts, and the difference between base and composite reflectivity.
- Service docs: [aviationweather.gov/data/radar](https://aviationweather.gov/data/radar) for the aviation product catalog rendering; [nexrad.weather.gov](https://nexrad.weather.gov/) for the canonical NWS NEXRAD viewer with full product layers.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the convective decisions this product feeds, see:

- [Thunderstorm Hazards](../../../../knowledge/weather/thunderstorm-hazards/node.md) -- the cell life cycle, the six classical hazards, the 20 NM avoidance rule, and the strategic-versus-tactical use of datalink NEXRAD.

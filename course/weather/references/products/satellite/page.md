---
id: wx-ref-satellite
title: Satellite Imagery (chart)
short_code: SAT
category: radar-sat
tier: 2
status: draft
authoritative_sources:
  - source: AC 00-45H
    section: 'Aviation Weather Services, Satellite Imagery chapter'
    note: 'Authoritative channel definitions (visible, infrared, water vapor), enhancement curves, and product cadence.'
  - source: AIM
    section: '7-1 -- National Weather Service Aviation Products'
    note: 'Operational role of satellite imagery in the preflight briefing flow.'
  - source: FAA-H-8083-28
    section: 'Aviation Weather Handbook, Satellite chapter'
    note: 'Modern pilot-pitch treatment of GOES channels, cloud-top temperature interpretation, and synoptic pattern recognition.'
related_knowledge_nodes:
  - wx-clouds-and-precipitation
related_products:
  - radar-mosaic
  - surface-analysis
  - prog-chart
  - convective-sigmet
  - gfa
---

# Satellite Imagery (chart)

> The top-down view of the cloud field. Visible imagery shows what the sky looks like from space by day; infrared shows cloud-top temperature day and night; water vapor shows mid-to-upper atmospheric moisture and the structure of the jet stream.

## What it is

Imagery from the GOES (Geostationary Operational Environmental Satellite) constellation, parked 22,236 NM above the equator, sweeping CONUS, Alaska, Hawaii, and adjacent oceans. Three primary channels are the bread-and-butter of an aviation briefing: **visible** (reflected sunlight, daytime only), **infrared** (cloud-top temperatures, day and night), and **water vapor** (mid-to-upper-tropospheric moisture, day and night). The imagery is updated every 5-15 minutes depending on the sector and scan mode; the CONUS sector ships frequent refresh while full-disk takes longer. The product is a raster image, not encoded text. At synoptic scale it shows cloud cover, storm structure, frontal cloud bands, and moisture distribution; at mesoscale it picks out convection development, overshooting tops, and dry slots before any other product reacts.

## When you read it

- **Preflight, paired with the surface analysis.** The analysis says where the pressure centers and fronts are; satellite imagery confirms the synoptic story by showing the cloud signature that those features actually produced. If the analysis shows a deep low over Hudson Bay and visible imagery shows the comma-cloud spiral exactly where the low is drawn, the two products agree and the brief is internally consistent. If they disagree, trust the imagery (it is the observation; the chart is the interpretation).
- **Convection nowcasting before radar lights up.** Visible imagery picks up cumulus growth and towering cumulus 30-60 minutes before precipitation forms and the radar mosaic registers an echo. Watching the visible loop on a humid afternoon is the earliest signal that an air-mass thunderstorm cycle is starting.
- **Upper-level dynamics on the water vapor channel.** Jet stream cores, upper-level troughs, and dry slots are visible on water vapor imagery and nowhere else without specialty charts. Bright-to-dark gradients trace the jet; dark slots wrap into developing cyclones during rapid deepening.
- **The decision it informs.** Go/no-go on the synoptic frame (is the cloud field where the analysis says it should be?), route selection (which side of a cloud band has the open sky?), convective avoidance (where is the next pop-up cell forming?), and a sanity check on every downstream product.

## How to read it

The three channels each answer a different question. Reading satellite imagery well means choosing the right channel for the question you have, then interpreting brightness correctly within that channel.

### The three channels

| Channel       | What it measures                                        | Bright pixels mean                                           | Dark pixels mean                                                | Available     |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | ------------- |
| Visible       | Reflected sunlight from cloud tops and surface          | Thick, reflective cloud (CB, dense cirrus, fresh snow)       | Thin cloud, water surface, or no cloud                          | Daytime only  |
| Infrared (IR) | Emitted longwave radiation (cloud-top temperature)      | Cold tops (high CB tops, dense cirrus shields)               | Warm tops (low stratus, surface, dark land at night)            | Day and night |
| Water vapor   | Mid-to-upper tropospheric moisture (roughly 600-300 mb) | Moist mid-upper troposphere (humid air, jet entrance region) | Dry mid-upper troposphere (dry slot, jet stream sinking branch) | Day and night |

### Visible imagery

Visible is the channel that looks the most like a photograph. Brightness is reflectance: thick clouds with lots of small water droplets or ice crystals scatter sunlight efficiently and look bright white. Thin cirrus, low stratus over dark water, and the surface itself look gray or dark. Cumulus and CB tops are bright with sharp edges and texture; stratus is bright but flat and featureless. Snow on the ground also looks bright white, which is the daytime trap (see gotchas).

The morphology of the visible field is diagnostic. Lumpy texture with shadows says cumulus / towering cumulus (vertical development with sun angle casting shadows on the cloud field). Smooth uniform white says stratus or fog (no vertical development). A swirl of cloud around a clear or partly clear center says a midlatitude cyclone. A line of cumulus along a curving boundary says a front.

### Infrared imagery

IR maps cloud-top temperature into brightness. The colder the top, the brighter the pixel. Because temperature decreases with altitude through the troposphere, IR is effectively a cloud-top altitude map: the higher the top, the colder it is, the brighter it appears. Standard IR imagery uses a grayscale where warm = dark, cold = bright; enhanced IR adds a color table at specific temperature thresholds to flag CB-scale tops (commonly red or yellow bands at very cold thresholds for overshooting tops near or above the tropopause).

Reading IR well means thinking in temperature. A cumulonimbus top at -60 to -70 deg C (above 35,000 ft in summer midlatitudes) lights up bright white or enhancement red. A low stratus deck at +5 deg C (a few thousand feet AGL) is dark gray, indistinguishable from the surface. Cirrus blow-off downstream of a CB shares the CB's coldness and lights up almost as bright, even though it is not the active storm core.

### Water vapor imagery

Water vapor channel imagery measures emission from a 6.7-micron band that mid-to-upper-tropospheric water vapor absorbs and re-emits. The image is not a cloud picture; it is a moisture picture for that altitude band. Bright pixels are moist air at 600-300 mb; dark pixels are dry air at the same level (the satellite is seeing further down into the troposphere where less water vapor blocks the view, and reading warmer air).

The operational signal on water vapor is structure, not intensity. The jet stream traces along the boundary between bright (moist) and dark (dry) regions; the polar-front jet sits on the south edge of bright cold-side air against dark warm-side air. Upper-level troughs show as bright moisture surges curling toward the equator. Dry slots wrapping into a developing low signal rapid cyclogenesis and an active jet-stream coupling. None of this shows on visible or IR.

### Channel triage

| Question                                              | Channel      | Why                                                               |
| ----------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| Where is the cloud field at synoptic scale (daytime)? | Visible      | Direct photographic view; texture distinguishes cloud types.      |
| Are there overshooting tops on this storm?            | Enhanced IR  | Coldest pixels flag CB tops near or through the tropopause.       |
| Is this nighttime activity convective or stratiform?  | IR           | IR works at night; cold tops mean deep convection.                |
| Where is the jet stream right now?                    | Water vapor  | Brightness gradient traces the jet; visible and IR don't show it. |
| Is the cloud over my route thick CB or thin cirrus?   | Visible + IR | Visible separates thick from thin; IR confirms top altitude.      |

## Annotated example(s)

### Example 1 -- Daytime visible image of a maturing midlatitude cyclone

The image, a daytime visible scan over the northern Plains and Upper Midwest, shows the textbook **comma cloud** signature of a maturing extratropical cyclone. The "head" of the comma is a bright white circular swirl centered over eastern North Dakota, with cloud spiraling counterclockwise inward toward an L-shaped open center where the surface low pressure is located. The "tail" of the comma is a long, narrow cloud band sweeping southeast from the head, tracking down through Iowa, Missouri, and Arkansas before fading into broken cumulus over east Texas. The cloud band is bright white and continuous along its full length, with sharp lumpy texture on its leading (eastern) edge.

To the east of the comma tail, the **warm sector** is visible as a region of mostly clear sky over Illinois, Indiana, and western Ohio, with scattered fair-weather cumulus dotting the field. To the west of the comma head, behind the system, the sky is mostly clear with patches of post-frontal stratocumulus over the high plains -- a sign that cold dry air has scoured the back side of the low.

The pilot reads this picture by pairing it directly to the surface analysis: the bright spiral head sits where the analysis draws the L; the bright comma tail sits where the analysis draws the cold front; the open warm sector sits where the analysis shows the warm sector between the warm and cold fronts. The two products agree. The visible image then tells the pilot two things the analysis cannot: the cloud field is **active** along the cold front (sharp lumpy edge, towering cumulus building -- this is a convectively active frontal band, not a quiet stratiform overrun), and there is **flyable VFR sky** in the warm sector ahead of the front for the next several hours until the front arrives.

### Example 2 -- Nighttime enhanced IR of a developing MCS over the central US

The image, a nighttime enhanced IR scan over the central Plains, shows a **mesoscale convective system (MCS)** organizing over Kansas, Oklahoma, and northern Texas. The enhancement color table is configured so that cloud tops colder than -60 deg C show as a red-orange band, tops colder than -70 deg C show as a yellow band, and the very coldest tops above -75 deg C are flagged in white inside a yellow ring -- the **overshooting top** signature.

The MCS appears as a roughly circular cluster of bright white IR cloud roughly 300 NM across, with a clear cold-tops gradient: warm gray on the outer fringe (mid-level cloud and anvil edge), red-orange ring inside that (the deep convective anvil at flight-level cold temperatures), and a cluster of yellow patches with white-and-yellow overshooting-top signatures grouped on the southwest quadrant of the cluster. The overshooting tops mark where the strongest updrafts are punching through the equilibrium level into the stratosphere -- those are the parent cells driving the system.

Pair this picture to the radar mosaic: the radar shows the precipitation echo and the storm-relative motion vectors, which together with the IR overshooting-tops tell the pilot which cells are the most dangerous active cores. The IR alone tells you the storm is alive and which quadrant the active updrafts are working in -- at night, when visible imagery is dark and useless, IR is the only channel that gives the convective story above radar's surface-level precipitation view. The operational decision is the same as any active MCS: stay clear by at least 20 NM, do not fly under the anvil (downdraft hazards extend well past the cores), and watch the IR loop for upstream new-cell development before the radar registers the new echo.

## Common gotchas

- **Visible is useless at night.** No sun, no reflected sunlight, no image. Switch to IR after sunset and back to visible after sunrise; the transition takes about 30 minutes on either end. Many EFB apps show a black or blank visible image at night rather than auto-switching to IR -- if you see a black image and assume "clear skies," you have misread the product.
- **IR brightness is temperature, NOT precipitation.** Cold thin cirrus blow-off downstream of a CB can look as bright on IR as the CB top itself, even though the cirrus is harmless and the CB is the active storm. Always cross-check IR brightness against the radar mosaic for echoes; bright IR + radar echo = active core, bright IR + no radar echo = cirrus or anvil debris.
- **Water vapor channel is mid-upper level only.** It shows moisture at roughly 600-300 mb, not at the surface. Low fog, marine stratus, and near-surface haze are invisible to the water vapor channel even when they are choking VFR at the airport. Use visible / IR and the surface analysis for the low-altitude moisture story.
- **Geostationary parallax distorts cloud positions at high latitudes and low elevations.** GOES sits over the equator, so its view of clouds at 50 N or 60 N is at a shallow slant. A tall CB top appears displaced poleward from where its base actually is on the ground; in Alaska the displacement can be tens of NM. Pair the imagery with the radar mosaic (which has no parallax error at the surface) to anchor true ground position.
- **Satellite cloud cover is not the same thing as the SKY group in a METAR.** A METAR's sky condition (FEW, SCT, BKN, OVC) is a ground-up human or ASOS observation at the airport itself, reporting clouds the observer sees overhead. Satellite is a top-down view of cloud cover at the regional scale. A station can report `CLR` on the surface while satellite shows broken cirrus several thousand feet above; the cirrus is too thin or too high to enter the METAR but is visible from space. Conversely, satellite can show a region of "cloud" that is actually fog or marine stratus that the METAR is correctly reporting as `BKN003` with prevailing visibility 1/2 SM. Read each product for what it reports.
- **Image timestamps are Zulu.** Match the imagery valid time against the time you expect to be flying. A 30-minute-old loop is still useful; a 3-hour-old still frame is stale.
- **Visible imagery looks "thicker" in winter because of snow cover.** Fresh snow on the ground reflects sunlight as efficiently as a cloud top, and bright snow on the ground can be mistaken for a low overcast. Cross-check with the surface analysis (no front means no overcast band) and with IR (snow on the ground is warm and dark on IR; low cloud is colder and brighter).

## Triage

When you have 60 seconds to scan satellite imagery, the questions are:

- **Which channel answers my current question?** Daytime synoptic story -> visible. Nighttime convective intensity -> enhanced IR. Upper-level dynamics or jet stream -> water vapor. Picking the wrong channel wastes the scan.
- **Does the cloud field agree with the surface analysis?** The comma head should sit on the L. The frontal cloud band should sit on the front. The warm sector should be the clear gap. If the imagery and analysis disagree, trust the imagery and assume the analyzed front position is a few hours stale.
- **Where is the convection, and is it growing or decaying?** Visible loop or IR loop, watching 2-3 frames. New cumulus appearing means active growth (build a buffer). Anvils spreading downwind with no new updraft pulses means decay (less risk on the back side, still hazardous under the anvil).
- **One operational sentence.** "Comma-cloud cyclone over the Dakotas with active cold-frontal cumulus through Iowa, warm sector clear over Illinois until 22Z." Land on a sentence like that and the imagery scan has done its job. Everything else fits inside the frame.

## Related products

- [Radar mosaic](../radar-mosaic/page.md) -- the convective truth at the surface. Pair with satellite IR for cells (echo + cold top = active core); pair with visible for early cumulus growth before any echo appears.
- [Surface analysis](../surface-analysis/page.md) -- the synoptic frame the imagery confirms or contradicts. Always read these two products as a pair.
- [Prog chart](../prog-chart/page.md) -- the forecast surface analysis. The satellite loop tells you whether the prog's predicted feature is actually showing up on schedule.
- [Convective SIGMET](../convective-sigmet/page.md) -- the formal hazard advisory issued when MCS or line-convection thresholds are met. Bright IR cold tops + radar echoes + Convective SIGMET coverage = a single converging picture.
- [GFA](../gfa/page.md) -- Graphical Forecasts for Aviation layer cloud cover, ceilings, and convective forecasts over the same geography. Satellite gives the now, GFA gives the next several hours.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, Satellite Imagery chapter. Channel definitions (visible, infrared, water vapor), enhancement curves, product cadence, and operational interpretation guidance.
- **AIM 7-1** -- National Weather Service Aviation Products. Operational role of satellite imagery in the preflight briefing flow and the family of products it ships alongside.
- **FAA-H-8083-28** -- Aviation Weather Handbook, Satellite chapter. Modern pilot-pitch treatment of GOES channels, cloud-top temperature interpretation, and synoptic pattern recognition (comma cloud, MCS, jet-stream cirrus).
- Service docs: [aviationweather.gov/data/satellite](https://aviationweather.gov/data/satellite) for the aviation product catalog satellite viewer; [goes-r.gov](https://www.goes-r.gov/) for the GOES-R / GOES-18 / GOES-19 program documentation and channel-by-channel detail.

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of the underlying meteorology, see:

- [Clouds, Temperature/Moisture, and Precipitation](../../../../knowledge/weather/clouds-and-precipitation/node.md) -- the cloud-family taxonomy and stability-from-morphology diagnostic that lets a pilot read a satellite image and reason about what is actually happening in the column.

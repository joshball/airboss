# frontal-pressure-march -- truth-aware commentary

Truth valid at: `2026-03-14T12:00:00Z`

Accelerating cold front under pilot time pressure, central Kansas. A March cold front sweeps ESE across the route; it starts at 15 kt, accelerates to 22 then 28 kt, and intensifies from moderate to strong by 1600Z. Pre-frontal convection appears 60 nm ahead of the boundary at 1500Z. The TAF issued before the window forecasts the front at its slower initial speed, so the actual METARs show the front arriving earlier than predicted.

## Callouts (5)

### wxc-frontal-pressure-march-front-crossing-KDDC -- metar (KDDC)

**Mode:** socratic

**Question:** What changed at KDDC when the cf-1 front passed -- compare its METAR to the warm-sector stations.

**Observation:** KDDC now sits in the cP mass (T5C / Td-3C, wind 320/20, stable); the warm-sector stations report the mT mass (T16C / Td12C, wind 190/13, conditionally-unstable).

**Reason:** The cf-1 front (cold, intensity moderate, moving 110deg at 15 kt) has already crossed KDDC. The cP air now over the field replaces the mT sector that was there before passage: temperature drop 11C, dewpoint drop 15C, wind shift from 190deg to 320deg. Every change traces back to one event: a different air mass is now over the field.

**References:** `wx-airmasses-and-fronts`, `wx-reading-metars`

### wxc-frontal-pressure-march-pre-frontal-warm-sector-KICT -- metar (KICT)

**Mode:** socratic

**Question:** Why are KICT's winds 190/13 on a pre-frontal afternoon?

**Observation:** KICT METAR carries the mT signature: T16C / Td12C, wind 190/13.

**Reason:** KICT sits in the mT warm sector ahead of cf-1. Surface flow circulates around L-nebraska (998mb) to the north, drawing southerly air up from the source region -- hence the 190/13 wind. The pre-frontal pressure gradient between L-nebraska (998mb) and the downstream high tightens as the front approaches; that's why the wind speed is non-trivial despite the calm-feeling warm-sector skies.

**References:** `wx-wind-systems`, `wx-airmasses-and-fronts`

### wxc-frontal-pressure-march-post-frontal-gust-KDDC -- metar (KDDC)

**Mode:** socratic

**Question:** Why is KDDC still gusting on a clear post-frontal afternoon -- shouldn't the gusts have died with the sun?

**Observation:** KDDC's METAR carries the cP post-frontal wind: 320/20 with gusts driven by the post-frontal pressure rise.

**Reason:** Two sources keep the gusts active even after sunset. (1) L-nebraska (998mb) is deepening; isobars pack tighter behind a deepening trough, so the geostrophic wind speeds up as the cold-sector pressure rise meets the low's pressure fall. (2) Cold advection in the cP sector keeps the boundary layer well-mixed: mid-level momentum keeps coupling down to the surface as gusts. The "gusts die at sunset" heuristic applies in stable air; in active cold advection behind the cf-1 front it does not.

**References:** `wx-wind-systems`, `wx-airmasses-and-fronts`

### wxc-frontal-pressure-march-isobar-gradient -- chart-feature (isobar-pack)

Pinned to chart `wx-scenarios/frontal-pressure-march/surface-analysis`.

**Mode:** glance

**Question:** Where are the isobars packed tightest on the surface analysis, and what does that tell you about wind speed?

**Observation:** Count the isobars between L-nebraska (998mb) and H-southeast (1024mb) -- a 26mb delta across the synoptic frame.

**Reason:** Tight isobars equal a steep pressure gradient equal strong wind. The 26mb spread between L-nebraska and H-southeast is bridged across the cold-sector envelope; isobars compress where the deepening low draws air toward its center while the high pushes air outward. Surface friction veers the wind ~30deg right of the gradient direction; that's why the post-frontal stations report NW winds rather than pure W.

**References:** `wx-wind-systems`, `wx-chart-type-surface-analysis`, `wx-product-surface-analysis-and-cva`

### wxc-frontal-pressure-march-jet-exit -- fb-row (jet-max-fl)

Pinned to chart `wx-scenarios/frontal-pressure-march/winds-aloft`.

**Mode:** socratic

**Question:** Where is the jet axis on the winds-aloft chart, and what does the exit region predict about turbulence at FL240+?

**Observation:** Jet maximum: 100 kt aloft, axis running from 35.0N/108.0W to 43.0N/92.0W.

**Reason:** The 100-kt jet axis (from 35.0N/108.0W to 43.0N/92.0W) feeds an exit region where ageostrophic flow descends and accelerates on the cold side -- classic clear-air turbulence. On the cP cold sector side of the jet exit, the post-frontal pressure rise downstream of L-nebraska (998mb) reinforces the descent; expect chop concentrated in the FL180-FL280 band aligned with the axis.

**References:** `wx-product-winds-aloft`, `wx-turbulence-types`

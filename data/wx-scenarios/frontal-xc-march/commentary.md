# frontal-xc-march -- truth-aware commentary

Truth valid at: `2026-03-19T19:00:00Z`

Winter frontal passage during a midwest XC, KSTL -> KORD. Synoptic-scale low over the Upper Midwest with a cold front trailing SSE. Pre-frontal warm sector ahead of the front (KSTL/KCPS); post-frontal cold sector behind it (KSPI/KMLI). KORD ahead of the front, will see passage 2-4 hours later.

## Callouts (13)

### wxc-frontal-xc-march-front-crossing-KSPI -- metar (KSPI)

**Mode:** socratic

**Question:** What changed at KSPI when the F-cold-main front passed -- compare its METAR to the warm-sector stations.

**Observation:** KSPI now sits in the cP mass (T4C / Td-3C, wind 320/20, stable); the warm-sector stations report the mT mass (T17C / Td13C, wind 200/14, conditionally-unstable).

**Reason:** The F-cold-main front (cold, intensity strong, moving 110deg at 25 kt) has already crossed KSPI. The cP air now over the field replaces the mT sector that was there before passage: temperature drop 13C, dewpoint drop 16C, wind shift from 200deg to 320deg. Every change traces back to one event: a different air mass is now over the field.

**References:** `wx-airmasses-and-fronts`, `wx-reading-metars-tafs`

### wxc-frontal-xc-march-front-crossing-KMLI -- metar (KMLI)

**Mode:** socratic

**Question:** What changed at KMLI when the F-cold-main front passed -- compare its METAR to the warm-sector stations.

**Observation:** KMLI now sits in the cP mass (T4C / Td-3C, wind 320/20, stable); the warm-sector stations report the mT mass (T17C / Td13C, wind 200/14, conditionally-unstable).

**Reason:** The F-cold-main front (cold, intensity strong, moving 110deg at 25 kt) has already crossed KMLI. The cP air now over the field replaces the mT sector that was there before passage: temperature drop 13C, dewpoint drop 16C, wind shift from 200deg to 320deg. Every change traces back to one event: a different air mass is now over the field.

**References:** `wx-airmasses-and-fronts`, `wx-reading-metars-tafs`

### wxc-frontal-xc-march-pre-frontal-warm-sector-KCPS -- metar (KCPS)

**Mode:** socratic

**Question:** Why are KCPS's winds 200/14 on a pre-frontal afternoon?

**Observation:** KCPS METAR carries the mT signature: T17C / Td13C, wind 200/14.

**Reason:** KCPS sits in the mT warm sector ahead of F-cold-main. Surface flow circulates around L-upper-midwest (996mb) to the north, drawing southerly air up from the source region -- hence the 200/14 wind. The pre-frontal pressure gradient between L-upper-midwest (996mb) and the downstream high tightens as the front approaches; that's why the wind speed is non-trivial despite the calm-feeling warm-sector skies.

**References:** `wx-wind-systems`, `wx-airmasses-and-fronts`

### wxc-frontal-xc-march-post-frontal-gust-KMLI -- metar (KMLI)

**Mode:** socratic

**Question:** Why is KMLI still gusting on a clear post-frontal afternoon -- shouldn't the gusts have died with the sun?

**Observation:** KMLI's METAR carries the cP post-frontal wind: 320/20 with gusts driven by the post-frontal pressure rise.

**Reason:** Two sources keep the gusts active even after sunset. (1) L-upper-midwest (996mb) is deepening; isobars pack tighter behind a deepening trough, so the geostrophic wind speeds up as the cold-sector pressure rise meets the low's pressure fall. (2) Cold advection in the cP sector keeps the boundary layer well-mixed: mid-level momentum keeps coupling down to the surface as gusts. The "gusts die at sunset" heuristic applies in stable air; in active cold advection behind the F-cold-main front it does not.

**References:** `wx-wind-systems`, `wx-airmasses-and-fronts`

### wxc-frontal-xc-march-taf-fm-KORD -- taf-period (KORD)

**Mode:** socratic

**Question:** How does the FM21Z transition in KORD's TAF change your arrival plan?

**Observation:** KORD TAF: `TAF KORD 191820Z 1919/2007 20014KT 6SM BKN045 FM192100 32020G30KT 6SM OVC025`

**Reason:** KORD is currently 66km from the F-cold-main front. The FM group marks the forecast time the F-cold-main reaches the field (motion 110deg at 25kt). After the FM hour the ceiling and visibility drop, the wind veers and gusts, and you're flying through cP air -- denser, drier, colder. Arrive before the FM hour and the airport stays in mT conditions; arrive after and you're landing in the post-frontal regime.

**References:** `wx-reading-metars-tafs`, `wx-airmasses-and-fronts`

### wxc-frontal-xc-march-airmet-sierra-HZ-postfrontal-ifr -- airmet (WAUS41-WXENGINE-HZ-postfrontal-ifr)

Pinned to chart `wx-scenario-frontal-xc-march-airmet-sigmet`.

**Mode:** socratic

**Question:** What does this AIRMET Sierra (HZ-postfrontal-ifr) tell you about ceiling and visibility along the route?

**Observation:** AIRMET Sierra covers HZ-postfrontal-ifr from 0ft to 4000ft MSL; severity moderate. Source: Post-frontal cold-sector IFR: lifted air-mass moisture trapped beneath a stable inversion.

**Reason:** The HZ-postfrontal-ifr hazard zone is a ifr pocket bounded by the synoptic features that produced it (Post-frontal cold-sector IFR: lifted air-mass moisture trapped beneath a stable inversion). The Sierra family triggers on ceiling below 1000ft AGL or visibility below 3SM; inside this polygon those minima are forecast to fail. Three impacts: (1) VFR is locked out under the polygon; (2) the cloud deck is uniform (the same stable inversion that traps the moisture caps it horizontally); (3) the polygon shrinks or grows with the synoptic state -- track the parent feature, not just the AIRMET itself.

**References:** `wx-product-airmets-sigmets`, `wx-fog-and-visibility-obstructions`

### wxc-frontal-xc-march-airmet-tango-HZ-postfrontal-turb -- airmet (WAUS41-WXENGINE-HZ-postfrontal-turb)

Pinned to chart `wx-scenario-frontal-xc-march-airmet-sigmet`.

**Mode:** socratic

**Question:** Where is the AIRMET Tango polygon HZ-postfrontal-turb centered relative to the jet axis -- and what mechanism stacks the turbulence?

**Observation:** AIRMET Tango covers HZ-postfrontal-turb from 6000ft to 24000ft MSL; severity moderate. Source: Cold-sector turbulence: cold advection behind front, tightening surface gradient, jet-exit ageostrophic flow aloft.

**Reason:** Tango polygon HZ-postfrontal-turb encloses from 6000ft to 24000ft MSL. The mechanism is named in the hazard source: Cold-sector turbulence: cold advection behind front, tightening surface gradient, jet-exit ageostrophic flow aloft. Two physical sources stack in this band: mechanical turbulence in the cold-advection boundary layer below, and ageostrophic descent on the cold side of the jet exit aloft. Together they produce continuous chop through the polygon's altitude span; expect ride quality to degrade entering the polygon and recover above the upper bound.

**References:** `wx-product-airmets-sigmets`, `wx-turbulence-types`

### wxc-frontal-xc-march-airmet-tango-HZ-prefrontal-tsra -- airmet (WAUS41-WXENGINE-HZ-prefrontal-tsra)

Pinned to chart `wx-scenario-frontal-xc-march-airmet-sigmet`.

**Mode:** socratic

**Question:** Where is the AIRMET Tango polygon HZ-prefrontal-tsra centered relative to the jet axis -- and what mechanism stacks the turbulence?

**Observation:** AIRMET Tango covers HZ-prefrontal-tsra from 0ft to 30000ft MSL; severity moderate. Source: Pre-frontal warm-sector convection along cold front; isolated cells with embedded turbulence.

**Reason:** Tango polygon HZ-prefrontal-tsra encloses from 0ft to 30000ft MSL. The mechanism is named in the hazard source: Pre-frontal warm-sector convection along cold front; isolated cells with embedded turbulence. Two physical sources stack in this band: mechanical turbulence in the cold-advection boundary layer below, and ageostrophic descent on the cold side of the jet exit aloft. Together they produce continuous chop through the polygon's altitude span; expect ride quality to degrade entering the polygon and recover above the upper bound.

**References:** `wx-product-airmets-sigmets`, `wx-turbulence-types`

### wxc-frontal-xc-march-isobar-gradient -- chart-feature (isobar-pack)

Pinned to chart `wx-scenario-frontal-xc-march-surface-analysis`.

**Mode:** glance

**Question:** Where are the isobars packed tightest on the surface analysis, and what does that tell you about wind speed?

**Observation:** Count the isobars between L-upper-midwest (996mb) and H-southeast (1023mb) -- a 27mb delta across the synoptic frame.

**Reason:** Tight isobars equal a steep pressure gradient equal strong wind. The 27mb spread between L-upper-midwest and H-southeast is bridged across the cold-sector envelope; isobars compress where the deepening low draws air toward its center while the high pushes air outward. Surface friction veers the wind ~30deg right of the gradient direction; that's why the post-frontal stations report NW winds rather than pure W.

**References:** `wx-wind-systems`, `wx-chart-type-surface-analysis`, `wx-product-surface-analysis-and-cva`

### wxc-frontal-xc-march-convective-cell-C-prefront-1 -- chart-feature (cell-C-prefront-1)

Pinned to chart `wx-scenario-frontal-xc-march-prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-prefront-1 extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-prefront-1 at 38.0N/89.0W, radius 25km, peak 48 dBZ; inside HZ-prefrontal-tsra.

**Reason:** Convective cell C-prefront-1 stands inside inside HZ-prefrontal-tsra. Cells in this peak-dBZ range (48 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 50km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-frontal-xc-march-convective-cell-C-prefront-2 -- chart-feature (cell-C-prefront-2)

Pinned to chart `wx-scenario-frontal-xc-march-prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-prefront-2 extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-prefront-2 at 36.0N/88.5W, radius 20km, peak 42 dBZ; inside HZ-prefrontal-tsra.

**Reason:** Convective cell C-prefront-2 stands inside inside HZ-prefrontal-tsra. Cells in this peak-dBZ range (42 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 40km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-frontal-xc-march-pirep-corroboration-KSPI -- pirep (KSPI)

Pinned to chart `wx-scenario-frontal-xc-march-pirep-plot`.

**Mode:** socratic

**Question:** How does the KSPI PIREP corroborate the AIRMET Sierra polygon?

**Observation:** `KSPI UUA /OV SPI270010/TM 1848/FL060/TP C172/TB MOD 050-080/SK OVC020/WX RA/RM CONT MOD CHOP IN PRECIP`

**Reason:** The KSPI PIREP is inside the HZ-postfrontal-ifr hazard zone (severity moderate, 0-4000ft MSL). Three independent products agree: the AIRMET Sierra polygon covering HZ-postfrontal-ifr, the synoptic truth that produced the polygon (Post-frontal cold-sector IFR: lifted air-mass moisture trapped beneath a stable inversion), and the pilot's report from inside it. Convergent independent evidence is the gold standard pre-flight signal -- treat it as confirmation, not coincidence.

**References:** `wx-product-pireps`, `wx-product-airmets-sigmets`

### wxc-frontal-xc-march-jet-exit -- fb-row (jet-max-fl)

Pinned to chart `wx-scenario-frontal-xc-march-winds-aloft`.

**Mode:** socratic

**Question:** Where is the jet axis on the winds-aloft chart, and what does the exit region predict about turbulence at FL240+?

**Observation:** Jet maximum: 110 kt aloft, axis running from 36.0N/110.0W to 47.0N/82.0W.

**Reason:** The 110-kt jet axis (from 36.0N/110.0W to 47.0N/82.0W) feeds an exit region where ageostrophic flow descends and accelerates on the cold side -- classic clear-air turbulence. On the cP cold sector side of the jet exit, the post-frontal pressure rise downstream of L-upper-midwest (996mb) reinforces the descent; expect chop concentrated in the FL180-FL280 band aligned with the axis.

**References:** `wx-product-winds-aloft`, `wx-turbulence-types`

# mountain-wave-rockies -- truth-aware commentary

Truth valid at: `2026-02-12T21:00:00Z`

Lee-side mountain wave east of the Front Range. A 95-kt jet aloft drives strong westerly flow perpendicular to the divide; the wave column carries severe turbulence from the surface to FL280, with a rotor cloud at mid levels and mountain obscuration upwind of the Rockies. KASE sits high on the windward foothills; KDEN / KCOS / KBJC / KAPA cluster in the lee of the divide along the I-25 corridor.

## Callouts (8)

### wxc-mountain-wave-rockies-airmet-tango-HZ-lee-wave-tango -- airmet (WAUS41-WXENGINE-HZ-lee-wave-tango)

Pinned to chart `wx-scenario-mountain-wave-rockies-airmet-sigmet`.

**Mode:** socratic

**Question:** Where is the AIRMET Tango polygon HZ-lee-wave-tango centered relative to the jet axis -- and what mechanism stacks the turbulence?

**Observation:** AIRMET Tango covers HZ-lee-wave-tango from 0ft to 28000ft MSL; severity severe. Source: Severe lee-wave turbulence column east of the Front Range -- amplified by the H-great-basin/L-lee-trough pressure gradient and the 95-kt jet axis.

**Reason:** Tango polygon HZ-lee-wave-tango encloses from 0ft to 28000ft MSL. The mechanism is named in the hazard source: Severe lee-wave turbulence column east of the Front Range -- amplified by the H-great-basin/L-lee-trough pressure gradient and the 95-kt jet axis. Two physical sources stack in this band: mechanical turbulence in the cold-advection boundary layer below, and ageostrophic descent on the cold side of the jet exit aloft. Together they produce continuous chop through the polygon's altitude span; expect ride quality to degrade entering the polygon and recover above the upper bound.

**References:** `wx-product-airmets-sigmets`, `wx-turbulence-types`

### wxc-mountain-wave-rockies-airmet-zulu-HZ-rotor-zulu -- airmet (WAUS41-WXENGINE-HZ-rotor-zulu)

Pinned to chart `wx-scenario-mountain-wave-rockies-airmet-sigmet`.

**Mode:** socratic

**Question:** What altitude band does the AIRMET Zulu cover for HZ-rotor-zulu, and how does the freezing-level shape that band?

**Observation:** AIRMET Zulu covers HZ-rotor-zulu from 5000ft to 12000ft MSL; severity moderate. Source: Moderate icing in the rotor cloud east of the divide -- supercooled drops trapped in the wave-driven rotor circulation.

**Reason:** Zulu polygon HZ-rotor-zulu encloses from 5000ft to 12000ft MSL. Icing requires supercooled liquid water above the freezing level -- the band's lower bound tracks the freezing-level surface, and the upper bound caps where temperatures drop below ~-15C (most droplets glaciate). Inside the polygon, expect rime/clear icing on airframe surfaces; the AIRMET source (Moderate icing in the rotor cloud east of the divide -- supercooled drops trapped in the wave-driven rotor circulation) names the specific producing mechanism so the polygon's altitude bounds and severity make sense.

**References:** `wx-product-airmets-sigmets`, `wx-icing-types-and-avoidance`

### wxc-mountain-wave-rockies-airmet-sierra-HZ-upwind-mtn-obscuration -- airmet (WAUS41-WXENGINE-HZ-upwind-mtn-obscuration)

Pinned to chart `wx-scenario-mountain-wave-rockies-airmet-sigmet`.

**Mode:** socratic

**Question:** What does this AIRMET Sierra (HZ-upwind-mtn-obscuration) tell you about ceiling and visibility along the route?

**Observation:** AIRMET Sierra covers HZ-upwind-mtn-obscuration from 0ft to 15000ft MSL; severity light. Source: Mountain obscuration in upwind mP air piling against the windward slopes of the Front Range -- light orographic stratus and snow showers.

**Reason:** The HZ-upwind-mtn-obscuration hazard zone is a mountain-obscuration pocket bounded by the synoptic features that produced it (Mountain obscuration in upwind mP air piling against the windward slopes of the Front Range -- light orographic stratus and snow showers). The Sierra family triggers on ceiling below 1000ft AGL or visibility below 3SM; inside this polygon those minima are forecast to fail. Three impacts: (1) VFR is locked out under the polygon; (2) the cloud deck is uniform (the same stable inversion that traps the moisture caps it horizontally); (3) the polygon shrinks or grows with the synoptic state -- track the parent feature, not just the AIRMET itself.

**References:** `wx-product-airmets-sigmets`, `wx-fog-and-visibility-obstructions`

### wxc-mountain-wave-rockies-isobar-gradient -- chart-feature (isobar-pack)

Pinned to chart `wx-scenario-mountain-wave-rockies-surface-analysis`.

**Mode:** glance

**Question:** Where are the isobars packed tightest on the surface analysis, and what does that tell you about wind speed?

**Observation:** Count the isobars between L-lee-trough (1008mb) and H-great-basin (1024mb) -- a 16mb delta across the synoptic frame.

**Reason:** Tight isobars equal a steep pressure gradient equal strong wind. The 16mb spread between L-lee-trough and H-great-basin is bridged across the cold-sector envelope; isobars compress where the deepening low draws air toward its center while the high pushes air outward. Surface friction veers the wind ~30deg right of the gradient direction; that's why the post-frontal stations report NW winds rather than pure W.

**References:** `wx-wind-systems`, `wx-chart-type-surface-analysis`, `wx-product-surface-analysis-and-cva`

### wxc-mountain-wave-rockies-convective-cell-C-rotor-north -- chart-feature (cell-C-rotor-north)

Pinned to chart `wx-scenario-mountain-wave-rockies-prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-rotor-north extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-rotor-north at 40.5N/105.3W, radius 8km, peak 18 dBZ; inside HZ-lee-wave-tango.

**Reason:** Convective cell C-rotor-north stands inside inside HZ-lee-wave-tango. Cells in this peak-dBZ range (18 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 16km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-mountain-wave-rockies-convective-cell-C-rotor-south -- chart-feature (cell-C-rotor-south)

Pinned to chart `wx-scenario-mountain-wave-rockies-prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-rotor-south extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-rotor-south at 38.2N/105.4W, radius 8km, peak 18 dBZ; inside HZ-lee-wave-tango.

**Reason:** Convective cell C-rotor-south stands inside inside HZ-lee-wave-tango. Cells in this peak-dBZ range (18 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 16km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-mountain-wave-rockies-pirep-corroboration-KAPA -- pirep (KAPA)

Pinned to chart `wx-scenario-mountain-wave-rockies-pirep-plot`.

**Mode:** socratic

**Question:** How does the KAPA PIREP corroborate the AIRMET Tango polygon?

**Observation:** `KAPA UUA /OV APA220030/TM 2030/FL145/TP B738/TB SEV 010-280/SK BKN090/RM CONT SEV CHOP`

**Reason:** The KAPA PIREP is inside the HZ-lee-wave-tango hazard zone (severity severe, 0-28000ft MSL). Three independent products agree: the AIRMET Tango polygon covering HZ-lee-wave-tango, the synoptic truth that produced the polygon (Severe lee-wave turbulence column east of the Front Range -- amplified by the H-great-basin/L-lee-trough pressure gradient and the 95-kt jet axis), and the pilot's report from inside it. Convergent independent evidence is the gold standard pre-flight signal -- treat it as confirmation, not coincidence.

**References:** `wx-product-pireps`, `wx-product-airmets-sigmets`

### wxc-mountain-wave-rockies-jet-exit -- fb-row (jet-max-fl)

Pinned to chart `wx-scenario-mountain-wave-rockies-winds-aloft`.

**Mode:** socratic

**Question:** Where is the jet axis on the winds-aloft chart, and what does the exit region predict about turbulence at FL240+?

**Observation:** Jet maximum: 95 kt aloft, axis running from 39.0N/115.0W to 40.5N/94.0W.

**Reason:** The 95-kt jet axis (from 39.0N/115.0W to 40.5N/94.0W) feeds an exit region where ageostrophic flow descends and accelerates on the cold side -- classic clear-air turbulence. On the cP cold sector side of the jet exit, the post-frontal pressure rise downstream of L-lee-trough (1008mb) reinforces the descent; expect chop concentrated in the FL180-FL280 band aligned with the axis.

**References:** `wx-product-winds-aloft`, `wx-turbulence-types`

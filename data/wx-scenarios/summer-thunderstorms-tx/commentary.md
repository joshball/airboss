# summer-thunderstorms-tx -- truth-aware commentary

Truth valid at: `2026-07-15T21:00:00Z`

Pop-up afternoon convection along the Texas Gulf Coast. Weak surface ridge over central Texas overhead with a weak trough offshore. mT inland air mass carries very high CAPE; an outflow boundary along the upper coastal plain triggers four mature cells along the KAUS-KIAH corridor. Cooler maritime air offshore stays capped.

## Callouts (12)

### wxc-summer-thunderstorms-tx-pre-frontal-warm-sector-KSAT -- metar (KSAT)

**Mode:** socratic

**Question:** Why are KSAT's winds 130/10 on a pre-frontal afternoon?

**Observation:** KSAT METAR carries the mT signature: T35C / Td24C, wind 130/10.

**Reason:** KSAT sits in the mT warm sector ahead of the cold front. Surface flow circulates around L-gulf-trough (1010mb) to the north, drawing southeasterly air up from the source region -- hence the 130/10 wind. The pre-frontal pressure gradient between L-gulf-trough (1010mb) and the downstream high tightens as the front approaches; that's why the wind speed is non-trivial despite the calm-feeling warm-sector skies.

**References:** `wx-wind-systems`, `wx-airmasses-and-fronts`

### wxc-summer-thunderstorms-tx-taf-fm-KCRP -- taf-period (KCRP)

**Mode:** socratic

**Question:** How does the FM06Z transition in KCRP's TAF change your arrival plan?

**Observation:** KCRP TAF: `TAF KCRP 152020Z 1521/1609 15008KT 6SM FEW025 FM160600 13010KT 6SM SCT045`

**Reason:** KCRP is currently inside the projected frontal swath. The FM group marks the forecast time the cold front reaches the field. After the FM hour the ceiling and visibility drop, the wind veers and gusts, and you're flying through post-frontal air -- denser, drier, colder. Arrive before the FM hour and the airport stays in mT conditions; arrive after and you're landing in the post-frontal regime.

**References:** `wx-reading-metars-tafs`, `wx-airmasses-and-fronts`

### wxc-summer-thunderstorms-tx-airmet-tango-HZ-corridor-tango-low -- airmet (WAUS41-WXENGINE-HZ-corridor-tango-low)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/airmet-sigmet`.

**Mode:** socratic

**Question:** Where is the AIRMET Tango polygon HZ-corridor-tango-low centered relative to the jet axis -- and what mechanism stacks the turbulence?

**Observation:** AIRMET Tango covers HZ-corridor-tango-low from 0ft to 15000ft MSL; severity light. Source: Convective turbulence column under thunderstorm cells along the upper coastal plain outflow boundary.

**Reason:** Tango polygon HZ-corridor-tango-low encloses from 0ft to 15000ft MSL. The mechanism is named in the hazard source: Convective turbulence column under thunderstorm cells along the upper coastal plain outflow boundary. Two physical sources stack in this band: mechanical turbulence in the cold-advection boundary layer below, and ageostrophic descent on the cold side of the jet exit aloft. Together they produce continuous chop through the polygon's altitude span; expect ride quality to degrade entering the polygon and recover above the upper bound.

**References:** `wx-product-airmets-sigmets`, `wx-turbulence-types`

### wxc-summer-thunderstorms-tx-airmet-tango-HZ-outflow-tango -- airmet (WAUS41-WXENGINE-HZ-outflow-tango)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/airmet-sigmet`.

**Mode:** socratic

**Question:** Where is the AIRMET Tango polygon HZ-outflow-tango centered relative to the jet axis -- and what mechanism stacks the turbulence?

**Observation:** AIRMET Tango covers HZ-outflow-tango from 0ft to 6000ft MSL; severity light. Source: Low-level mechanical turbulence along the stationary outflow boundary that anchors the cell line.

**Reason:** Tango polygon HZ-outflow-tango encloses from 0ft to 6000ft MSL. The mechanism is named in the hazard source: Low-level mechanical turbulence along the stationary outflow boundary that anchors the cell line. Two physical sources stack in this band: mechanical turbulence in the cold-advection boundary layer below, and ageostrophic descent on the cold side of the jet exit aloft. Together they produce continuous chop through the polygon's altitude span; expect ride quality to degrade entering the polygon and recover above the upper bound.

**References:** `wx-product-airmets-sigmets`, `wx-turbulence-types`

### wxc-summer-thunderstorms-tx-airmet-zulu-HZ-anvil-zulu -- airmet (WAUS41-WXENGINE-HZ-anvil-zulu)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/airmet-sigmet`.

**Mode:** socratic

**Question:** What altitude band does the AIRMET Zulu cover for HZ-anvil-zulu, and how does the freezing-level shape that band?

**Observation:** AIRMET Zulu covers HZ-anvil-zulu from 12000ft to 25000ft MSL; severity light. Source: Supercooled liquid water in the rising anvil tops above the convective freezing level.

**Reason:** Zulu polygon HZ-anvil-zulu encloses from 12000ft to 25000ft MSL. Icing requires supercooled liquid water above the freezing level -- the band's lower bound tracks the freezing-level surface, and the upper bound caps where temperatures drop below ~-15C (most droplets glaciate). Inside the polygon, expect rime/clear icing on airframe surfaces; the AIRMET source (Supercooled liquid water in the rising anvil tops above the convective freezing level) names the specific producing mechanism so the polygon's altitude bounds and severity make sense.

**References:** `wx-product-airmets-sigmets`, `wx-icing-types-and-avoidance`

### wxc-summer-thunderstorms-tx-airmet-sierra-HZ-cell-sierra -- airmet (WAUS41-WXENGINE-HZ-cell-sierra)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/airmet-sigmet`.

**Mode:** socratic

**Question:** What does this AIRMET Sierra (HZ-cell-sierra) tell you about ceiling and visibility along the route?

**Observation:** AIRMET Sierra covers HZ-cell-sierra from 0ft to 3000ft MSL; severity light. Source: LIFR pocket directly under the heaviest precipitating cells -- heavy rain blocks the visibility.

**Reason:** The HZ-cell-sierra hazard zone is a ifr pocket bounded by the synoptic features that produced it (LIFR pocket directly under the heaviest precipitating cells -- heavy rain blocks the visibility). The Sierra family triggers on ceiling below 1000ft AGL or visibility below 3SM; inside this polygon those minima are forecast to fail. Three impacts: (1) VFR is locked out under the polygon; (2) the cloud deck is uniform (the same stable inversion that traps the moisture caps it horizontally); (3) the polygon shrinks or grows with the synoptic state -- track the parent feature, not just the AIRMET itself.

**References:** `wx-product-airmets-sigmets`, `wx-fog-and-visibility-obstructions`

### wxc-summer-thunderstorms-tx-isobar-gradient -- chart-feature (isobar-pack)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/surface-analysis`.

**Mode:** glance

**Question:** Where are the isobars packed tightest on the surface analysis, and what does that tell you about wind speed?

**Observation:** Count the isobars between L-gulf-trough (1010mb) and H-tx-ridge (1018mb) -- a 8mb delta across the synoptic frame.

**Reason:** Tight isobars equal a steep pressure gradient equal strong wind. The 8mb spread between L-gulf-trough and H-tx-ridge is bridged across the cold-sector envelope; isobars compress where the deepening low draws air toward its center while the high pushes air outward. Surface friction veers the wind ~30deg right of the gradient direction; that's why the post-frontal stations report NW winds rather than pure W.

**References:** `wx-wind-systems`, `wx-chart-type-surface-analysis`, `wx-product-surface-analysis-and-cva`

### wxc-summer-thunderstorms-tx-convective-cell-C-aus-east -- chart-feature (cell-C-aus-east)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-aus-east extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-aus-east at 30.1N/97.3W, radius 18km, peak 55 dBZ; inside HZ-corridor-tango-low, HZ-anvil-zulu, HZ-cell-sierra.

**Reason:** Convective cell C-aus-east stands inside inside HZ-corridor-tango-low, HZ-anvil-zulu, HZ-cell-sierra. Cells in this peak-dBZ range (55 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 36km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-summer-thunderstorms-tx-convective-cell-C-corridor-mid -- chart-feature (cell-C-corridor-mid)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-corridor-mid extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-corridor-mid at 30.1N/96.5W, radius 20km, peak 55 dBZ; inside HZ-corridor-tango-low, HZ-anvil-zulu, HZ-cell-sierra.

**Reason:** Convective cell C-corridor-mid stands inside inside HZ-corridor-tango-low, HZ-anvil-zulu, HZ-cell-sierra. Cells in this peak-dBZ range (55 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 40km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-summer-thunderstorms-tx-convective-cell-C-cll-near -- chart-feature (cell-C-cll-near)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-cll-near extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-cll-near at 30.4N/96.3W, radius 16km, peak 50 dBZ; inside HZ-corridor-tango-low, HZ-anvil-zulu.

**Reason:** Convective cell C-cll-near stands inside inside HZ-corridor-tango-low, HZ-anvil-zulu. Cells in this peak-dBZ range (50 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 32km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-summer-thunderstorms-tx-convective-cell-C-iah-south -- chart-feature (cell-C-iah-south)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/prog-12hr`.

**Mode:** socratic

**Question:** What altitude band does the convective cell C-iah-south extend through, and which AIRMET polygons does it overlap?

**Observation:** Cell C-iah-south at 29.8N/95.4W, radius 18km, peak 55 dBZ; inside HZ-corridor-tango-low, HZ-outflow-tango, HZ-anvil-zulu.

**Reason:** Convective cell C-iah-south stands inside inside HZ-corridor-tango-low, HZ-outflow-tango, HZ-anvil-zulu. Cells in this peak-dBZ range (55 dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay 36km clear of the cell at flight altitudes the AIRMETs cover.

**References:** `wx-thunderstorm-hazards`, `wx-product-airmets-sigmets`

### wxc-summer-thunderstorms-tx-pirep-corroboration-KAUS -- pirep (KAUS)

Pinned to chart `wx-scenarios/summer-thunderstorms-tx/pirep-plot`.

**Mode:** socratic

**Question:** How does the KAUS PIREP corroborate the AIRMET Tango polygon?

**Observation:** `KAUS UUA /OV AUS110020/TM 2030/FL090/TP B738/TB MOD 070-110/SK BKN040 OVC100/WX TSRA/RM HVY PRECIP NEAR CELL`

**Reason:** The KAUS PIREP is inside the HZ-corridor-tango-low hazard zone (severity light, 0-15000ft MSL). Three independent products agree: the AIRMET Tango polygon covering HZ-corridor-tango-low, the synoptic truth that produced the polygon (Convective turbulence column under thunderstorm cells along the upper coastal plain outflow boundary), and the pilot's report from inside it. Convergent independent evidence is the gold standard pre-flight signal -- treat it as confirmation, not coincidence.

**References:** `wx-product-pireps`, `wx-product-airmets-sigmets`

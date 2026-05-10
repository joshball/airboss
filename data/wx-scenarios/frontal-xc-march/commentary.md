# frontal-xc-march -- truth-aware commentary

Truth valid at: `2026-03-19T19:00:00Z`

Winter frontal passage during a midwest XC, KSTL -> KORD. Synoptic-scale low over the Upper Midwest with a cold front trailing SSE. Pre-frontal warm sector ahead of the front (KSTL/KCPS); post-frontal cold sector behind it (KSPI/KMLI). KORD ahead of the front, will see passage 2-4 hours later.

## Callouts (10)

### cal-001-warm-sector-wind -- metar (KSTL)

**Mode:** socratic

**Question:** Look at KSTL: wind 200 at 14, temp 17C. Why is the wind from the south here?

**Observation:** KSTL METAR: `KSTL 191953Z 20014KT 5SM -RA BKN045 OVC120 17/13 A2969`

**Reason:** KSTL sits in the pre-frontal warm sector (mT, maritime tropical air mass) ahead of an approaching cold front. In the warm sector, surface flow circulates around the parent low to the north, drawing southerly air up from the Gulf -- hence the 200/14 wind. Compare to the post-frontal stations (KMLI, KSPI) where the wind has shifted to NW (320). The wind shift IS the front passage.

**References:** `wx-airmasses-and-fronts`, `wx-wind-systems`

### cal-002-front-contrast -- metar (KSPI)

**Mode:** socratic

**Question:** KSPI just had the front pass: wind 320 G33, temp 4C, OVC015, vis 3SM in BR. KSTL one airport south is still 200/14, 17C, BKN045. What changed in the air column at KSPI in the last hour?

**Observation:** KSPI: `KSPI 191953Z 32020G33KT 3SM BR -RA OVC015 OVC070 04/M03 A2963`
KSTL: `KSTL 191953Z 20014KT 5SM -RA BKN045 OVC120 17/13 A2969`

**Reason:** A surface cold front swept through KSPI moments ago. The temperature dropped 13C, the dewpoint dropped 16C (mT replaced by cP), the wind backed 120 degrees and gained gusts (steep post-frontal pressure gradient + cold advection coupling momentum down), the ceiling dropped (lifted moisture trapped beneath the post-frontal stable layer), and visibility crashed (mist in the cooler air). Every change traces back to one event: a different air mass is now over the field.

**References:** `wx-airmasses-and-fronts`, `wx-stability-and-instability`, `wx-clouds-and-precipitation`

### cal-003-postfrontal-gust -- metar (KMLI)

**Mode:** socratic

**Question:** KMLI is well behind the front: wind 320 at 20 gusting 32. The surface is heating with the afternoon sun -- shouldnt the gusts have died down by now in the cP air?

**Observation:** KMLI: `KMLI 191953Z 32020G32KT 3SM BR OVC015 OVC070 04/M03 A2956`

**Reason:** The gusts come from two sources, both still active. (1) The pressure gradient is tightening as the parent low deepens off to the NE -- isobars pack tighter behind a deepening trough, so the geostrophic wind speeds up. (2) Cold advection in the post-frontal sector keeps the boundary layer well-mixed: mid-level momentum keeps coupling down to the surface as gusts. The "gusts die at sunset" rule applies in stable air; in active cold advection it does not.

**References:** `wx-wind-systems`, `wx-airmasses-and-fronts`

### cal-004-taf-transition-kord -- taf-period (KORD)

**Mode:** socratic

**Question:** KORDs TAF: starts 200/14 P6SM BKN045, then "FM 21Z 320/20 G30 OVC025." Whats the FM telling you to plan for if youre arriving at 22Z?

**Observation:** KORD TAF: `TAF KORD 191820Z 1919/2007 20014KT 6SM BKN045 FM192100 32020G30KT 6SM OVC025`

**Reason:** FM21Z is the forecast time the cold front passes KORD. After 21Z: ceiling drops to 2500 ft (still VFR but now under an OVC deck instead of broken cumulus), wind shifts 120 degrees and gains gusts (your runway selection changes -- check the gust-front quartering crosswind), and you're now flying through cP air -- denser, drier, colder -- which affects performance numbers. The truth-model front is currently 66km east of KORD moving ESE at 25 kt; do the math, that's about 2.6 hours, FM21Z is 2 hours after issue.

**References:** `wx-airmasses-and-fronts`, `wx-go-nogo-decision`

### cal-005-airmet-sierra -- airmet (WAUS41-WXENGINE-HZ-postfrontal-ifr)

Pinned to chart `wx-scenario-frontal-xc-march-airmet-sigmet`.

**Mode:** socratic

**Question:** AIRMET Sierra covers the area west of the cold front. Why does ceiling drop in the cold air after a front passes?

**Observation:** See the AIRMET Sierra polygon over the IL/IA region on the AIRMET overlay chart.

**Reason:** Post-frontal cold air is denser; it pushes under the warmer pre-frontal moisture and lifts it. The lifted moisture condenses just above the surface (forms the OVC015 layer KSPI is reporting). The air mass behind the front is also stable -- a low-level inversion caps the moisture, trapping it as a uniform deck of stratocumulus rather than letting it mix vertically. Same moisture, different stability, different ceiling.

**References:** `wx-clouds-and-precipitation`, `wx-stability-and-instability`

### cal-006-airmet-tango -- airmet (WAUS41-WXENGINE-HZ-postfrontal-turb)

Pinned to chart `wx-scenario-frontal-xc-march-airmet-sigmet`.

**Mode:** socratic

**Question:** AIRMET Tango: turbulence FL060-FL240 in the cold sector behind the front. What two physical sources stack up to produce the turbulence in this band?

**Observation:** See the AIRMET Tango polygon overlapping the cold-sector region.

**Reason:** Two sources. (1) Cold advection: cP air sliding south over relatively warmer surface generates mechanical turbulence as the boundary layer struggles to stay mixed. (2) The 250 mb jet axis runs roughly through this region with a max of 110 kt; on the cold side of the jet, ageostrophic flow descends and accelerates -- classic clear-air turbulence at the jet exit. The two sources reinforce vertically through the layer FL060-FL240.

**References:** `wx-wind-systems`, `wx-stability-and-instability`

### cal-007-isobar-gradient -- chart-feature (isobar-pack)

Pinned to chart `wx-scenario-frontal-xc-march-surface-analysis`.

**Mode:** glance

**Question:** Why are the isobars packed so tightly behind the cold front (the western side of the chart)?

**Observation:** On the surface analysis, count the isobars between the L (996 mb) over the Upper Midwest and the H (1028 mb) over the Rockies. They are very close together west of the front.

**Reason:** Tight isobars = strong pressure gradient = strong wind. Behind the front, the deepening low draws air strongly toward its center while the high to the west pushes air outward. The gradient bridges the difference. Surface friction veers the wind ~30 deg right of the gradient direction; that is why KMLI wind is 320 (NW-ish) rather than pure W (the gradient direction in this geometry).

**References:** `wx-wind-systems`

### cal-008-prog-front-progress -- chart-feature (front-position)

Pinned to chart `wx-scenario-frontal-xc-march-prog-12hr`.

**Mode:** socratic

**Question:** Compare the prog chart to the current surface analysis. Where is the front in 12 hours? Has KORD been overrun by then?

**Observation:** Surface analysis: front near KSPI/KMLI longitude. 12hr prog: front projected forward.

**Reason:** Front is moving 110 deg true at 25 kt. In 12 hours: about 555 km ESE. KORD (~88 W) will be deep in the cold sector by the prog time; KIND likely too. The L center has tracked to the NE into Canada. The forecast story is: "you better be at your destination before the front, or be ready to fly the cold air."

**References:** `wx-airmasses-and-fronts`, `wx-go-nogo-decision`

### cal-009-pirep-corroboration -- pirep (KSPI)

**Mode:** glance

**Question:** Note the KSPI PIREP: "MOD 050-080 in PRECIP." Does this match what you predicted from the surface chart + AIRMETs?

**Observation:** `KSPI UUA /OV SPI270010/TM 1848/FL060/TP C172/TB MOD 050-080/SK OVC020/WX RA/RM CONT MOD CHOP IN PRECIP`

**Reason:** Yes -- the truth-model frontal precipitation band runs through KSPI exactly. The pilot is reporting moderate chop in the rain band, which the AIRMET Tango polygon already covers and the post-frontal pressure gradient predicts. Three independent products (chart, AIRMET, PIREP) all agree because all three derive from the same physical truth.

**References:** `wx-thunderstorm-hazards`, `wx-airmasses-and-fronts`

### cal-010-go-no-go -- chart-feature (route-summary)

**Mode:** socratic

**Question:** You are planning KSTL -> KORD departing at 19Z. Given everything above (front passing KSTL within the hour, post-frontal IFR + turbulence west of the front, KORD ahead of the front but with FM21Z transition), what is your go/no-go?

**Observation:** Synthesize across surface analysis, prog, AIRMETs, METARs, TAFs, and PIREPs.

**Reason:** This is a judgement call, not a formula -- the engine's job is to lay out the truth. Pieces in play: (1) departure side of front is moving through KSTL right now -- you may launch into post-frontal conditions immediately. (2) Route west of front is in IFR + moderate turbulence per AIRMET. (3) Destination is ahead of front but you'll be flying through frontal precipitation band somewhere mid-route. (4) Arrival timing matters: arrive before 21Z and KORD is still warm-sector VFR; arrive after, you're landing in NW gusts and an OVC025 deck. The pedagogy here is making the pilot SEE all the pieces and weigh them, not telling them the answer.

**References:** `wx-go-nogo-decision`, `wx-airmasses-and-fronts`

# Weather Knowledge Nodes -- Lifecycle + CFI-Quality Audit

Date: 2026-05-10
Branch: content/weather-course-buildout
Scope: every node under `course/knowledge/weather/` (22 nodes total)

This audit answers one question: which existing weather nodes are reusable as-is for further course-content authoring vs. which need a rewrite first. Read-only survey; no node was edited.

Each node was scored against:

- Lifecycle: skeleton (frontmatter only, content phases are HTML-comment placeholders) vs. complete (all seven phases populated with substantive prose).
- Discovery-first opening: does Context/Problem/Discover lead with WHY and let the learner derive the answer, or does it open by quoting a regulation / asserting facts?
- Seven-phase coverage: Context, Problem, Discover, Reveal, Practice, Connect, Verify (per ADR 011).
- References quality: real FAA citations with locator detail, vs. invented chapters / vague pointers.
- CFI-quality voice: written like a returning CFI / PPL student would expect (concrete scenario, operational stakes, calibration bias) vs. generic LLM fluff.

## Headline numbers

| Outcome              | Count | Nodes                                                                                                     |
| -------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| Reuse as-is          | 17    | All 17 substantive nodes from the PR #753 cohort.                                                         |
| Build out (skeleton) | 5     | thunderstorm-hazards, density-altitude, icing-types-and-avoidance, go-nogo-decision, reading-metars-tafs. |
| Rewrite              | 0     | None of the substantive nodes warrants a rewrite on a quick CFI read.                                     |
| Delete               | 0     | None.                                                                                                     |

## Summary table

| Node                             | Lifecycle | Discovery-first? | 7-phase complete? | Refs OK? | CFI-quality? | Action      |
| -------------------------------- | --------- | ---------------- | ----------------- | -------- | ------------ | ----------- |
| airmasses-and-fronts             | complete  | yes              | 7/7               | yes      | reuse        | none        |
| briefing-execution               | complete  | yes              | 7/7               | yes      | reuse        | none        |
| clouds-and-precipitation         | complete  | yes              | 7/7               | yes      | reuse        | none        |
| data-sources                     | complete  | yes              | 7/7               | yes      | reuse        | none        |
| density-altitude                 | skeleton  | n/a (no body)    | 0/7               | yes      | n/a          | author body |
| equipment-and-data-limitations   | complete  | yes              | 7/7               | yes      | reuse        | none        |
| flight-deck-weather-displays     | complete  | yes              | 7/7               | yes      | reuse        | none        |
| fog-and-visibility-obstructions  | complete  | yes              | 7/7               | yes      | reuse        | none        |
| go-nogo-decision                 | skeleton  | n/a (no body)    | 0/7               | yes      | n/a          | author body |
| icing-types-and-avoidance        | skeleton  | n/a (no body)    | 0/7               | yes      | n/a          | author body |
| personal-minimums                | complete  | yes              | 7/7               | yes      | reuse        | none        |
| product-airmets-sigmets          | complete  | yes              | 7/7               | yes      | reuse        | none        |
| product-convective-outlook       | complete  | yes              | 7/7               | yes      | reuse        | none        |
| product-gfa                      | complete  | yes              | 7/7               | yes      | reuse        | none        |
| product-pireps                   | complete  | yes              | 7/7               | yes      | reuse        | none        |
| product-surface-analysis-and-cva | complete  | yes              | 7/7               | yes      | reuse        | none        |
| product-winds-aloft              | complete  | yes              | 7/7               | yes      | reuse        | none        |
| reading-metars-tafs              | skeleton  | n/a (no body)    | 0/7               | yes      | n/a          | author body |
| stability-and-instability        | complete  | yes              | 7/7               | yes      | reuse        | none        |
| thunderstorm-hazards             | skeleton  | n/a (no body)    | 0/7               | yes      | n/a          | author body |
| turbulence-types                 | complete  | yes              | 7/7               | yes      | reuse        | none        |
| wind-systems                     | complete  | yes              | 7/7               | yes      | reuse        | none        |

## Per-node detail

### airmasses-and-fronts

Synoptic-scale framework: air mass source regions, the four front types, pre/post-passage signatures with tables. Strong CFI voice ("late-summer Pacific cold front produces a 30-minute squall line") and a Verify phase that nudges the learner to watch real frontal sequences against the textbook schematic. No concerns. Reuse.

### briefing-execution

The eight-bucket self-brief procedure, mapped to AIM 7-1-4 standard / abbreviated / outlook briefing types. Connects the procedure to the three written outputs (forecast picture, go/delay/divert/no-go plan, personal-minimums comparison). Cites 14 CFR 91.103 as the regulatory floor. Reuse.

### clouds-and-precipitation

LCL formula, four cloud families plus vertical-development, precipitation types in METAR codes including the FZRA/SLD discussion. Calls out Roselawn (ATR-72) as the SLD anchor case. Reuse.

### data-sources

Maps NWS / AWC / CWSU / Flight Service / Leidos / EFB / FIS-B / SiriusXM. Distinguishes who originates vs. who relays. Names AC 00-45H as canonical, FAA-H-8083-28 as the modern consolidated reference. Reuse.

### density-altitude

Skeleton. Frontmatter is solid: minimum_cert private, study_priority critical, references include PHAK Ch 11 (Aircraft Performance), AC 61-84B, AIM 7-5-6. Mastery criteria specifies 120 ft / degree C ISA rule of thumb. Author body next.

### equipment-and-data-limitations

R2 family: onboard equipment limits (radar attenuation, NEXRAD age), report/forecast limits (point vs. area, model error, station spacing), in-flight resource limits (PIREP sparsity, ATC ride-report bias). The "name the dominant limitation in one sentence" pre-flight discipline is excellent. Reuse.

### flight-deck-weather-displays

NEXRAD age explanation: 5-10 min uplink + 4-6 min radar sweep = 12-15 min stale data, displayed age indicator usually shows uplink age only. Quotes NTSB SA-017's 20 NM stand-off rule. Includes the lightning-detection (Stormscope/FIS-B lightning) note as the only real-time tactical thunderstorm cue. Reuse.

### fog-and-visibility-obstructions

Six fog types by mechanism (radiation / advection / upslope / steam / precipitation-induced / ice fog), the cooling-vs.-moistening diagnostic, frost-as-roughness (not weight) treatment with King Air Dryden / Citation X Ottawa references, METAR codes table, volcanic-ash KLM 867 / BA 9 anchor. Reuse.

### go-nogo-decision

Skeleton. Frontmatter is solid: requires reading-metars-tafs + airspace-vfr-weather-minimums + thunderstorm-hazards + icing-types. References PHAK Ch 2 (ADM), AOPA ASI, FAA-H-8083-2A. Mastery criteria asks for full-brief walk to defensible go/no-go/delay/divert. Author body next; this is the integration node so it depends on prerequisites being authored too.

### icing-types-and-avoidance

Skeleton. Frontmatter is solid: AC 91-74B, AIM 7-1-21, PHAK Ch 12. Mastery criteria distinguishes clear/rime/mixed by formation and shape, names the temperature band, and asks for ordered escape actions. Author body next.

### personal-minimums

P-8740-25 worksheet structure: variable rows (ceiling/vis/crosswind/wind-gust/night-ceiling/night-vis), context columns (solo / with-passengers / mountainous-or-unfamiliar). Three rules-of-operation discipline (write before pressure / divert when trending / recalibrate on cadence). Returning-CFI-grade pedagogy. Reuse.

### product-airmets-sigmets

SIERRA / TANGO / ZULU AIRMET taxonomy, SIGMET vs. Convective SIGMET trigger thresholds, the comparison table by audience / severity / valid time. Walks the example "Convective SIGMET 32C" decode, including the embedded-line "no thread the needle" call. Reuse.

### product-convective-outlook

SPC Day 1 / 2 / 3 / 4-8 outlooks, the categorical taxonomy (TSTM / MRGL / SLGT / ENH / MDT / HIGH), the three-time-horizon framing (outlook -> Convective SIGMET -> NEXRAD). Verify phase tells the learner to back-test yesterday's Day 1 against yesterday's actuals to build forecast-skill calibration. Reuse.

### product-gfa

Tool walkthrough for aviationweather.gov/gfa: layers (clouds, weather, cig/vis, precip, icing, turbulence, winds), time scrubber, refresh cadence, the 2017 replacement of the textual FA. Connect note that GFA is the spatial integration of the underlying products is correct. Reuse.

### product-pireps

UA / UUA distinction, field-by-field decoding from context (no key memorization), UUA trigger conditions per AIM 7-1-19 (tornadoes/severe-or-extreme turb/severe icing/hail/LLWS >=10 KT/volcanic ash). Includes a worked second example (UUA SEV CLR icing in a 737) and the "file even when benign" encouragement. Reuse.

### product-surface-analysis-and-cva

Pressure systems / fronts / station models / isobar gradient on the surface analysis, plus CVA color categories (VFR / MVFR / IFR / LIFR) with the standard ceiling/vis thresholds. The "synoptic at the start, point forecasts in the middle, CVA at the end" briefing-bookend framing is good CFI heuristic. Reuse.

### product-winds-aloft

The two FB encoding traps: >100 KT (add 50 to direction, add 100 to speed) and the implicit-negative temperature above 24,000 ft. Worked decode `731960 -> 230 at 119 KT, -60C`. Reuse.

### reading-metars-tafs

Skeleton. Frontmatter is solid: AC 00-45H, AIM 7-1, PHAK Ch 13. Mastery criteria covers full METAR decode including remarks, TAF probability/change groups, and translation to go/no-go reasoning. Author body next; this is a foundation node that other nodes (go-nogo, briefing-execution, AIRMETs/SIGMETs, GFA) require.

### stability-and-instability

Dry vs. moist adiabatic lapse rates, three stability classes (absolute stable / absolute unstable / conditionally unstable), Skew-T / CAPE introduction with the 1,000 / 2,500 J/kg breakpoints, surface signs you can read from a METAR strip. Strong as a parent node for the rest of the K3 weather family. Reuse.

### thunderstorm-hazards

Skeleton. Frontmatter is solid: AC 00-24C, AIM 7-1-27, PHAK Ch 12. Mastery criteria covers three cell stages, six hazards, 20 nm avoidance rule, and why penetrating a line is never safe. Author body next; this is a critical safety node referenced by go-nogo-decision and the AIRMETs/SIGMETs / convective-outlook chain.

### turbulence-types

Six turbulence categories (mechanical / convective / clear-air / mountain-wave / wake / windshear) with cause / forecast cue / avoidance for each. Intensity table is per-AIM 7-1-23. Verify phase is a five-question rapid-classification drill. Reuse.

### wind-systems

Surface vs. aloft + friction layer, crosswind component mental model (30/60/90 = half/full/pure), low-level windshear, mountain wave (crest vs. trough vs. rotor), microburst outflow. Includes the mountain-wave altimeter-error gotcha (~1,000 ft from a 100 mb pressure drop on the lee side). Reuse.

## Findings

### Read these three first

These are the highest-impact CFI-eyes targets. If a flaw is going to teach a learner the wrong thing, it's most likely in one of these:

1. **flight-deck-weather-displays**. The NEXRAD age math (5-10 min uplink + 4-6 min radar sweep + uplink batching = 12-15 min stale, with a "1 minute" age indicator possible at 11 minutes of true age) is the single most safety-critical claim in the corpus. Verify the numbers against AC 00-63A and NTSB SA-017 before treating this node as canonical. The 20 NM cockpit-display stand-off rule is also referenced; verify that's the current published guidance and not a 2012-vintage number that has since been refined.
2. **fog-and-visibility-obstructions**. Specific accident anchors are named (King Air Dryden 1996, Citation X Ottawa 2003, KLM 867, BA 9). The frost section asserts "the 'thin layer' exception is gone from current guidance" -- confirm against current AIM 7-5-1 wording, since this rule has been edited multiple times. The "1/4-inch frost layer can disrupt the airflow over a wing badly enough to increase stall speed by 5-10 KT and decrease lift in the climbout regime by 30%" claim is specific and worth verifying.
3. **product-winds-aloft**. The >100 KT convention rule (add 50 to direction, add 100 to speed) is described correctly in spirit but check the worked example `731960 -> 230 at 119 KT, -60C`. The text says `19` + 100 = 119 (extracted from `731960` as `19`), but `731960` reads as direction `73`, speed `19`, temp `60`, which decodes to 230 at 119 KT, -60C -- consistent. Re-verify on a real FB sample to make sure the field-extraction logic survives station-elevation edge cases.

### Systemic observations

- **All 17 substantive nodes lead with discovery-first.** Every one opens with a Context scenario (a specific flight, a real moment), follows with a Problem framing, then walks Discover before quoting the regulation. The pedagogy is consistent across the cohort. This is the strongest single signal: the author internalized ADR 011 principle "Discovery first, regulation last."
- **References pattern is consistent and locator-detailed.** The pattern is `source: <doc> / detail: <chapter or section> / note: <why this reference>`. AC 00-6B, AC 00-45H, FAA-H-8083-28 (Aviation Weather Handbook), and the PHAK appear throughout with explicit chapter or section locators. Two minor noisy patterns: chapter numbers on FAA-H-8083-28 (the consolidated post-2022 Aviation Weather Handbook) appear in the high teens and twenties (Ch 22 -- Observations and Pilot Reports, Ch 23 -- Analyses, Ch 25 -- Forecasts, Ch 26 -- Sources, Ch 27 -- Limitations) -- worth a one-pass cross-check against an actual table of contents, since these chapter numbers could not be verified during the audit. Same for FAA-H-8083-28 chapters 4, 5, 6, 7, 11, 13, 16 in the earlier nodes -- structurally plausible but unverified.
- **CFI voice is consistent.** The substantive nodes name aircraft (Citation, Cherokee, Cessna 172, 737), name accidents (Roselawn, Dryden, Ottawa, KLM 867, BA 9), name airports as illustration (KMRY, KSAC, KOAK, KSEA, KPAO, KRDD), and routinely name calibration-from-experience as the goal. The Verify phases push the learner toward predict-then-check loops rather than recall quizzes.
- **The 5 skeletons are the original ADR 011 "build first" cohort.** density-altitude, icing-types-and-avoidance, go-nogo-decision, reading-metars-tafs, thunderstorm-hazards. Their frontmatter is fully populated; only the seven content phases are unwritten. Authoring these to match the PR #753 cohort's voice is the obvious next move.
- **Edge / dependency density is high but plausibly correct.** The substantive nodes use `requires`, `applied_by`, `related` consistently. The skeleton go-nogo-decision is the integration node and depends on the four prerequisite skeletons -- so the smartest authoring order is the four prerequisite skeletons first, then go-nogo last. data-sources and briefing-execution are consumed downstream by both go-nogo and the planning nodes. The graph shape matches the pedagogy intent.

### Confidence assessment

- **High** on lifecycle classification: skeleton vs. complete is unambiguous from the body content (HTML-comment placeholders vs. authored prose).
- **High** on discovery-first scoring: the Context-then-Problem-then-Discover opening structure is consistent and visible.
- **High** on seven-phase coverage: every substantive node has all seven headings populated.
- **Medium** on pedagogical voice grade: the voice is clearly returning-CFI-grade across the cohort, but a deeper instructor review could surface inconsistencies in technical level or in how much the learner is asked to derive vs. just read.
- **Low** on aviation fact-checking: chapter numbers in FAA-H-8083-28 cites, AIM section numbers, AC numbers, accident-case specifics (stall-speed deltas, altimeter-error magnitudes, AIM frost-rule wording), and SPC outlook update times were not independently verified. Defer to the user for fact-checking on review.

## Recommended next move

1. Author body for **reading-metars-tafs** first (foundation for several others).
2. Author body for **thunderstorm-hazards**, **icing-types-and-avoidance**, **density-altitude** in parallel (they're independent).
3. Author body for **go-nogo-decision** last (integration node; reads cleaner once its prerequisites are authored).
4. While authoring each, mirror the eight structural moves of the PR #753 cohort: scenario-led Context, stakes-led Problem, derive-it Discover, citable Reveal, predict-then-check Practice, edge-map Connect, calibration-loop Verify.

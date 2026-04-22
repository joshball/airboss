# Tagging architecture for airboss references

Research date: 2026-04-22.

## TL;DR

Five-axis faceted taxonomy (`source-type`, `aviation-topic`, `flight-rules`, `knowledge-kind`, `phase-of-flight`) plus an optional `cert-applicability` axis and freeform `keywords`. The biggest tradeoff: `phase-of-flight` is expensive to populate accurately and earns its keep only on procedure/ops content; make it optional and only gate it for `source-type in (poh, aim-proc, procedure)`. Decide first whether the single-valued `domain` field survives the migration, because keeping it duplicates `aviation-topic[0]` and tempts authors to disagree with themselves.

## Existing state in airboss-firc

The `GlossaryEntry` schema has seven categorization fields:

- `domain` - single value from a 9-item enum (`navigation`, `weather`, `atc`, `aircraft`, `regulations`, `safety`, `organizations`, `operations`, `training`)
- `group` - freeform kebab-case string, loosely conventional per domain (e.g. `weather-groups`: `advisories`, `conditions`, `reports`, `visibility`)
- `tags` - freeform `readonly string[]`, validated only as "non-empty string"
- `source` - freeform string referencing CFR, AIM, PHAK, etc.
- `id` - kebab-case, conventionally suffixed by domain abbreviation (`-wx`, `-nav`, `-ops`, `-atc`, `-reg`, `-def`, `-aircraft`, `-safety`, `-training`, `-org`)
- `related` / `contexts` - ID references, not categorization per se

Observed tag usage across 175 entries (freeform, no enum):

| Tag                          | Approx count  | Actual meaning                                    |
| ---------------------------- | ------------: | ------------------------------------------------- |
| `cfi-knowledge`              | ~160          | "an instructor should know this" - near-universal |
| `faa-testing`                | ~50           | Appears on checkride/knowledge-test content       |
| `checkride`                  | ~40           | Overlaps heavily with `faa-testing`               |
| `instrument-flying`          | ~35           | IFR-relevant                                      |
| `weather-decision-making`    | ~15           | Weather ADM                                       |
| `preflight`                  | ~12           | Phase-of-flight-ish                               |
| `vfr-operations`             | ~10           | VFR-relevant                                      |
| `regulations`                | ~15           | Domain duplicate on non-regulation entries        |
| `safety`, `approaches`       | 1-2 each      | One-offs                                          |

Problems with the existing shape:

- `cfi-knowledge` is a no-op tag. If ~91% of entries have it, it cannot filter.
- Tags mix axes: `instrument-flying` (flight rules), `preflight` (phase), `checkride` (applicability), `regulations` (topic) all in one flat bag.
- `source` is a string, not a structured source-type.
- `domain` being single-valued forced arbitrary choices: `alternate-airport-def` lives in `operations` but is fundamentally regulatory (part 91), weather-dependent, and IFR-specific.
- No `flight-rules` axis, so "find all IFR minimums" requires a string match.
- ID suffix conventions are reliable enough to bootstrap an automated first-pass tag migration.

## Proposed architecture

Faceted. Five required axes plus one optional axis plus freeform keywords. Tags stored per-axis on the entry, not in a flat `tags[]` bag. Each axis has a closed enum.

### Axes

#### 1. `source-type` (required, single-valued)

What kind of artifact the entry represents or cites. Drives "where does this come from" UI and CFR deep-links.

| Value         | Rationale                                                                  |
| ------------- | -------------------------------------------------------------------------- |
| `cfr`         | 14 CFR or other title - regulatory text                                    |
| `aim`         | AIM section - FAA procedural guidance                                      |
| `pcg`         | Pilot/Controller Glossary entry                                            |
| `ac`          | Advisory Circular                                                          |
| `acs`         | Airman Certification Standards                                             |
| `phak`        | Pilot's Handbook of Aeronautical Knowledge                                 |
| `afh`         | Airplane Flying Handbook                                                   |
| `ifh`         | Instrument Flying Handbook                                                 |
| `poh`         | POH/AFM excerpt (tail-number or model specific)                            |
| `ntsb`        | NTSB accident report or recommendation                                     |
| `gajsc`       | GA Joint Steering Committee enhancement                                    |
| `aopa`        | AOPA article                                                               |
| `faa-safety`  | FAA Safety Team / FAASTeam publication                                     |
| `sop`         | Operator or school SOP                                                     |
| `authored`    | Hand-authored explainer not sourced from a single document                 |
| `derived`     | Aggregated or derived from multiple sources (e.g. concept cards)           |

Deliberately not included: `wikipedia`, `skyvector`, `foreflight` - these are tools, not authoritative sources. If cited, use `authored` and reference them in the body.

#### 2. `aviation-topic` (required, multi-valued, 1-4 values)

The subject matter axis. Multi-valued is mandatory - "IFR fuel reserves" is regulations + operations + systems.

| Value                 | Rationale                                                                        |
| --------------------- | -------------------------------------------------------------------------------- |
| `regulations`         | Legal/regulatory content (14 CFR, AC, policy)                                    |
| `weather`             | METARs, forecasts, phenomena, weather ADM                                        |
| `navigation`          | Navaids, RNAV, charts, routing                                                   |
| `communications`      | Radio, phraseology, ATC comms                                                    |
| `airspace`            | Class A-G, SUA, TFR, airspace rules                                              |
| `aerodynamics`        | Lift, drag, stalls, load factor, performance theory                              |
| `performance`         | Takeoff/landing distances, climb, cruise numbers (distinct from aerodynamics)    |
| `weight-balance`      | W&B computation, CG, moment arms (distinct from performance - CFIs teach apart)  |
| `aircraft-systems`    | Engine, electrical, vacuum, pitot-static, avionics hardware                      |
| `flight-instruments`  | Gyros, ASI, altimeter, PFD/MFD as instruments (not systems)                      |
| `procedures`          | Checklists, IAPs, emergency procedures, flow                                     |
| `human-factors`       | ADM, CRM, SRM, fatigue, hazardous attitudes, illusions                           |
| `medical`             | Medicals, BasicMed, aeromedical factors, hypoxia                                 |
| `certification`       | Airman certs, ratings, endorsements, privileges                                  |
| `maintenance`         | Airworthiness, inspections, MEL, logbooks                                        |
| `airports`            | Runway markings, lighting, signage, taxi ops, Chart Supplement                   |
| `emergencies`         | Emergency procedures, engine failure, fire, forced landings                      |
| `training-ops`        | Instructional technique, FOI, learning theory                                    |

Deliberately not included: `atc` as a topic - ATC is a source of communications/airspace content, not a topic itself. `safety` as a topic - every topic has safety implications; use `knowledge-kind: safety-concept` instead.

Gap flagged: `weight-balance` and `performance` are separated intentionally. Conflating them is a CFI red flag - they are taught and tested separately, even though they're related.

#### 3. `flight-rules` (required, single-valued)

| Value    | Rationale                                                         |
| -------- | ----------------------------------------------------------------- |
| `vfr`    | VFR-only applicability                                            |
| `ifr`    | IFR-only applicability                                            |
| `both`   | Applies under both rule sets (the common case)                    |
| `na`     | Not applicable (e.g. ground-only topic, maintenance, org entry)   |

Single-valued because `vfr + ifr` means `both`. Required because "IFR vs VFR minimums" is a headline user query.

#### 4. `knowledge-kind` (required, single-valued)

What kind of knowledge artifact this is. Distinct from `source-type` - a CFR section is `source-type: cfr` but `knowledge-kind: regulation`; an AIM section could be `aim` + `procedure` or `aim` + `concept`.

| Value              | Rationale                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| `definition`       | Term defined in 14 CFR 1.1 or PCG - core vocabulary                    |
| `regulation`       | A rule with required/prohibited behavior                               |
| `concept`          | Explanatory content (what/why)                                         |
| `procedure`        | Step sequence (how to do something)                                    |
| `limit`            | Numeric threshold (V-speeds, VFR mins, fuel reserves)                  |
| `system`           | Aircraft-system description                                            |
| `safety-concept`   | Accident categories, frameworks (PAVE, IMSAFE), hazard patterns        |
| `reference`        | Directory-style entry (organization, facility type, chart legend)      |

Useful because "show me all the limits" and "show me all the procedures" are different learning modes.

#### 5. `phase-of-flight` (optional, multi-valued, 0-3 values)

| Value         | Rationale                                              |
| ------------- | ------------------------------------------------------ |
| `preflight`   | Planning, briefing, walk-around                        |
| `ground-ops`  | Taxi, run-up, taxi-back                                |
| `takeoff`     | Roll, rotation, initial climb                          |
| `climb`       | Initial and en-route climb                             |
| `cruise`      | En-route level flight                                  |
| `descent`     | TOD through approach intercept                         |
| `approach`    | Approach from IAF/pattern entry to DA/MDA              |
| `landing`     | Short final through rollout                            |
| `postflight`  | Shutdown, tie-down, post-flight                        |
| `emergency`   | Not a phase per se but commonly searched with phases   |

Optional because most definitional/regulatory entries have no natural phase. Required on any entry with `knowledge-kind in (procedure, safety-concept)` or `source-type in (poh, authored procedure)`.

#### 6. `cert-applicability` (optional, multi-valued)

| Value      | Rationale                                                         |
| ---------- | ----------------------------------------------------------------- |
| `student`  | Sport/recreational/student pilot content                          |
| `ppl`      | Private pilot                                                     |
| `ir`       | Instrument rating                                                 |
| `cpl`      | Commercial                                                        |
| `atp`      | ATP                                                               |
| `cfi`      | CFI certificate and instructor-specific content                   |
| `cfii`     | CFII                                                              |
| `mei`      | MEI                                                               |
| `all`      | Applies to everyone                                               |

Optional because most content applies broadly; populated when the entry is pointedly rating-specific (e.g. ATP requirements, CFII-only content).

Deliberately not included: study plan mapping, ACS task codes. Those belong on a separate `acs-mapping` structure, not in the tag bag.

#### 7. `keywords` (optional, freeform array)

Escape hatch. Closed enums are for the axes that drive UI filters; keywords are for searchable synonyms, common misspellings, alternate terminology. Not validated against an enum. Capped at 10 per entry.

### What the old fields become

- `domain` - deprecate. Replaced by `aviation-topic[0]` (primary topic) for backward compat UI, but no longer authoritative. Or drop entirely.
- `group` - keep as display-grouping hint, but demote from "categorization" to "layout." Author-supplied, not enforced.
- `tags` - split into the six axes above plus `keywords`.
- `source` - keep, but require it to parse into a `source-type` + citation. A validator can extract `14 CFR 1.1` -> `source-type: cfr, source-ref: '14 CFR 1.1'`.

### Required gates

`bun run check` enforces:

1. `source-type` - required, must be in enum.
2. `aviation-topic` - required, 1-4 values, all in enum, no duplicates.
3. `flight-rules` - required, exactly one of the four values.
4. `knowledge-kind` - required, must be in enum.
5. `phase-of-flight` - required iff `knowledge-kind in (procedure, safety-concept)` OR `source-type == poh`. 0-3 values. No duplicates.
6. `cert-applicability` - optional. If present, 1-5 values from enum.
7. `keywords` - optional. Max 10. Kebab-case-or-space strings.
8. ID-prefix coherence: `cfr-*` entries must have `source-type: cfr`. `aim-*` -> `aim`. `poh-*` -> `poh`. Warn (not error) for ID prefix not matching source-type.
9. No entry carries >4 `aviation-topic` tags without an inline `// AXIS-OVERRIDE: <reason>` comment above the entry.
10. Ban zombie tags: `cfi-knowledge` is disallowed as an explicit tag - use `cert-applicability: cfi` if the content is CFI-specific, otherwise drop it.

## Sample: 18 entries retagged under the proposal

| id                            | old domain       | source-type | aviation-topic                           | flight-rules | knowledge-kind    | phase-of-flight          | cert-applicability | keywords                       |
| ----------------------------- | ---------------- | ----------- | ---------------------------------------- | ------------ | ----------------- | ------------------------ | ------------------ | ------------------------------ |
| `metar-wx`                    | weather          | aim         | weather                                  | both         | reference         | preflight                | -                  | observation, surface           |
| `sigmet-wx`                   | weather          | aim         | weather                                  | both         | safety-concept    | preflight, cruise        | -                  | turbulence, icing              |
| `imc-wx`                      | weather          | cfr         | weather, regulations                     | both         | definition        | -                        | -                  | instrument-conditions          |
| `vmc-wx`                      | weather          | cfr         | weather, regulations, airspace           | vfr          | definition        | -                        | -                  | visual-conditions              |
| `special-vfr-conditions-wx`   | weather          | cfr         | weather, regulations, airspace           | vfr          | regulation        | -                        | ppl                | svfr                           |
| `ifr-ops`                     | operations       | cfr         | regulations, procedures                  | ifr          | regulation        | -                        | ir                 | instrument-flight-rules        |
| `vfr-ops`                     | operations       | cfr         | regulations, weather, airspace           | vfr          | regulation        | -                        | ppl                | visual-flight-rules            |
| `alternate-airport-def`       | operations       | cfr         | regulations, weather, procedures         | ifr          | regulation        | preflight                | ir                 | 1-2-3-rule, fuel-alternate     |
| `mea-ops`                     | operations       | aim         | navigation, airspace                     | ifr          | limit             | cruise                   | ir                 | minimum-en-route-altitude      |
| `mda-ops`                     | operations       | cfr         | procedures, navigation                   | ifr          | limit             | approach                 | ir                 | non-precision                  |
| `va-aircraft`                 | aircraft         | phak        | aerodynamics, performance                | both         | limit             | -                        | -                  | maneuvering-speed, load-factor |
| `vso-aircraft`                | aircraft         | phak        | performance, flight-instruments          | both         | limit             | approach, landing        | -                  | stall-speed, landing-config    |
| `afm-aircraft`                | aircraft         | cfr         | regulations, aircraft-systems            | both         | regulation        | preflight                | -                  | poh, operating-limitations     |
| `cfit-safety`                 | safety           | ntsb        | human-factors, navigation                | both         | safety-concept    | cruise, descent          | -                  | controlled-flight-terrain      |
| `pave-safety`                 | safety           | phak        | human-factors                            | both         | safety-concept    | preflight                | -                  | risk-assessment                |
| `loc-nav`                     | navigation       | aim         | navigation                               | ifr          | system            | approach                 | ir                 | localizer, ils-lateral         |
| `cfi-training`                | training         | cfr         | certification, training-ops              | na           | definition        | -                        | cfi                | flight-instructor              |
| `firc-reg`                    | regulations      | ac          | certification, training-ops, regulations | na           | regulation        | -                        | cfi                | cfi-renewal                    |

## Edge cases the sample surfaced

1. **`special-vfr-conditions-wx` straddles three topics** (weather + regulations + airspace). 3 is within budget but shows the limit - stricter budget of 2 would force arbitrary choices.
2. **`va-aircraft` as `limit` vs `concept`.** Va is a numeric threshold (limit) but also an aerodynamics concept. Picked `limit` because that's the primary pedagogical framing ("know your V-speeds"). Flag: the same entry being a `limit` for checkride prep but a `concept` for aerodynamics exam - could argue for multi-valued `knowledge-kind`. Recommend keeping single-valued and letting `aviation-topic` carry the nuance.
3. **`cfi-training` under `flight-rules: na`.** The certificate itself has no flight rule. `na` is doing real work here. Confirms the four-value `flight-rules` enum is right.
4. **`vmc-wx` is VFR-only but defines a condition that matters to IFR pilots** (e.g. cancelling IFR). The tag says `vfr` because the rule itself is VFR; if the reader is hunting "IFR concepts," they find it via `aviation-topic: weather` + `knowledge-kind: definition`, not via flight-rules. Document this convention: `flight-rules` captures the rule-set the content legally governs, not audience.
5. **`organizations` entries (FAA, NTSB, TSA, ICAO)** don't have a natural `aviation-topic`. Best mapping is `regulations` or `certification`, which feels forced. Options: (a) add `governance` to `aviation-topic` enum, (b) make `aviation-topic` optional for `source-type: authored` + `knowledge-kind: reference`. Recommend option (a) - add `governance` (7th knowledge enum? no, topic enum) - it's real.
6. **`pfd-aircraft` vs `ahrs-aircraft`.** PFD is `flight-instruments`, AHRS is `aircraft-systems`. The old `group` says both are `flight-instruments`. The axis split forces a distinction CFIs actually teach (AHRS is a system that feeds the PFD instrument). Worth it.
7. **`phase-of-flight` on `cfit-safety`.** Cruise and descent are defensible but so are approach and takeoff (CFIT accidents happen in all phases). Either allow a `any-phase` sentinel or just tolerate authors picking top 2-3. Recommend "top 2-3" with no sentinel.

## Search/filter queries this enables

1. **"IFR vs VFR minimums"** -> `aviation-topic in (weather, regulations)` AND `knowledge-kind in (limit, regulation)` AND `flight-rules in (vfr, ifr, both)`. Returns `ifr-ops`, `vfr-ops`, `imc-wx`, `vmc-wx`, `special-vfr-conditions-wx`, `mda-ops`, `da-ops`, `alternate-airport-def`, `mea-ops`.
2. **"CFR sections on IFR fuel reserves"** -> `source-type == cfr` AND `flight-rules == ifr` AND `keywords contains fuel` (or topic `procedures` + keyword `fuel-reserves`).
3. **"All weather-related regs"** -> `aviation-topic contains weather` AND `aviation-topic contains regulations`. Returns the three VMC/IMC/SVFR entries plus `alternate-airport-def`.
4. **"IR checkride limits"** -> `knowledge-kind == limit` AND `cert-applicability contains ir`. Returns `mea-ops`, `mda-ops`, `da-ops`, `mca-ops`, `moca-ops`, `mra-ops`.
5. **"Approach-phase procedures"** -> `knowledge-kind == procedure` AND `phase-of-flight contains approach`. Returns IAP, NOPT, ALS/REIL entries.
6. **Bonus: "POH-sourced limits"** -> `source-type == poh` AND `knowledge-kind == limit`. Becomes the primary way to find tail-number-specific V-speeds once POH content is ingested.

## Migration plan for the existing 175 entries

Three options evaluated:

| Approach              | Cost                            | Risk                                                         | Accuracy |
| --------------------- | ------------------------------- | ------------------------------------------------------------ | -------- |
| Manual per-entry      | High (~5 min x 175 = 15 hours)  | Low - human review each entry                                | Highest  |
| Regex-first pass only | Low (~2 hours script + review)  | High - misses conceptual mappings                            | ~60%     |
| Hybrid (recommended)  | Medium (~6 hours)               | Low - agent proposes, human approves in batches              | ~95%     |

**Recommended: hybrid.**

1. **Deterministic first pass** (script, ~30 min to write):
   - `id` suffix `-wx` -> `aviation-topic: [weather]`, `source-type: aim` unless source string mentions CFR.
   - `id` suffix `-reg` or `source` matches `/^14 CFR/` -> `source-type: cfr`, `knowledge-kind: regulation` (or `definition` if `source == '14 CFR 1.1'`).
   - `id` suffix `-ops` and `group == flight-rules` -> examine term; most are `knowledge-kind: regulation` or `definition`.
   - `source` matches `/^AIM/` -> `source-type: aim`.
   - `source` matches `/^PHAK/` -> `source-type: phak`.
   - `domain == aircraft` AND `group == performance` AND `term` starts with `V` -> `knowledge-kind: limit`, `aviation-topic: [aerodynamics, performance]`.
   - `tags contains 'instrument-flying'` -> `flight-rules: ifr`.
   - `tags contains 'vfr-operations'` -> `flight-rules: vfr`.
   - All others -> `flight-rules: both` as default, flag for review.

2. **Agent-assisted pass** (Claude, batched 20 entries at a time, human approves the diff):
   - Agent reads entry `term` + `brief` + `detail` + `source`.
   - Agent proposes multi-valued `aviation-topic`, `knowledge-kind`, `phase-of-flight`, `cert-applicability`.
   - Human reviews batch diff (~15 min per batch of 20 = ~2.5 hours for 175).

3. **Validation pass**: `bun run check` must pass. Fix anything that fails.

4. **Sanity queries**: run the five sample queries from the section above. User confirms the results match mental model. If not, taxonomy is wrong, not the tags.

Estimated total: ~6 hours of work spread across one session. Cheaper than manual, safer than regex-only.

## Open questions for user

1. **Keep `domain` or drop it?** Keeping it means authors maintain two things that can disagree. Dropping it means a migration to rebuild the `/glossary` domain-view UI around `aviation-topic[0]`. Recommendation: drop, rebuild view to group by `aviation-topic` primary (with an authored `primary-topic?: AviationTopic` field if we need a tiebreaker).
2. **Add `governance` to `aviation-topic`?** Needed for FAA/NTSB/TSA/ICAO entries. Alternative is forcing them into `regulations` + `certification` which is inaccurate. Recommendation: add.
3. **Multi-valued `knowledge-kind`?** Va is both `limit` and `concept`. Single-valued is simpler and the sample shows we can almost always pick one. Recommendation: single-valued; reopen if >10% of entries end up awkward.
4. **Where does `acs-mapping` live?** Not in the tag bag per this proposal. Separate field like `acs: ['PA.I.F.K1', 'PA.I.F.K2']`. Recommendation: separate field, validated against ACS code enum. Out of scope for this document but flagged so it doesn't leak into tags later.

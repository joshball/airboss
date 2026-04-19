# Scenario Reference Data

Standard profiles referenced by scenario scripts. Resolved at runtime against student profile and course configuration.

See also: [\_TEMPLATE.md](_TEMPLATE.md) for how these are used in scripts.

---

## Aircraft References

### Student Profile References

| Reference                     | Meaning                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `student_aircraft`            | The student's chosen/registered aircraft                                        |
| `student_aircraft_or_default` | Student's aircraft if it fits the scenario category, otherwise category default |

### Category References

Scenarios use category references when they don't care about a specific type -- only class/complexity.

| Reference                     | Category                                   | Default aircraft       | Notes                                  |
| ----------------------------- | ------------------------------------------ | ---------------------- | -------------------------------------- |
| `single_engine_not_high_perf` | SEL, <200 HP, fixed gear or simple retract | C172S                  | Most common instructional aircraft     |
| `single_engine_high_perf`     | SEL, >200 HP or complex                    | Beech A36 / Mooney M20 | Used for checkout / advanced scenarios |
| `single_engine_retractable`   | SEL with retractable gear                  | Piper Arrow PA-28R     | Gear-related scenarios                 |
| `light_twin`                  | MEL, training-category twin                | Piper Seminole PA-44   | Multi-engine scenarios                 |
| `glass_cockpit`               | Any with Garmin G1000 / G3X equivalent     | C172 G1000             | Automation scenarios (Module 1)        |
| `steam_gauge`                 | Any with traditional analog panel          | C172 classic           | Backup nav / partial panel scenarios   |

### Familiarity Override

| Value          | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| `familiar`     | Use student's own aircraft (default)                          |
| `unfamiliar`   | Deliberately assign a different aircraft in the same category |
| `forced: [id]` | Force a specific aircraft regardless of student preference    |

---

## Environment Bundles

Pre-defined condition sets. Scenario scripts reference the bundle name; individual values can be overridden inline.

| Bundle                | Conditions                 | Wind                         | Visibility | Ceiling        | Notes                                        |
| --------------------- | -------------------------- | ---------------------------- | ---------- | -------------- | -------------------------------------------- |
| `vmc_day_calm`        | VMC day                    | calm / < 5 kts               | 10+ SM     | Clear          | Baseline / no environmental stress           |
| `vmc_day_light_winds` | VMC day                    | 5-10 kts, on-runway heading  | 10+ SM     | Clear          | Normal training day                          |
| `vmc_day_crosswind`   | VMC day                    | 10-15 kts, 30-45° off runway | 10+ SM     | Clear          | Crosswind scenarios                          |
| `vmc_day_gusty`       | VMC day                    | gusting 15-22 kts            | 10+ SM     | Clear          | Adds energy management stress                |
| `vmc_evening`         | VMC, last hour of daylight | variable light               | 10+ SM     | Few at 5000    | Fatigue / lighting stress                    |
| `night_vmc`           | Night VMC                  | calm / light                 | 10+ SM     | Clear          | Night scenarios, spatial disorientation risk |
| `marginal_vmc`        | MVFR                       | variable                     | 3-5 SM     | Scattered 1500 | Module 3 / inadvertent IMC setup             |
| `imc_approach`        | IMC, ILS/GPS approach      | variable                     | 1-2 SM     | Broken 600     | Instrument scenarios                         |

---

## Airport References

| Reference            | Type                                              | Resolved as                                    |
| -------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `home_airport`       | Student's registered home airport                 | Student profile                                |
| `familiar_towered`   | Familiar, Class D, moderate traffic               | Scenario assigns from student's known airports |
| `unfamiliar_towered` | Class D, student has not trained here             | Scenario assigns -- creates workload           |
| `class_c`            | Class C, busier environment                       | Scenario assigns                               |
| `complex_taxi`       | Airport with multiple parallel taxiways, hotspots | Used in Module 3 / 4 taxi scenarios            |
| `rural_uncontrolled` | Non-towered, single runway, light traffic         | Lower-stress base                              |

---

## Aircraft-Relative Performance Parameters

Use these in tick timelines instead of hard-coded values. Resolved against the actual aircraft's performance data at runtime.

### Airspeed

| Token                      | Meaning                                               |
| -------------------------- | ----------------------------------------------------- |
| `Vso`                      | Stall speed, landing config                           |
| `Vs1`                      | Stall speed, clean                                    |
| `Vs1_plus_5`               | 5 kts above clean stall                               |
| `Vs1_plus_10`              | 10 kts above clean stall                              |
| `Vx`                       | Best angle of climb                                   |
| `Vy`                       | Best rate of climb                                    |
| `Va`                       | Maneuvering speed                                     |
| `Vfe_approach`             | Max flaps extended, approach setting                  |
| `best_glide`               | Best glide speed                                      |
| `approach_target`          | Normal approach speed (typically 1.3 Vso)             |
| `approach_target_minus_5`  | 5 kts below normal approach speed -- slow / precursor |
| `approach_target_minus_10` | 10 kts below -- getting dangerous                     |

### Config

| Token                      | Meaning                                          |
| -------------------------- | ------------------------------------------------ |
| `flaps_up`                 | Flaps retracted                                  |
| `flaps_approach`           | Normal approach flap setting (aircraft-specific) |
| `flaps_landing`            | Full landing flaps                               |
| `gear_up`                  | Gear retracted                                   |
| `gear_down`                | Gear extended                                    |
| `gear_down_flaps_approach` | Typical approach config                          |

---

## Lesson-Specific Values

These are always set per-scenario and are not standardized.

| Field                 | Notes                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| `traffic`             | `none`, `light`, `moderate`, `busy` -- scenario controls the pattern environment |
| `phase_of_flight`     | Specific to the scenario beat                                                    |
| `student.state`       | `focused`, `distracted`, `overconfident`, `saturated`, `freeze`                  |
| `student.workload`    | `low`, `medium`, `high`, `saturated`                                             |
| `cues`, `risks`       | Always lesson-specific                                                           |
| `intervention_window` | Always lesson-specific                                                           |

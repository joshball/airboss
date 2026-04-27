# A.1.1 -- Technically Advanced Airplane (TAA)

Research doc for lesson development. What the AC requires, what the CFR actually says, and what instructors need to teach accurately.

## What the FAA Wants Taught

AC 61-83K A.1.1 is short, but it is not optional. The parent A.1 section specifically says FIRC providers should include training on the **regulatory definition of TAA**.

The AC gives two key ideas:

1. **Historical FITS description:** a TAA was broadly described as an aircraft with a GPS navigator and moving map, plus additional systems.
2. **Current regulatory approach:** in 2018 the FAA defined technically advanced airplane in the regulations under `§ 61.1` and defined qualifying requirements under `§ 61.129(j)`.

For teaching purposes, the point is simple:

- CFIs must know the current regulatory definition well enough to advise students correctly.
- Casual "glass cockpit" language is not enough.

## The Regulatory Definition, Taught Correctly

Use the two CFR sections together:

- `14 CFR § 61.1` gives the general definition:
  - a technically advanced airplane is an airplane equipped with an electronically advanced avionics system
- `14 CFR § 61.129(j)` gives the installed-component criteria used to determine whether an airplane qualifies:
  - an electronic PFD that includes at least airspeed, turn coordinator, attitude, heading, altimeter, and vertical speed
  - an electronic MFD that includes at least a moving map using GPS navigation with aircraft position displayed
  - a two-axis autopilot integrated with the navigation and heading guidance system
  - the PFD and MFD display elements must be continuously visible

That is the standard to teach. Do not stop at the older FITS shorthand.

## Why the Distinction Matters

This is the key teaching use case:

- some aircraft that fit the older FITS description do **not** qualify under the current rule;
- TAA time may be used toward commercial pilot requirements only if the aircraft actually meets the regulation;
- instructors should verify the installed equipment, not rely on marketing language, owner assumptions, or "it looks glassy enough" reasoning.

Practical implications for CFIs:

- a moving-map GPS alone is not enough;
- a glass display without the required autopilot is not enough;
- a wing-leveler is not enough if it does not satisfy the two-axis integrated-autopilot requirement;
- aftermarket equipment can qualify if the installed system meets the rule.

## TAA Teaching Emphasis for CFIs

The FAA's TAA point is not just classification. It also connects back to the main A.1 safety concern:

- integrated avionics change workload and failure modes;
- pilots still need airplane limitations, system limitations, and manufacturer procedures;
- glass-cockpit transition training should go beyond button-pushing;
- pilots should not let automation erode manual-control proficiency;
- transition training should come from an instructor experienced in the specific make, model, and equipment.

## Common Points of Confusion

- **"Any glass cockpit airplane is a TAA."**
  - False. The regulation requires a specific set of installed components.

- **"The FITS definition is still the operational standard."**
  - False. It is useful historical context, not the current regulatory test.

- **"Factory-installed avionics are required."**
  - False. The question is whether the installed equipment meets the regulatory criteria.

- **"A basic wing-leveler counts as the required autopilot."**
  - Not if it does not meet the regulation's two-axis integrated-autopilot language.

- **"TAA is a certification category."**
  - False. It is an equipment-based classification in this context.

- **"TAA in an instrument approach plate means technically advanced airplane."**
  - False. On approach charts, TAA often means Terminal Arrival Area. The acronym overlap is real, but it is a different concept.

## Reference Sources

### Primary

- `AC 61-83K`, Appendix A, Section A.1.1
- `docs/faa-docs/part-61.md`
  - `§ 61.1` for the general definition
  - `§ 61.129(j)` for the qualifying component list

### FAA Publications to Use for Supporting Detail

- current `Advanced Avionics Handbook`
- current `Instrument Flying Handbook`
- current `Airplane Flying Handbook`
- manufacturer POH / AFM and avionics pilot guides

### Internal References

- `OVERVIEW.md` in this directory for the AC text
- `docs/firc/FIRC_CONTENT_REFERENCE.md` for a concise internal summary of the component list

## Teaching Ideas

### Highest-Value Exercise

**"Does this airplane actually qualify as a TAA?"**

Present several real-world aircraft configurations and make the CFI apply the rule:

- GPS and moving map, no autopilot
- glass PFD / MFD with no qualifying autopilot
- aftermarket PFD / MFD plus compliant integrated two-axis autopilot
- one display arrangement that fails the "continuously visible" requirement

The point is to teach verification, not casual recognition.

### Discussion Prompts

- "What exact equipment would you verify before logging TAA time?"
- "What older aircraft upgrades can qualify, and why?"
- "How would you explain the difference between FITS history and current regulation to a commercial applicant?"
- "What does TAA transition training need to cover beyond button knowledge?"

### Common Misconceptions to Address

- "If it has a glass panel and an autopilot, it qualifies."
- "Only Cirrus, Diamond, and G1000 aircraft count."
- "The regulation only matters to checkride examiners."
- "Acronym familiarity equals regulatory understanding."

## Our Existing Content

### Questions

- `Q-A1-17` through `Q-A1-26`
- Strong current coverage of:
  - FITS versus regulatory definition
  - verification of actual installed equipment
  - why FIRC must include the TAA definition
  - transition-training implications

### Scenario Coverage

- `SCN 1.6` is useful, but it covers **TAA as Terminal Arrival Area**, not the regulatory definition of technically advanced airplane.
- That makes it good supporting coverage, not primary A.1.1 coverage.

## Highest-Priority Gaps

- No dedicated scenario where the instructor must determine whether a specific aircraft **does or does not qualify** as a TAA
- No direct scenario on logbook / training-credit judgment for `§ 61.129(j)` use
- No explicit treatment of display-failure / reversionary considerations unique to integrated avionics

If only one thing gets added, it should be a **TAA qualification / logging decision** scenario. That is the clearest direct application of the FAA's required subtopic.

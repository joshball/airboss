# A.1 Research Rewrite Guidance

Date: 2026-04-09
Scope: Lessons learned from reviewing and rewriting the A.1 GPS / Automation / TAA research set.

## Purpose

This note captures the standards that would have produced a stronger first draft. It is meant to help the next agent build the remaining topic research docs with better source fidelity, clearer teaching emphasis, and cleaner handoff into lesson design.

## General Findings

The original A.1 set understood the spirit of the FAA requirement well. It correctly centered automation hazards, manual proficiency, and the need for CFIs to teach modern avionics without creating automation-dependent pilots.

Where it fell short was mostly not intent, but method:

- It sometimes paraphrased regulations instead of pulling the exact CFR text the AC pointed to.
- It occasionally turned FAA guidance language such as "should" into language that read like a hard requirement.
- It mixed three different layers of content together:
  - what the AC explicitly requires,
  - what supporting FAA sources can reasonably add,
  - what are useful but still-unsourced local teaching ideas.
- A few scenarios were clever or adjacent, but not tightly aligned with the exact skill the FAA wanted taught.
- Some detailed claims were left as TODOs or semi-sourced notes even though they were presented close to finished teaching content.

## What A Better Agent Would Have Done

### 1. Start with the AC and extract the non-negotiables first

For each topic, begin by turning the AC text into a short list of:

- Required knowledge the provider must cover
- Required supporting subtopics
- Required instructor behaviors or teaching outcomes

For A.1, that list should have been built directly from the AC before any expansion:

- Know what automation can and cannot do
- Teach airplane limitations, system limitations, and manufacturer procedures
- Recognize and correct automation-based risky behavior
- Prevent overdependence on GPS/automation
- Preserve pilotage, dead reckoning, VOR, and manual-control proficiency
- Teach that no single level of automation fits every situation
- Prepare pilots for partial or complete automation failure
- Include the regulatory definition of TAA, plus an overview of ADS-B and NextGen

If those points are clear first, the rest of the document stays proportionate.

### 2. When the AC cites a regulation, pull the actual regulatory text

Do not rely on memory or secondary paraphrase when the AC names a CFR section.

For A.1.1, the better workflow would have been:

- Open `docs/faa-docs/part-61.md`
- Pull `14 CFR § 61.1` for the general definition
- Pull `14 CFR § 61.129(j)` for the installed-component criteria
- Teach them together, but do not blur their roles

This matters because:

- `§ 61.1` gives the general definition of TAA
- `§ 61.129(j)` gives the practical component list used to determine whether an airplane qualifies

The same rule applies elsewhere:

- If the topic cites `§§ 91.225` and `91.227`, copy the full operationally relevant list before summarizing it
- If a topic cites a handbook or AIM section, use that as the basis for detail rather than filling gaps from memory

### 3. Separate required content from supporting elaboration

Each research doc should clearly distinguish:

1. FAA-required content
2. FAA-supported explanatory detail
3. Internal teaching ideas or future research

The first draft often blended these. A stronger structure is:

- `What the FAA Wants Taught`
- `Regulatory / Primary Source Anchors`
- `Supporting Knowledge to Teach Well`
- `Teaching Ideas`
- `Existing Content`
- `Highest-Priority Gap`

That structure prevents a future lesson writer from mistaking an internal interpretation for an FAA requirement.

### 4. Use modal language carefully

Treat these words as meaningful:

- `must` only when the regulation or the AC clearly imposes a hard requirement
- `should` when the AC recommends or advises
- `may` or `can` for optional or contextual practices

In A.1, transition training was a good example. The AC says pilots transitioning to TAA or unfamiliar aircraft `should receive` specialized transition training. The first draft sometimes wrote that as if it were strictly `required`.

That kind of wording drift creates avoidable legal and instructional ambiguity.

### 5. Prefer primary FAA sources over attractive secondary detail

When building topic knowledge:

- Prefer the AC, CFR, AIM, FAA handbooks, FAA Safety Team, and manufacturer-approved operating guidance
- Use industry sources only for examples or illustrations
- Do not anchor a core teaching point to an unsourced accident anecdote or a memory of an article

If a claim is useful but not yet sourced, label it clearly as one of:

- `TODO: source before teaching`
- `Optional case study, not yet sourced`
- `Internal idea, not primary-source validated`

Do not leave it adjacent to finalized teaching bullets as if it were ready for delivery.

### 6. Keep overview topics at overview depth

A.1.3 was the clearest example. The AC requires `an overview of NextGen`, not an exhaustive modernization seminar.

A better agent would have:

- centered the five areas named in the AC,
- explained at a GA/CFI level why NextGen matters,
- used only a few current examples such as RNAV procedures, ADS-B, and evolving communications,
- avoided letting A.1.3 expand until it overshadowed the main A.1 automation-hazard lesson.

Rule of thumb:

- if the AC says `overview`, keep the doc overview-first
- only go deeper when the extra detail directly supports a teaching decision, a scenario, or a likely student misconception

### 7. Build scenarios around the exact instructional skill

A useful scenario is not just adjacent to the topic. It should test the exact knowledge or judgment the FAA wants the instructor to have.

For A.1.1, the highest-value scenario would have been:

- `Does this airplane actually qualify as a TAA under the regulation?`

The existing scenario about `TAA = Terminal Arrival Area` is fine as acronym awareness, but it does not replace a scenario that exercises the regulatory-definition skill.

For future topics, ask:

- What is the exact failure mode, decision, or misconception the AC is trying to prevent?
- Does the scenario make the instructor practice that?

If not, it is secondary coverage, not primary coverage.

### 8. Tie the research doc to the actual internal content inventory

The doc should tell the next writer:

- which questions already cover the topic well,
- which scenarios already carry the teaching burden,
- which gaps still matter most,
- and which gap to address first if there is only time to add one thing.

That last point is important. Each research doc should end with one clear priority, not a long undifferentiated wish list.

### 9. Avoid stale precision when you do not need it

Edition letters, current deployment claims, statistics, and implementation status go stale quickly.

Use them only when:

- they are necessary to teach the point,
- they are sourced from a current primary FAA source,
- and the exact value matters.

Otherwise prefer durable wording such as:

- `current AIM guidance`
- `current manufacturer pilot guide`
- `current FAA NextGen materials`

This keeps research docs from aging badly.

### 10. Make the "why this topic matters" explicit

Each topic should include one plain-language paragraph that says what safety problem or instructional failure the FAA is trying to avoid.

For A.1, the shortest accurate version is:

> The FAA wants CFIs to teach modern avionics without producing brittle, heads-down, automation-dependent pilots who cannot safely revert to basic flying and navigation skills.

That sentence should guide every supporting choice in the document.

## Recommended Standard for Remaining Topics

Use this outline unless there is a strong reason not to:

## What the FAA Wants Taught

- Paraphrase the AC tightly
- List the non-negotiable teaching points

## Primary Source Anchors

- AC section
- Named CFR sections
- Named AIM / handbook / FAA publication sections when needed

## Teaching Emphasis for CFIs

- What instructors must know
- What they must notice in students
- What they must correct

## Supporting Knowledge

- Useful explanatory detail that helps teach the topic well
- Clearly subordinate to the AC and regulations

## Teaching Ideas

- Scenarios
- Discussion prompts
- Common misconceptions

## Existing Internal Coverage

- Questions already written
- Scenarios already written
- Coverage strengths

## Highest-Priority Gap

- One concrete gap to fix first

## Rewrite Checklist

Before considering a topic doc complete, verify:

- Every regulation cited in the AC has been checked against the actual CFR text
- `must`, `should`, and `may` are used deliberately
- Required content is visibly separated from supporting explanation
- Unsourced anecdotes are removed or clearly marked as not ready
- Scenario recommendations match the exact required skill
- The doc ends with one prioritized gap, not a grab bag

## Best Short Instruction for a Future Agent

If you only give one instruction to the next agent rewriting another topic, use this:

> Start from the AC, pull the exact regulations it cites, separate required content from helpful expansion, and design examples that test the exact instructional failure the FAA is trying to prevent.

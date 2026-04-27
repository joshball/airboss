---
# === Identity ===
id: nav-marker-beacon-recognition
title: Marker Beacon Recognition
domain: ifr-procedures
cross_domains:
  - aircraft-systems

# === Knowledge character ===
# perceptual: marker beacons present as audio tones plus light flashes.
#   Recognising them in real time, especially during workload at the FAF,
#   is a perceptual skill.
# factual: there are three types (outer, middle, inner) with specific
#   tone frequencies, light colors, and approximate distances from the
#   threshold.
# procedural: the action when a marker fires is a position fix that
#   confirms (or contradicts) other position references on the approach.
knowledge_types:
  - perceptual
  - factual
  - procedural
technical_depth: working
stability: evolving
# Stability is "evolving" because marker beacons are increasingly being
# decommissioned as DME / RNAV / GPS provide equivalent fixes. They
# remain in service at many airports but new ILS installations often
# omit them.

# === Cert + study priority ===
minimum_cert: instrument
study_priority: standard
requires:
  - nav-localiser-and-glide-slope-tracking
deepens: []
applied_by: []
taught_by: []
related:
  - nav-instrument-approach-structure
  - proc-instrument-cross-check

# === Content & delivery ===
modalities:
  - reading
  - cards
  - drill
estimated_time_minutes: 30
review_time_minutes: 5

# === References ===
references:
  - source: AIM
    detail: 1-1-9 -- Instrument Landing System (ILS); marker beacon section
    note: >-
      Authoritative on marker beacon types, frequencies, light colors,
      and operational use. Notes that markers are progressively being
      decommissioned and replaced by DME / RNAV equivalents.
  - source: Instrument Procedures Handbook (FAA-H-8083-16B)
    detail: Chapter on instrument approaches; ILS components
    note: >-
      The standard reference for marker beacons in the context of an
      ILS approach.
  - source: Approach plates (specific airport)
    detail: Plan view; profile view; identifier symbols (OM, MM, IM)
    note: >-
      The plate shows whether markers are part of the procedure;
      modern plates may use DME or GPS fixes in lieu of markers.
  - source: AC 90-100A
    detail: U.S. Terminal and En Route Area Navigation (RNAV)
    note: >-
      The trend: RNAV replaces traditional ground-based navaids.
      Marker beacons are part of the legacy infrastructure being
      retired.

# === Assessment ===
assessable: true
assessment_methods:
  - recall
  - scenario
mastery_criteria: >-
  Learner can: (1) identify the three marker beacon types (OM, MM, IM)
  by tone frequency, light color, and approximate distance from
  threshold; (2) describe the audio and visual presentation in the
  cockpit; (3) explain the role of markers as a position fix on the
  ILS (FAF / typical decision zone); (4) recognise that markers are
  increasingly being replaced by DME or GPS fixes; (5) demonstrate
  the in-flight response to a marker beacon firing (acknowledge, cross-
  check position, continue or react as appropriate).
---

# Marker Beacon Recognition

## Context

Marker beacons are small VHF transmitters set on the ground along the approach path of an ILS. They emit a 75 MHz signal upward in a narrow vertical fan beam; an airplane flying over the beam (and tuned to receive it) hears a tone in the headset and sees a colored light on the panel for a few seconds. The beacon does not provide course guidance; it provides a position fix. "When you hear the tone and see the light, you are over this point."

Three types are standardised. The outer marker (OM) is at the FAF for most ILS approaches, typically 5-7 NM from threshold. The middle marker (MM) is 2,500-3,500 feet from threshold, near the decision altitude position on a CAT I ILS. The inner marker (IM) is even closer, used only on CAT II / III ILS approaches with auto-land equipment.

Marker beacons are increasingly being decommissioned. New ILS installations often omit them; existing ones are retired as DME / GPS / RNAV provide equivalent (and more precise) position fixes. A pilot in 2025 should know what marker beacons are, recognise them when they fire, and not rely on them as the only position reference -- the trend is away from them.

This node is about the perceptual skill of recognising marker beacons in flight, the factual content of the three types, and the connection to the broader ILS approach structure.

## Problem

You are flying an ILS to a Class C airport. You have just been cleared for the approach. The plate shows an outer marker at 5.4 NM from threshold, FAF altitude 2,800 MSL. As you intercept the localiser and approach the FAF, you hear a low-frequency tone in your headset that resembles a steady "boop, boop, boop" pattern. You see a purple light flash on the panel. Your DME shows 5.4 NM from threshold; your altitude is 2,800.

What just happened? What does it confirm? What is your next action?

Write your answer before reading on. Then ask: what would you do if the marker fired but the DME and altitude did not match?

## Discover

The recognition decomposes into the three types and what each tells you. Work through.

### Q1. What are the three marker types?

| Marker | Tone (Hz) | Light color | Audio pattern        | Distance from threshold |
| ------ | --------- | ----------- | -------------------- | ----------------------- |
| Outer  | 400 Hz    | Purple/Blue | --- (continuous dashes) | 5-7 NM                |
| Middle | 1,300 Hz  | Amber       | -.-.- (dot-dash alternating) | 0.5-0.7 NM (3,500 ft) |
| Inner  | 3,000 Hz  | White       | ... (continuous dots, very fast) | 0.1 NM (1,000 ft) |

Note: the audio Morse pattern (dots, dashes) is encoded in the audio tone; the actual tone frequency is one of the three above (400, 1300, 3000). In the cockpit, you hear the tone with the modulation pattern. Pilots learn the tones by ear.

### Q2. How is the audio different in the cockpit?

The 400 Hz outer marker is a low pitch. It sounds like a slow boop-boop. Two boops per second-ish.

The 1,300 Hz middle marker is a higher pitch. The dot-dash modulation is audible. It sounds different from the outer marker; you would not confuse them by ear.

The 3,000 Hz inner marker is high-pitched and fast. The dot pattern is rapid. Aircraft equipped to fly CAT II/III ILS have IM receivers; many GA aircraft do not have IM-capable equipment.

### Q3. What is the visual presentation?

A panel-mounted marker beacon receiver lights three lights: blue/purple (OM), amber (MM), white (IM). When the airplane crosses a marker, the corresponding light flashes for a few seconds.

Some installations have a single multi-color light or a digital indication. Modern glass cockpits (G1000 etc.) display the marker beacon graphically.

The sequence on a complete ILS approach (CAT I): purple light at OM, then amber at MM. CAT II/III: also white light at IM.

### Q4. What does the marker tell you operationally?

The marker is a position fix at the moment of activation. Combine with altitude and other references:

- OM at 5.4 NM, 2,800 MSL: you are at the FAF, on glide slope (assuming you intercepted GS at the FAF).
- MM at 0.5 NM, 250 AGL: you are at the published decision altitude position on the approach.
- Discrepancy: marker fires but altitude / DME / GPS disagree. Possible causes: DME unlocked from ILS, drift, marker mis-tuned, GPS error, you are off course. Cross-check.

### Q5. Why are markers being retired?

DME / RNAV / GPS all provide position fixes that are continuous (not just at one point), more precise, and integrated with other navigation. The marker beacon's "you are here for 4 seconds" is replaced by "you are at 5.4 NM right now, 5.3 NM in two seconds."

Maintenance: marker beacons are radio transmitters that age, break, and require periodic certification. Operators of ILS facilities have moved away from them as the equivalent fix can be provided by DME on the localiser channel.

Modern installations often have:

- DME at the localiser frequency (on-ILS DME).
- GPS waypoints in the published approach.
- No marker beacons.

A pilot should not be surprised to fly an ILS with no marker beacons today. The plate will indicate which fixes are markers vs. DME / GPS.

### Q6. What about the radio receiver?

A marker beacon receiver is a separate radio unit (or function within a multi-function radio) tuned to 75 MHz. It is a fixed-frequency receiver -- you do not tune it like a localiser radio.

Most light-single ILS-capable airplanes have a marker beacon receiver. It may be in the audio panel, with selector switches for monitoring. Some installations have a "high/low/off" sensitivity selector for the audio.

Glass cockpit installations integrate the marker indication into the PFD or audio panel display.

### Q7. What if a marker is decommissioned?

The plate will show the FAF or other fix as a DME, GPS, or VOR fix instead of as a marker. The procedure is unchanged in concept; the position reference is just different.

If a marker that you are expecting does not fire:

- Check the plate -- is it actually published as a marker for this approach?
- Check the marker beacon switch -- is the receiver on?
- Check the audio panel -- is marker monitoring enabled?
- Cross-check with DME / GPS -- are you at the published distance?
- If the marker is published but not firing, it may be NOTAMed out of service. The ATIS or NOTAMs should mention it.

### What Discover should have led you to

- Three marker types: OM (purple, low tone, slow), MM (amber, mid tone, dot-dash), IM (white, high tone, rapid dots).
- The marker is a position fix, not course guidance. It confirms "you are here."
- Markers are increasingly retired in favour of DME / GPS fixes.
- Use markers as a cross-check, not as the primary reference.
- A missing marker may be decommissioned, NOTAMed, or your radio may be off / not enabled.

## Reveal

### The summary rule

> Marker beacons are 75 MHz fixed-frequency upward-pointing transmitters at fixed points along an ILS approach. Three types: outer (purple, 400 Hz, slow dashes, FAF), middle (amber, 1,300 Hz, dot-dash, near DA), inner (white, 3,000 Hz, rapid dots, CAT II/III only). Recognise the audio and visual presentation; use as a position cross-check; do not rely as the primary fix when DME / GPS is available. Many markers are being decommissioned; check the plate and NOTAMs.

### The three markers in detail

| Property                | Outer (OM)   | Middle (MM)         | Inner (IM)        |
| ----------------------- | ------------ | ------------------- | ----------------- |
| Audio frequency         | 400 Hz       | 1,300 Hz            | 3,000 Hz          |
| Modulation              | Continuous dashes | Dot-dash alternating | Continuous dots (fast) |
| Light color             | Purple/Blue  | Amber               | White             |
| Distance from threshold | 5-7 NM       | 2,500-3,500 ft (0.5-0.7 NM) | ~1,000 ft (0.1 NM) |
| Used in                 | CAT I, II, III | CAT I, II, III   | CAT II, III only  |

### Recognition: by ear

The OM and MM are clearly distinguishable by ear. A pilot who has flown a few ILS approaches recognises the tone difference. The IM is rare in GA cockpits.

A simple test: if the tone is low and slow ("BOOP -- BOOP -- BOOP"), it is the OM. If the tone is higher with dot-dash modulation ("doodot -- doodot"), it is the MM. If you do not know, look at the light color.

### Recognition: by light

A modern cockpit has the marker light(s) in a clear position on the audio panel or PFD. Glass cockpits have a "MKR" or marker icon that flashes appropriately.

If the radio is off or the audio is muted, the light still flashes; pilots should keep marker monitoring enabled at least during ILS approaches.

### Operational use

The OM at the FAF is the most operationally significant marker. Many pilots use it as the cue to:

- Initiate descent on glide slope (if not already established).
- Verify altitude crossing (GS intercept altitude or FAF altitude).
- Check timing: stopwatch may be started for time-to-MAP backup.
- Final radio call to tower if approaching towered airport: "tower, Cessna 12345, marker inbound, gear down, full stop."

The MM is near DA. Some pilots glance up at MM activation, knowing they are close to decision: "if I don't see the runway in the next few seconds, I'm going around."

The IM is for CAT II/III auto-land work. Most GA pilots will never hear it.

### Markers and the modern plate

A modern ILS plate may show:

- Outer marker: published as MARKER or "OM" symbol; or replaced by an LOC/DME fix at the same position.
- Middle marker: published, or replaced by an LOC/DME fix at the same position; or omitted entirely.

The procedure works the same way; the position fix is just provided by different equipment.

### What is actually authoritative

In descending order:

1. **The published approach plate** for the specific approach.
2. **AIM 1-1-9** -- ILS section; marker beacons.
3. **NOTAMs** -- marker outages, decommissioning announcements.
4. **IPH Chapter 4** -- approach procedures.

### location_skill

- AIM 1-1-9 -- read the marker section.
- Listen to ILS approaches with marker monitoring enabled (live ATC or simulator) -- learn the tones by ear.
- Practice on the actual airplane: with a CFII, fly several ILS approaches with attention to the markers; the auditory fingerprint is acquired in 3-5 exposures.

## Practice

### Cards (spaced memory items)

- `card:mb-om-tone-and-light" -- "Outer marker tone and light?" -> "400 Hz; purple/blue light; continuous dashes."
- `card:mb-mm-tone-and-light" -- "Middle marker tone and light?" -> "1,300 Hz; amber light; dot-dash alternating."
- `card:mb-im-tone-and-light" -- "Inner marker tone and light?" -> "3,000 Hz; white light; rapid dots; CAT II/III only."
- `card:mb-om-distance" -- "Outer marker typical distance from threshold?" -> "5-7 NM (typically at the FAF)."
- `card:mb-mm-distance" -- "Middle marker typical distance from threshold?" -> "About 0.5-0.7 NM (2,500-3,500 ft)."
- `card:mb-frequency" -- "Marker beacon broadcast frequency?" -> "75 MHz (all three types)."
- `card:mb-purpose" -- "What does a marker beacon provide?" -> "Position fix at a specific point along the approach (not course guidance)."
- `card:mb-decommissioning" -- "Why are markers being retired?" -> "DME / GPS / RNAV provide more precise and continuous position fixes."
- `card:mb-cross-check" -- "Use of marker in a modern cockpit?" -> "Position cross-check at FAF / DA; not primary reference; verify with DME and altitude."
- `card:mb-cat-i-vs-cat-iii" -- "Which CAT levels use the inner marker?" -> "CAT II and CAT III only."

### Reps (scenario IDs)

- `scenario:mb-om-firing-as-faf" -- ILS with OM at FAF; learner verifies altitude and DME match marker activation.
- `scenario:mb-mm-near-da" -- MM fires shortly before DA; learner uses as DA-area cue.
- `scenario:mb-no-marker-modern-plate" -- modern ILS plate with no markers; learner uses DME and GPS for the same fixes.
- `scenario:mb-marker-fires-with-disagreement" -- OM fires but DME shows 6.8 NM (not the published 5.4); learner cross-checks and goes missed.
- `scenario:mb-marker-receiver-off" -- marker receiver off; learner identifies why FAF marker didn't fire and corrects.

### Drills (time-pressured)

- `drill:mb-tone-recognition" -- audio drill; learner identifies marker type by tone within 3 seconds.
- `drill:mb-light-recognition" -- visual drill; learner identifies marker type by light color and pattern.
- `drill:mb-cross-check" -- given a marker activation and DME / GPS reading, learner identifies whether they match.

### Back-of-envelope calculations

**Calculation 1: time over outer marker.**

OM at 5.4 NM, 2,800 MSL, typical 90 KIAS approach speed:

```text
ground speed at 80 kt with 10-kt headwind: 80 - 10 = 70 GS (approx)
distance to threshold: 5.4 NM
time at 70 GS: 5.4 / 70 * 60 = ~4.6 minutes
```

So OM activation is about 4.5-5 minutes from threshold at typical light-single ILS ground speeds.

**Calculation 2: time between OM and MM.**

OM at 5.4 NM, MM at 0.5 NM:

```text
distance between markers: 5.4 - 0.5 = 4.9 NM
time at 70 GS: 4.9 / 70 * 60 = ~4.2 minutes
```

So MM activation is about 4 minutes after OM. The pilot has that time to descend from FAF altitude to DA.

**Calculation 3: GS angle calculation if OM altitude is known.**

OM at 5.4 NM, FAF altitude 2,800 MSL:
TCH (threshold crossing height) typical 50 ft AGL.
Threshold altitude: airport elevation + 50.

Assume airport elevation 800 MSL, so threshold ~850 MSL.

```text
height_at_OM = FAF altitude - threshold altitude
             = 2800 - 850 = 1950 ft
distance_OM_to_threshold = 5.4 NM = 32,800 ft

GS angle = atan(1950 / 32,800)
         = atan(0.0594)
         = ~3.4 degrees
```

Slightly higher than the standard 3-degree GS; consistent with terrain-adjusted GS at some airports.

## Connect

### What changes if...

- **...you are flying glass cockpit?** Marker beacon indications appear on the PFD or audio panel as graphical / digital callouts. Same operational meaning.
- **...you are flying a non-precision approach (LOC-only or VOR)?** No glide slope means no GS-based descent profile; markers are still potentially present as position fixes (FAF, MAP). LOC-only without GS still has the OM if the OM has not been decommissioned.
- **...the airport has DME on the localiser?** DME provides a continuous distance reference; the OM is redundant for the FAF fix. Most pilots prefer DME because it shows the trend, not just a snapshot.
- **...you are flying RNAV / LPV approach?** GPS waypoints replace markers entirely. RNAV approaches do not have marker beacons.
- **...the marker beacon receiver fails?** No light, no tone. Use DME / GPS for position fixes. The approach can still be flown.
- **...you fly internationally?** ICAO standards align with FAA; tone frequencies and colors are the same. Some countries have decommissioned more aggressively than others.
- **...you are on a checkride?** Examiner may ask you to identify markers by tone or light. Be ready.

### Links

- `nav-localiser-and-glide-slope-tracking` -- the parent ILS knowledge.
- `nav-instrument-approach-structure` -- where markers fit in the published approach.
- `proc-instrument-cross-check` -- the scan that includes marker monitoring.
- `nav-gps-rnav-concepts` -- the modern replacement for marker-based fixes.

## Verify

### Novel scenario (narrative)

> You are flying an ILS approach to a non-towered airport. The plate shows an OM at 6.0 NM, FAF altitude 2,500. You have intercepted the localiser; you are stable on the LOC at 2,500 with the GS alive. As you cross 6.0 DME, you hear no tone and see no light. You quickly check the audio panel: marker monitoring is on. The radio is on. The light has not flashed.
>
> Diagnose what may have happened and what you do.

Scoring rubric:

- Identifies possibilities: marker decommissioned (NOTAM); marker out of service (NOTAM); receiver malfunction; you are not at the OM (DME unlocked or you are off course). (3)
- Cross-checks DME and GPS for position; verifies you are actually at 6.0 NM. (2)
- Cross-checks altitude: 2,500 at the published FAF altitude. (1)
- Cross-checks the GS: you are on glide slope. (1)
- Decides: continue the approach (the position fix is confirmed by DME and altitude; the missing marker is informational). (2)
- Notes the missing marker for post-flight: check NOTAMs at home base; report if not previously NOTAMed. (1)
- Continues the approach normally to DA. (2)

12/12 is the bar. Below 9 is a redo.

### Teaching exercise (CFII)

> An instrument-rating candidate, in the simulator, consistently misses the audio cue from the OM. They are heads-down, focused on the localiser and glide slope needles, and the marker tone goes by without reaction. When asked, they say "I figured the DME was telling me where I was anyway."
>
> Diagnose and write the in-flight cue plus the post-flight teaching point.

Evaluation criteria:

- Diagnosis: candidate is correct that DME provides the same fix; they are also missing the redundancy benefit of a cross-check. The marker fires for a reason: independent confirmation of position.
- In-flight cue: short, e.g., "Marker."
- Post-flight teaching point: marker is a free cross-check. If DME shows you at the FAF and the marker fires, both confirm. If they disagree, you have a problem to solve. Listening for the marker is a 0-cost addition to the scan.
- Drill assigned: next 5 ILS approaches in the simulator, candidate is required to verbally call out marker activation as it occurs ("Outer marker, FAF, 2,500 confirmed").
- The CFII names the trap: candidates who treat redundancy as duplication often miss the moment when the redundancy disagrees and saves them. Build the call-out habit.

The pedagogical move is to convert "the marker is unnecessary because I have DME" into "the marker is a free additional check that I should use." The candidate's logic is sound but their model is incomplete.

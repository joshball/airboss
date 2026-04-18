---
name: ATC Comms Drill
id: prd:aud:atc-comms-drill
tagline: Hear the call, speak the readback, get graded
status: idea
priority: 4
prd_depth: light
category: audio
platform_mode:
  - audio-passive
  - daily-desk
audience:
  - student-pilot
  - private-pilot
  - instrument-pilot
  - returning-pilot
complexity: high
personal_need: 3
depends_on: []
surfaces:
  - audio
  - mobile
content_reuse:
  - airspace-rules
last_worked: null
---

# ATC Comms Drill

## What it does

You hear an ATC clearance or instruction. You speak the readback. Speech recognition checks it for correctness. Builds clearance-readback fluency so you're not the one blocking the frequency.

## Core features

- Realistic ATC audio prompts for clearances, handoffs, and instructions
- Speech recognition grades your readback for correct callsign, altitude, heading, frequency
- Progressive difficulty: VFR traffic advisories -> Class C -> IFR clearances -> complex amendments
- Common mistake detection: wrong altimeter, transposed numbers, missed restrictions
- Practice specific scenarios: ATIS copy, IFR clearance, approach clearance, hold instructions

## Notes

High complexity due to aviation-specific speech recognition -- standard STT struggles with alphanumeric callsigns and aviation phraseology. May need fine-tuned models or structured input as fallback. Huge value for student and returning pilots who freeze on the radio.

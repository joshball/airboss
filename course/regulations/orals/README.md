# Orals -- the integration bank

Every week of the FAR navigation course ends with an oral exam segment. This directory collects the full oral bank, indexed by topic and difficulty.

## How the orals work

The orals are the integration pillar of the course (per [README.md](../README.md)). A single question pulls from multiple regulations; answering it requires the structural map of Title 14 in the learner's head, not memorized facts.

Each oral is a self-contained markdown file with:

- The exact prompt
- What the question is testing
- A model answer (full walkthrough, with regulatory citations)
- Common failure modes
- Variant prompts that exercise the same machinery from different angles

See [DESIGN.md](../DESIGN.md) for the authoring template.

## Index

### Capstone (Week 10)

| Title | Pulls from | Difficulty |
| --- | --- | --- |
| [Night IFR with a passenger](night-ifr-passenger.md) | 91.103, 61.57, 91.409, 91.411, 91.413, 91.205, 91.211, 91.167, 91.169, 91.171, 91.215, 91.225, 91.203, 91.7, 91.213 | capstone |

### Working (Weeks 4-9)

(To be written. Expected: roughly 3-5 orals per week from Week 4 onward.)

### Foundation (Weeks 1-3)

(To be written. Expected: 1-2 orals per week, single-topic and lighter integration.)

## Difficulty rubric

| Difficulty | Definition | Typical regulations cited |
| --- | --- | --- |
| foundation | Single-topic recall and location | 1-3 sections |
| working | Two- or three-step integration | 4-7 sections |
| challenge | Multi-step integration with a curveball | 6-10 sections |
| capstone | Full integration across multiple parts | 10+ sections |

## Authoring posture

- The oral prompt is delivered exactly as a CFI examiner would deliver it. No softening, no scaffolding.
- The model answer is **complete** -- a learner reading it should be able to deliver the same answer.
- The "what goes wrong" section is the most important section after the answer. It's where misreadings get diagnosed.
- Variant prompts exist to break the memorization shortcut. The examiner can change one variable and the answer changes.

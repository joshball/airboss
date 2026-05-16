---
key: metar-cloud-cover
term: METAR cloud cover
related: [ceiling, flight-rule-tiers, metar-weather-phenomena]
---

# METAR cloud cover

A METAR reports sky condition as one or more **cloud layers**, each written as a three-letter coverage code followed by the layer's height in hundreds of feet above ground level. The coverage code answers a single question: what fraction of the sky, in eighths (oktas), does that layer cover?

| Code  | Plain English | Sky coverage |
| ----- | ------------- | ------------ |
| `SKC` | clear         | 0 oktas      |
| `FEW` | few           | 1 to 2 oktas |
| `SCT` | scattered     | 3 to 4 oktas |
| `BKN` | broken        | 5 to 7 oktas |
| `OVC` | overcast      | 8 oktas      |

`SCT040` means a scattered layer with bases at 4,000 ft AGL. `BKN012 OVC025` means a broken layer at 1,200 ft with an overcast deck above it at 2,500 ft.

The split between `SCT` and `BKN` is the one that matters operationally: a **broken or overcast layer constitutes a ceiling**, a scattered or few layer does not. That single distinction is what flips a station between VFR and IFR for the same cloud bases -- a `SCT008` station is VFR with a low scattered layer, while a `BKN008` station is IFR with an 800 ft ceiling. Read the coverage code before the height; it tells you whether the height is a ceiling at all.

Layers are reported lowest-first, and each layer's coverage is the **cumulative** sky covered at and below that height -- so a `BKN` layer reported above a `SCT` layer means the sky is broken counting both layers together, not that the upper layer alone is broken.

References: **AC 00-45H** (Aviation Weather Services, METAR/SPECI section) for the coverage-code format; **FAA-H-8083-28B** Chapter 24 (Surface Observations) for the modern consolidated treatment; **AIM 7-1** for operational use.

Learn more: [wx-reading-metars](/reference/knowledge/wx-reading-metars).

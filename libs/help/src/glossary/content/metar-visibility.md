---
key: metar-visibility
term: Visibility (METAR field)
related: [ceiling, flight-rule-tiers, metar-weather-phenomena]
---

# Visibility (METAR field)

In a METAR, **visibility** is the surface-level prevailing visibility -- the greatest horizontal distance, reported in statute miles, over which objects can be seen and identified across at least half the horizon circle. It sits in the report immediately after the wind group, written as a whole number, a fraction, or a mix: `10SM`, `1 1/2SM`, `1/2SM`.

This is the **reported field**, distinct from visibility as a meteorological phenomenon (why the air is hazy, foggy, or full of smoke -- covered by the [fog and visibility obstructions](/reference/knowledge/wx-fog-and-visibility-obstructions) node). The METAR field is the single number you read off the strip and feed into a go/no-go decision; the node explains what drives that number up or down.

Two visibility values can appear in one report. The main group is prevailing visibility. When visibility varies sharply by direction, a separate **RVR** group (`R06/2400FT`) gives runway visual range -- a sensor-measured value down a specific runway, used for instrument-approach minimums. RVR, when present, overrides prevailing visibility for the approach it serves.

Visibility is one of the two inputs (with [ceiling](/reference/glossary/ceiling)) to the flight-rule tier, and it is frequently the limiting one: fog, mist, and precipitation cut visibility long before they lower a ceiling.

References: **AC 00-45H** (Aviation Weather Services, METAR/SPECI section) for the reporting format; **FAA-H-8083-28B** Chapter 24 for the modern treatment; **AIM 7-1** for operational use.

Learn more: [wx-reading-metars](/reference/knowledge/wx-reading-metars).

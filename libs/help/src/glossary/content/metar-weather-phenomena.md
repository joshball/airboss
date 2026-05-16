---
key: metar-weather-phenomena
term: METAR weather phenomena codes
related: [metar-cloud-cover, metar-visibility, ceiling]
---

# METAR weather phenomena codes

The present-weather group of a METAR encodes what is happening in the air right now -- precipitation, obscurations, and the like -- as a compact string built from a fixed set of parts. The string reads in order: an optional **intensity** sign, an optional **descriptor**, then one or more two-letter **phenomenon** codes.

| Part          | Examples                                                    |
| ------------- | ----------------------------------------------------------- |
| Intensity     | `-` light, (none) moderate, `+` heavy                       |
| Descriptor    | `TS` thunderstorm, `SH` shower, `FZ` freezing, `MI` shallow |
| Precipitation | `RA` rain, `SN` snow, `DZ` drizzle, `GR` hail               |
| Obscuration   | `FG` fog, `BR` mist, `HZ` haze, `FU` smoke                  |

The common combinations a pilot meets on a briefing:

- `TSRA` -- thunderstorm with rain. The `TS` descriptor is the operative word: convection is present, with everything that implies.
- `FZRA` -- freezing rain. Supercooled liquid freezing on contact; one of the most dangerous icing scenarios because it builds clear ice fast.
- `SHRA` -- rain showers. The `SH` descriptor marks showery, convective, intermittent precipitation as opposed to steady stratiform rain.
- `FG` -- fog. By convention `FG` implies visibility below 5/8 SM; reported with a low or zero visibility figure.
- `BR` -- mist. Visibility reduced but still 5/8 SM or greater -- the same physics as fog, one notch less severe.

`+` and `-` modify intensity (`+TSRA` is a heavy thunderstorm-with-rain), and a leading `VC` means the phenomenon is in the **vicinity** of the station rather than at it (`VCTS` -- thunderstorm nearby).

References: **AC 00-45H** (Aviation Weather Services, METAR/SPECI present-weather table) for the full code set; **FAA-H-8083-28B** Chapter 24 (Surface Observations) for the modern treatment; **AIM 7-1** for operational use.

Learn more: [wx-reading-metars](/reference/knowledge/wx-reading-metars).

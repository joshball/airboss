---
key: flight-rule-tiers
term: Flight-rule tiers (VFR / MVFR / IFR / LIFR)
related: [ceiling, metar-visibility, metar-cloud-cover]
---

# Flight-rule tiers (VFR / MVFR / IFR / LIFR)

Briefing products and graphical weather displays paint each station with one of **four flight-rule categories**. The category is a shorthand for "how much room does the weather leave you" -- it is computed from the station's reported **ceiling** and **visibility**, taking whichever of the two is more restrictive.

| Tier   | Name                    | Ceiling               | Visibility        |
| ------ | ----------------------- | --------------------- | ----------------- |
| `VFR`  | Visual Flight Rules     | greater than 3,000 ft | greater than 5 SM |
| `MVFR` | Marginal VFR            | 1,000 to 3,000 ft     | 3 to 5 SM         |
| `IFR`  | Instrument Flight Rules | 500 to below 1,000 ft | 1 to below 3 SM   |
| `LIFR` | Low IFR                 | below 500 ft          | below 1 SM        |

The tier is the lower of the two: a station with a 4,000 ft ceiling but 2 SM visibility is `IFR`, because visibility is the limiting factor.

These categories are a **planning convenience**, not a legal authority. They are not the same as the FAR 91.155 VFR weather minimums, which vary by airspace class and altitude -- the tiers are a coarse map-coloring scheme so a pilot can scan a route and see where the weather tightens. The legal go/no-go still comes from the regulation that applies to the airspace being flown. Use the tier coloring to find the trouble, then read the actual ceiling and visibility numbers to make the decision.

`MVFR` is the tier that demands attention on a VFR cross-country: it is legal VFR in most airspace but leaves little margin for a deteriorating trend, a lowering ceiling, or terrain.

References: **AIM 7-1** (National Weather Service Aviation Products) for the category definitions; **AC 00-45H** for the products that paint them; **14 CFR 91.155** for the legal VFR weather minimums these categories approximate but do not replace.

Learn more: [wx-go-nogo-decision](/reference/knowledge/wx-go-nogo-decision).

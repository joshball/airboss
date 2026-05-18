# Cessna 172N Skyhawk -- AircraftSpec citations

The `AircraftSpec` literal at
`libs/spatial-engine/src/flight/aircraft/c172n-skyhawk.ts` is hand-
transcribed from the Cessna 172N Pilot Operating Handbook. This file maps
every field to its POH section so the transcription is auditable.

Source: **Cessna 172N Pilot Operating Handbook (1978 reprint).** The C172N
type was last published in 1979; the POH numbers do not change, so a
hand-transcription is stable. POH ingest from PDF is a follow-on WP.

| `AircraftSpec` field              | POH reference                                                            |
| --------------------------------- | ------------------------------------------------------------------------ |
| `model`                           | POH cover / Section 1 (General)                                          |
| `perfPolar.climb`                 | Section 4 (Normal Procedures) -- best-rate-of-climb speed + rate         |
| `perfPolar.cruise.points`         | Section 5 (Performance) -- cruise-performance table, 75% power, ISA day  |
| `perfPolar.descent`               | Section 4 (Normal Procedures) -- normal descent profile                  |
| `perfPolar.serviceCeilingFtMsl`   | Section 1 (General) -- certificated service ceiling                      |
| `fuelBurnCurve.cruise.defaultGph` | Section 5 (Performance) -- 75% cruise fuel flow                          |
| `fuelBurnCurve.climb.gph`         | Section 5 (Performance) -- time/fuel/distance-to-climb table             |
| `fuelBurnCurve.taxi.gph`          | Section 5 (Performance) -- taxi + runup fuel allowance                   |
| `fuelCapacityGal`                 | Section 1 (General) -- usable fuel, standard tanks                       |
| `wbEnvelope.maxGrossWeightLb`     | Section 1 (General) -- maximum certificated gross weight                 |
| `wbEnvelope.minWeightLb`          | Section 6 (Weight & Balance) -- envelope lower bound                     |
| `wbEnvelope.envelope`             | Section 6 (Weight & Balance) -- center-of-gravity moment envelope        |
| `equipment`                       | Typical 1978-era VFR equipment list; the C172N as delivered was VFR-only |

## Notes

- The cruise polar uses 75% power on a standard day. TAS rises with
  altitude (the same power moves more efficiently through thinner air) and
  fuel flow falls slightly -- both monotonic, as the Zod schema enforces.
- v1 ships the standard 40-gallon usable-fuel configuration. The optional
  long-range tanks (50 gallons usable) are a follow-on.
- The CG envelope forward fence tightens with weight (33.0 in at 1500 lb to
  38.5 in at 2300 lb); the aft fence holds at 47.3 in. Forward is less than
  aft at every vertex, as the schema requires.

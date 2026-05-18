# KMEM -- airport record citations

The `airport.json` in this directory carries the airport metadata the XC
viewer's layer-1 geography loader reads. Field set mirrors the FAA NASR
(National Airspace System Resource) shape so a v2 full-ingest substitution
is mechanical.

| Field                       | Source                                             |
| --------------------------- | -------------------------------------------------- |
| `icao`, `name`              | FAA NASR airport record / FAA Chart Supplement     |
| `lon`, `lat`                | FAA NASR airport reference point (ARP)             |
| `elevationFtMsl`            | FAA NASR field elevation                           |
| `attended`, `airspaceClass` | FAA Chart Supplement / Memphis Sectional dCS cycle |
| `runways[*]`                | FAA NASR runway records                            |
| `frequencies[*]`            | FAA Chart Supplement communications panel          |
| `fbos[*]`                   | FAA Chart Supplement / airport directory           |

Source cycle: FAA dCS Memphis Sectional, cycle 2026-05 (see
`../../manifest.yaml`). v1 hand-transcribes these records; a cycle bump
triggers a re-ingest.

---
name: NOTAMs course tasks
status: open
parent: README.md
---

# NOTAMs course tasks

Open work for the NOTAMs course. Course is **queued behind [course/weather/](../weather/README.md)**; nothing here is active build work. Listed so the work is visible when the course pulls.

## Blockers (must resolve before lesson authoring)

### Acronym verification (verified 2026-05-04)

Verified against FAA newsroom announcements, NBAA, the Federal NOTAM System reference docs at `notams.aim.faa.gov`, FAA Order JO 7930.2S (Notices to Air Missions), and the eNOTAM II user guide. Each entry below is now load-bearing for the transition-story lesson plan.

- **USNS** -- **United States NOTAM System.** Legacy text-based NOTAM origination + distribution system, originally built circa 1985. Operated in parallel with FNS for years. **Officially retired and replaced by NMS in February 2026**, with full transition complete by late spring 2026 (12,000+ users migrated worldwide).
- **FNS** -- **Federal NOTAM System.** Second legacy NOTAM system; ran in parallel with USNS. Hosted PilotWeb (the public NOTAM search front-end at `notams.aim.faa.gov/notamSearch/`) and the FNS-NDS NOTAM Distribution Service that pushes NOTAMs via SWIM JMS using the AIXM 5.1 schema (developed by the international Digital NOTAM Focus Group jointly led by EUROCONTROL and the FAA). **FNS user transition started November 2025; all users on NMS by 1 April 2026.** FNS retires after that.
- **NMS** -- **NOTAM Management Service** (NOT "NOTAM Manager System" -- the original draft was wrong). Cloud-based replacement for both USNS and FNS. Began operations 29 September 2025 with early-adopter testing; rolled to general availability in 2026. Designed for high availability, near-real-time data exchange, and resilience. Single authoritative source for all NOTAMs once the FNS retirement completes.
- **AIDAP** -- **Aeronautical Information Data Access Portal** (NOT "distribution protocol" -- the original draft was wrong). XML data feed for NOTAM and weather information, accessed via `7-AWA-NAIMES@faa.gov`. Replaces the legacy FAA604 weather data circuit and the USNS for automated downstream consumers. Still active; supports AIXM 5.1, AIDAP-native XML, GeoJSON, and unmodified output formats.
- **XMLQ** -- **Not a real FAA acronym.** No mention in FAA Order JO 7930.2, FNS docs, NMS docs, AIDAP docs, or AIXM specs. The session-noted "legacy distribution format" was likely a confused recollection of the AIXM 5.1 XML schema or AIDAP's XML feed. **Drop from the lesson plan.**
- **BHIV** -- **Not a real FAA acronym.** No mention in any FAA NOTAM documentation, training materials, or system reference docs. The session note about "behave" in controller slang appears to be apocryphal -- no public source corroborates either the acronym or the slang. The actual NOTAM entry system pilots/airport ops use is **eNOTAM II (ENII)**, an FAA-hosted web tool at `notams.aim.faa.gov/en2/` for airport-side origination, with NOTAM Manager (a digital direct-entry system) as the primary path and telephone as the fallback. **Replace BHIV with ENII in the lesson plan; document BHIV as folklore that didn't survive verification.**
- **FICON** -- **Field Condition NOTAM**, governed by **FAA Notice N JO 7930.107** (Field Condition Reporting) and FAA Order JO 7930.2S Chg 2 (December 2021). Reports surface conditions on runways, taxiways, and aprons. Generates a per-third **Runway Condition Code (RwyCC)** for paved surfaces only (asphalt, asphalt-concrete, concrete, porous friction course); no RwyCC for non-paved surfaces or when mud is the contaminant. RwyCC is suppressed when contaminant coverage is ≤25% of the surface. Airport operators can downgrade or upgrade the RwyCC under specific protocols.

Conflict / timeline notes for the lesson:

- The "USNS retired" story has a hard date pair to teach: USNS retirement Feb 2026, FNS retirement spring 2026, NMS first ops Sep 2025. The transition is the lesson; learners need to understand they may have read CFI material referencing USNS as recently as 2024-2025.
- Two of the seven session-noted acronyms (XMLQ, BHIV) failed verification. The lesson plan should not teach them; the verification process itself is a small case study in why "I heard this somewhere" doesn't survive contact with FAA Order text.

Primary sources used for verification:

- [FAA newsroom -- USNS replacement deployment (2025-09)](https://www.faa.gov/newsroom/us-transportation-secretary-sean-p-duffy-deploys-brand-new-notice-airmen-system-provide)
- [NBAA -- April 18 changeover details](https://nbaa.org/aircraft-operations/airspace/faa-plans-april-18-changeover-to-new-notam-system/)
- [FAA NMS portal](https://nms.aim.faa.gov/)
- [FAA Federal NOTAM System (FNS) System Interface document v2.0](https://notams.aim.faa.gov/FNS-SI-v2.0.pdf)
- [FAA Order JO 7930.2S (Notices to Air Missions)](https://www.faa.gov/documentLibrary/media/Order/7930.2S_Chg_2_dtd_12-2-21.pdf)
- [FAA Notice N JO 7930.107 -- Field Condition (FICON) Reporting](https://www.faa.gov/documentLibrary/media/Notice/N_JO_7930.107_Field_Condition_(FICON)_Reporting.pdf)
- [eNOTAM II user guide](https://notams.aim.faa.gov/en2subuserguide.pdf)
- [FAA NOTAM Modernization briefing (ACF 25-02)](https://www.faa.gov/air_traffic/flight_info/aeronav/acf/media/Briefings/NOTAM_Modernization.pdf)

## Queued behind weather course

These cannot start until [course/weather/](../weather/README.md) and the [Weather Scenario Engine](../../docs/vision/products/pre-flight/weather-scenario-engine/) ship enough infrastructure to fork:

- Week-by-week lesson authoring (see [SYLLABUS.md](SYLLABUS.md))
- `libs/notam-engine/` -- synthetic NOTAM generator modeled on `libs/wx-engine/`
- `libs/notam-canonical/` -- curated real NOTAMs as fixtures and validation harness
- Drill engine integration (mechanics reused from weather)
- Capstone authoring

## Notes from the original session

The triage scenario the user explicitly called out: "Here are 5-10 NOTAMs for this airport, which are the most critical?" -- with the constraint that the drill engine only assembles packs from format types the learner has already mastered at decode + understand. The translate-with-time-penalty mechanic is enabled. Self-assessment after each rep ("Did you decode each? Understand each? Struggle with any?") is part of the drill structure.

This is not a separate mechanic for NOTAMs -- it is the standard [Three-Stage Skill Ladder](../../docs/platform/DESIGN_PRINCIPLES.md) Stage 3 drill applied to NOTAMs. Reuse, don't reinvent.

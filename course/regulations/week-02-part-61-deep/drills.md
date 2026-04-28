---
title: Week 2 drills -- Part 61 deep dive
week: 2
---

# Week 2 drills

Week 2 lessons walked the shape of Part 61 (subparts A-G), the parallel aero-experience requirements (61.109 / 61.129 / 61.159), and the distinction between currency, recency, and proficiency. The drills exercise three skills:

1. **Locate** -- given a Part 61 question, name the section in seconds
2. **Diagnose** -- given a pilot's status, identify what's lacking and where it lives
3. **Distinguish** -- separate currency from recency from proficiency without slipping

These drills feed `apps/study/` flash cards. Format 1 -> navigation cards. Format 2 -> scenario cards. Format 3 -> misconception-correction cards. Format 4 -> integration cards.

## Format 1 -- Locate (find the section in 60 seconds)

Cover the right column. Time yourself: 60 seconds per row.

| Prompt                                                                  | Answer                |
| ----------------------------------------------------------------------- | --------------------- |
| Where do the Part 61 definitions live (cross-country, etc.)?            | [@cite](airboss-ref:regs/cfr-14/61/1?at=2026)   |
| Where do the high-performance / complex / tailwheel endorsements live?  | [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) |
| Where does pilot logbook content live?                                  | [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) |
| Where does the flight review live?                                      | [@cite](airboss-ref:regs/cfr-14/61/56?at=2026) |
| Where do the passenger-carrying recency rules (3 takeoffs/landings) live? | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| Where does the PIC proficiency check (large/turbojet) live?             | [@cite](airboss-ref:regs/cfr-14/61/58?at=2026) |
| Where do the student pilot solo limits live?                            | [@cite](airboss-ref:regs/cfr-14/61/87?at=2026) |
| Where do the private pilot eligibility and aero-experience rules live?  | [@cite](airboss-ref:regs/cfr-14/61/103?at=2026), [@cite](airboss-ref:regs/cfr-14/61/109?at=2026) |
| Where do private pilot privileges and limitations live?                 | [@cite](airboss-ref:regs/cfr-14/61/113?at=2026), [@cite](airboss-ref:regs/cfr-14/61/117?at=2026) |
| Where do commercial pilot eligibility and aero-experience rules live?   | [@cite](airboss-ref:regs/cfr-14/61/123?at=2026), [@cite](airboss-ref:regs/cfr-14/61/129?at=2026) |
| Where do commercial pilot privileges and limitations live?              | [@cite](airboss-ref:regs/cfr-14/61/133?at=2026) |
| Where do ATP eligibility and aero-experience rules live?                | [@cite](airboss-ref:regs/cfr-14/61/151?at=2026), [@cite](airboss-ref:regs/cfr-14/61/159?at=2026) |
| Where does the R-ATP carve-out live?                                    | [@cite](airboss-ref:regs/cfr-14/61/160?at=2026) |
| Where do CFI privileges and limitations live (subpart H)?               | [@cite](airboss-ref:regs/cfr-14/61/193?at=2026), [@cite](airboss-ref:regs/cfr-14/61/195?at=2026) |
| Which subpart owns "general rules for pilots"?                          | Subpart A             |
| Which subpart owns student pilots?                                      | Subpart C             |
| Which subpart owns recreational pilots?                                 | Subpart D             |
| Which subpart owns private pilots?                                      | Subpart E             |
| Which subpart owns commercial pilots?                                   | Subpart F             |
| Which subpart owns ATPs?                                                | Subpart G             |
| Which subpart owns CFIs?                                                | Subpart H             |
| Where does cross-country definition for the *instrument* rating differ? | [@cite](airboss-ref:regs/cfr-14/61/1?at=2026) -- 50 nm with a landing at a non-departure airport |
| Where does logging "instrument flight time" live?                       | [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) |
| Where does sole-manipulator PIC logging live?                           | [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) |

## Format 2 -- Diagnose (given a pilot, find the gap)

For each pilot, identify the most likely shortcoming and the section that owns it.

| Pilot status                                                                      | Likely gap                              | Lives in                  |
| --------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| 280 hr private pilot, all in a 172, wants to take commercial checkride next month | Complex/TAA time, instrument training   | [@cite](airboss-ref:regs/cfr-14/61/129?at=2026) |
| Private pilot took a flight review 25 months ago                                  | Flight review (24-month limit)          | [@cite](airboss-ref:regs/cfr-14/61/56?at=2026) |
| Wants to carry passengers tomorrow night, last night landing 95 days ago          | Night passenger-carrying recency        | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| IFR student current on approaches but it's been 7 months                          | IFR currency window expired             | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| 9-month-lapsed IFR pilot wants to fly IFR today                                   | 6-month grace expired -> needs IPC      | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| Wants to fly a 12,500+ lb piston airplane, never has before                       | High-altitude / turbojet PIC check      | [@cite](airboss-ref:regs/cfr-14/61/58?at=2026) |
| Student pilot wants to do a solo cross-country across the state                   | Solo cross-country authorization        | [@cite](airboss-ref:regs/cfr-14/61/93?at=2026), [@cite](airboss-ref:regs/cfr-14/61/87?at=2026) |
| Private pilot wants to fly a 200 hp Bonanza                                       | High-performance endorsement            | [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) |
| Private pilot wants to fly a Cessna 195 (tailwheel)                               | Tailwheel endorsement                   | [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) |
| Private pilot wants to fly a pressurized airplane above FL250                     | High-altitude endorsement               | [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) |
| 1500 hr ATP-eligible pilot from a 141 collegiate program, age 23                  | R-ATP eligible at 1000 / 1250 hr        | [@cite](airboss-ref:regs/cfr-14/61/160?at=2026) |
| Private pilot wants to share fuel costs with a passenger flying somewhere useful  | Cost-sharing limits (pro rata, common purpose) | [@cite](airboss-ref:regs/cfr-14/61/113?at=2026) |
| CFI wants to be paid for a discovery flight that isn't training                   | Compensation as a CFI vs as a pilot     | [@cite](airboss-ref:regs/cfr-14/61/195?at=2026), [@cite](airboss-ref:regs/cfr-14/61/113?at=2026) |
| Commercial pilot, no instrument rating, wants to carry pax for hire 60 nm at night | Limited to day VFR within 50 nm         | [@cite](airboss-ref:regs/cfr-14/61/133?at=2026) |

## Format 3 -- Distinguish (currency vs recency vs proficiency)

For each statement, classify it as **currency**, **recency**, or **proficiency**, and name the regulation (or note it's not regulatory).

| Statement                                                          | Class        | Section / source             |
| ------------------------------------------------------------------ | ------------ | ---------------------------- |
| Flight review every 24 calendar months                             | Currency     | [@cite](airboss-ref:regs/cfr-14/61/56?at=2026) |
| 3 takeoffs and landings in the preceding 90 days to carry pax      | Recency      | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| Night passenger recency adds the full-stop and the to-a-night-landing requirement | Recency      | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| 6-6-HIT in the preceding 6 calendar months                         | Recency (IFR) | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| IPC (instrument proficiency check) after the 6-month grace expires | Currency restoration | [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) |
| Knows a 25 kt direct crosswind in the trained airplane is within personal mins | Proficiency  | (not regulatory)             |
| Has not flown the airplane type in 6 months and is hesitant to launch IFR | Proficiency  | (not regulatory)             |
| PIC proficiency check (large airplane, turbojet) every 12 calendar months | Currency     | [@cite](airboss-ref:regs/cfr-14/61/58?at=2026) |
| Student pilot solo cross-country endorsement (current within 90 days) | Currency (instructor-mediated) | [@cite](airboss-ref:regs/cfr-14/61/93?at=2026) |
| Held a 24-month flight review *and* did 5 takeoffs/landings yesterday | Currency + recency, but says nothing about whether the pilot can actually fly the mission | (no single regulation captures proficiency) |

## Format 4 -- Trap detector

For each statement, identify the misreading and correct it.

| Statement                                                            | Trap and correction |
| -------------------------------------------------------------------- | ------------------- |
| "Commercial requires 250 hours total time."                          | The 250 is the floor under [@cite](airboss-ref:regs/cfr-14/61/129?at=2026), but the sub-requirements (instrument, complex/TAA, night XC, day XC, solo) almost always bind first. |
| "Logging requires you to be the only pilot on the controls."         | Wrong. [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) lets you log PIC as sole manipulator of the controls of an aircraft you're rated for, even when another rated pilot is aboard (Hicks, 2010). |
| "If I have a 24-month flight review I can carry passengers."         | Half-true. Flight review (currency) doesn't grant passenger-carrying recency. Need [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) takeoffs/landings too. |
| "An IPC restores my IFR currency for 6 months."                      | Wrong direction. The 6-month *grace* is between currency expiring and an IPC being required. After an IPC, the next 6/6/HIT clock starts fresh. |
| "Cross-country always means more than 50 nm."                        | Wrong. [@cite](airboss-ref:regs/cfr-14/61/1?at=2026) defines several cross-country flavors. The 50 nm with a landing at another airport is the most common, but the *instrument* rating uses 50 nm with a landing at a non-departure airport, and there are other definitions for the recreational pilot. |
| "I have to log all my flight time."                                  | Wrong. [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) requires logging only what's needed to show eligibility / currency / recency for the flying you do. Everything else is your call. |
| "A complex airplane requires retractable, controllable-prop, *and* flaps for the endorsement." | Subtly wrong post-2018: [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) was amended to drop the flap requirement for some applications and allow TAA equivalence for the commercial 10-hour. Read the current text. |
| "Night recency means 3 in the preceding 90 days."                    | The 3 is right but they must be **full-stop landings** **at night** ([@cite](airboss-ref:regs/cfr-14/61/57?at=2026)) -- different from the daytime rule. |
| "Currency = recency."                                                | Currency = the regulatory window for a privilege. Recency = the rolling-window rules under [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) specifically. Proficiency = whether you can actually fly the mission. They're three different things. |
| "I need 1,500 hours for the ATP, period."                            | The R-ATP carve-out under [@cite](airboss-ref:regs/cfr-14/61/160?at=2026) reduces this to 1,000 (military) or 1,250 (4-year aviation degree from a 141 program) or 1,500 (otherwise). |

## Hardcover drill -- 60 seconds, no notes

Integration. Read the prompt, give the answer in 60 seconds without referring to anything.

1. **Name the Part 61 subparts in order with one sentence per subpart.** -> A general; B aircraft ratings; C student pilots; D recreational; E private; F commercial; G ATP; H CFIs; I light-sport; J light-sport CFIs; K sport pilots.
2. **A 200 hr private pilot, 0 instrument time, wants to start commercial training. What do they actually need to fix before the checkride?** -> The 250 total isn't the bind. They need 100 PIC of which 50 is XC, 10 hr instrument training, 10 hr complex/TAA/turbine, day-VFR XC at least 100 nm with 3 landings, night-VFR XC at least 100 nm with 3 landings, 5 hr night, 3 hr instrument within 60 days of the practical, and 10 hr solo / performing the duties of PIC. Diagnose against [@cite](airboss-ref:regs/cfr-14/61/129?at=2026), not against the total.
3. **Distinguish [@cite](airboss-ref:regs/cfr-14/61/56?at=2026), [@cite](airboss-ref:regs/cfr-14/61/57?at=2026), and [@cite](airboss-ref:regs/cfr-14/61/58?at=2026).** -> 61.56 is the 24-month flight review (everyone). 61.57 is recency for passenger-carrying (a, b) and IFR (c, d). 61.58 is the annual PIC proficiency check for large or turbojet airplanes (very specific population).
4. **An IFR-rated pilot lapses by 9 months on instrument approaches. Walk me through what they need to do to fly IFR again.** -> The 6-month currency window is gone (61.57(c)). The 6-month grace is also gone (because lapsed by 9). They need an IPC under [@cite](airboss-ref:regs/cfr-14/61/57?at=2026), administered by an authorized instructor or examiner. Then the 6/6/HIT recency clock starts fresh.
5. **A pilot has 24-month-current flight review and 5 takeoffs/landings yesterday. Are they safe to take three friends to a 3000-foot-runway airport tonight?** -> Currency yes (61.56). Recency: depends -- they need 3 *full-stop* night landings in the prior 90 days under [@cite](airboss-ref:regs/cfr-14/61/57?at=2026) for night passenger ops, the daytime ones don't satisfy it. Proficiency: that's a personal-minimums question, not a regulatory one -- the 3000-foot runway, the night, the passenger load, and the pilot's actual mission experience all factor in. The regulatory test passing doesn't tell you whether they should go.

## Where this drill set fits

These drills are the connective tissue from the Week 2 lessons to `apps/study/`. Format 1 (Locate) -> navigation cards. Format 2 (Diagnose) -> scenario cards exercising the gap-finding skill that working CFIs need. Format 3 (Distinguish) -> the currency/recency/proficiency cards (high-yield -- this comes up in every checkride). Format 4 (Trap detector) -> misconception correction.

## Related

- [01-subpart-walk.md](01-subpart-walk.md)
- [02-aeronautical-experience.md](02-aeronautical-experience.md)
- [03-currency-vs-recency-vs-proficiency.md](03-currency-vs-recency-vs-proficiency.md)
- [oral.md](oral.md) -- the Week 2 oral, integrating all three lessons
- [../drills/README.md](../drills/README.md) -- the drill bank framework
- Live source: [Part 61](airboss-ref:regs/cfr-14/61?at=2026)

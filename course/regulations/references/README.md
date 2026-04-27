# References

Authoritative sources cited by the course. These are *external* references -- the regulations themselves, AIM, ACs, Chief Counsel letters, NTSB cases. They're the source of truth that the course points at. Lessons cite them; the course does not replace them.

## Primary

- **14 CFR (Title 14, Code of Federal Regulations)** -- the regulations themselves. Always reference current eCFR (https://www.ecfr.gov) for the live text. Do not embed CFR text snapshots that go stale.
- **AIM (Aeronautical Information Manual)** -- non-regulatory but expected knowledge; enforceable via 91.13. Revised ~6 months. Always reference current.
- **ACs (Advisory Circulars)** -- guidance documents. Numbered AC NN-NN where the first NN maps to the CFR Part addressed.

## ACs frequently cited in this course

| AC | Title | Used in |
| --- | --- | --- |
| AC 00-6 | Aviation Weather | Lessons referencing weather decisions |
| AC 60-22 | Aeronautical Decision Making | ADM-adjacent lessons |
| AC 61-65 | Certification: Pilots and Flight and Ground Instructors -- endorsements | Week 3 (CFI) |
| AC 61-83 | Nationally Scheduled, FAA-Approved Industry-Conducted Flight Instructor Refresher Course | Reference for FIRC mechanics |
| AC 61-98 | Currency Requirements and Guidance for the Flight Review and IPC | Week 2 (currency) |
| AC 90-66 | Non-Towered Airport Flight Operations | Week 4 (flight rules) |
| AC 91-79 | Mitigating the Risks of a Runway Overrun Upon Landing | Week 4-5 |
| AC 91-92 | Pilot's Guide to a Preflight Briefing | Week 4 (91.103 preflight) |
| AC 120-71 | Standard Operating Procedures and Pilot Monitoring Duties for Flight Deck Crewmembers | Week 7 (135/121 awareness) |

## Chief Counsel interpretations

Chief Counsel letters bind FAA enforcement and clarify regulatory meaning. Lessons cite them when the regulation alone is ambiguous.

| Letter | Year | Subject | Used in |
| --- | --- | --- | --- |
| Mangiamele | 2009 | 61.113 cost-sharing -- common purpose, pro-rata limits | Week 2 / Week 7 |
| Hicks | 2010 | "Acting as PIC" includes anyone manipulating the controls | Week 2 / Week 3 |
| Walker | 2017 | 91.103 "all available information" standard | Week 4 |
| Murphy | 2014 | 61.51 logging -- when a CFI logs PIC vs. instruction given | Week 2 / Week 3 |

## NTSB and case law

| Source | Subject | Used in |
| --- | --- | --- |
| 49 CFR 830 (NTSB Part 830) | Notification and reporting of aircraft accidents and incidents | Week 9 |
| Administrator v. Merrell | "Careless or reckless" precedent | Week 9 |
| Administrator v. Lobeiko | 91.13 standard | Week 9 |

## Other regulatory ecosystems

These are NOT 14 CFR but appear in this course:

- **49 CFR 1552** -- TSA flight training rule (foreign students, AFSP)
- **49 CFR 830** -- NTSB accident/incident reporting (lives at NTSB.gov)
- **49 USC 44703** -- BasicMed statutory authority (not in CFR; the CFR rule is 61.113(i))
- **FAA Order 2150.3** -- FAA enforcement handbook (compliance program, certificate action)
- **FAA Order 8900.1** -- Flight Standards Information Management System (operations of FSDOs, inspector guidance)

## Drift management

Regulations change. References get superseded. To keep this course honest:

- Every lesson and oral has `last_verified: YYYY-MM-DD` in its frontmatter
- Quarterly review: walk every lesson, re-verify each cited regulation against the live eCFR
- When a citation changes (renumbered, paragraph rearranged), update the lesson and the date
- When an AC or Chief Counsel letter is superseded, update the cited reference

## What's NOT here

- The CFR text itself, snapshotted into the repo. The live eCFR is the source of truth. Snapshots go stale and create false confidence.
- The full AIM. Same reason.
- AC PDFs. Link to the AC at faa.gov; don't snapshot.

If you find yourself wanting to cache a regulation locally for offline study, that's a `apps/study/` content concern, not a course-content concern.

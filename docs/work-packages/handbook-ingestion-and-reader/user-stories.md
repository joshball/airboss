---
title: 'User Stories: Handbook Ingestion and Reader'
product: study
feature: handbook-ingestion-and-reader
type: user-stories
status: unread
review_status: pending
---

# User Stories: Handbook Ingestion and Reader

## Reading the FAA's words inside airboss

- As a returning CFI rebuilding seven certs, I want to read the PHAK in-app so that I can pull up the FAA's exact wording without leaving the study tool I'm using.
- As a learner who hits a regulation in a card, I want to click the citation and land on the handbook section that explains it so the regulation stops being arbitrary and becomes a sentence I can read.
- As a pilot reviewing weather operationally, I want the Aviation Weather Handbook (AvWX) inside the same reader as the PHAK so my study sessions don't fragment across PDFs and tabs.
- As a CFI prepping a lesson, I want the Airplane Flying Handbook (AFH) section on stalls open beside the knowledge node on angle of attack so I can teach from both at once.

## Citation as navigation

- As a learner reading a knowledge node that cites "PHAK Ch 12 §3", I want that citation to be a real link so I can read the source FAA wording instead of guessing what it says.
- As a learner reading a handbook section, I want to see which knowledge nodes cite this section so I can ask "what is the system trying to teach me about this passage?"
- As a learner inside a handbook section, I want to see my mastery on each citing node so I can spot "this is why I keep missing this card."
- As a CFI reading a chapter, I want to see every node and lesson that draws from it so I know the chapter's place in the broader curriculum.

## Tracking what I have read

- As a learner, I want to mark sections as Read explicitly so the system never auto-flips state on me.
- As a learner who is partway through a section, I want a "Reading" middle state so the dashboard distinguishes "started" from "untouched" from "done."
- As a learner who finished a section but didn't fully understand it, I want a "Read but didn't get it" toggle so I can mark the section as covered without faking comprehension.
- As a learner, I want a non-blocking "Mark this section as read?" prompt at the bottom of a section after I've spent enough time on it so I'm reminded to record progress without being interrupted.
- As a learner, I want re-reading to be a first-class action that resets state without throwing away my notes so I can return to a section without losing the thinking I did the first time.
- As a learner, I want my notes on each section to be private and persistent so I can write the way I would in a paper margin.
- As a learner, I want the system to never auto-mark a section read, so I trust the dashboard reflects what I actually read and not what the heuristic guessed.

## Edition awareness

- As a learner studying for a checkride, I want to see which edition of each handbook I'm reading so I'm prepared for the version the examiner is testing on.
- As a learner who has been reading PHAK 8083-25C and the FAA publishes 25D, I want a "newer edition available" banner on the old edition so I can decide whether to migrate now or finish my current chapter.
- As a learner, I want to pin a citation to a specific edition via `?edition=` so a node citing "PHAK 8083-25B Ch 12 §3" still resolves cleanly even though 25C is current.
- As a future content author, I want each handbook edition stored separately so my old citations never silently change wording underneath them.

## Reading inside the section

- As a learner reading on a laptop, I want a sticky table of contents on the right so I can jump between subsections without losing my place.
- As a learner reading on a phone, I want figures inline at their captions so I see "Figure 12-7" exactly where the prose references it.
- As a learner reading a table-heavy chapter, I want tables rendered as real HTML so I can scan rows on a small screen without zooming.
- As a learner using a screen reader, I want section headings to be real `h2`/`h3` elements so the document outline matches what the FAA wrote.
- As a learner who follows a cross-reference inside a section ("see Chapter 7"), I want it to link to the relevant chapter so reading stays a click, not a search.

## Browsing handbooks as a peer surface

- As a learner who thinks in terms of FAA handbooks rather than nodes, I want to walk PHAK chapter-by-chapter as a primary surface so the handbooks feel first-class, not buried under "References."
- As a learner browsing, I want to see "% of sections read" per handbook and per chapter so I have a coarse map of where my reading is.
- As a learner discovering airboss for the first time, I want a "Handbooks" entry in the main nav so the reader is something I can find without being told it exists.

## For the content author

- As Joshua-the-content-author, I want to ingest a new FAA handbook with a single command so spinning up the next edition is a Saturday afternoon, not a project.
- As a content author, I want the ingestion pipeline to fail loudly on PDF outline problems so I never silently ship a mangled chapter.
- As a content author, I want the per-section markdown committed to the repo so a reviewer can `git diff` an FAA edition update and see exactly what changed.
- As a content author, I want re-running the seed against unchanged content to be a no-op so I can wire it into `bun run db seed` without worrying about churn.
- As a content author, I want figure caption-to-image binding to be deterministic so a re-run produces the same figure assets across machines.
- As a content author, I want a per-handbook YAML config to override outline quirks so I can ship a handbook without modifying the pipeline code.
- As a content author writing knowledge nodes, I want a structured `{ kind: 'handbook', reference_id, locator }` shape so my citations resolve to live URLs without me hand-coding them.

## For the future learner of other surfaces

- As a future cert-dashboard user, I want handbook sections to be the things citations point at so the dashboard's "what does this leaf reference?" surfaces real reading material instead of opaque labels.
- As a future "browse by handbook" user, I want the handbook lens to surface sections I haven't read so my coverage gap is visible per-handbook, not just per-cert.
- As a future audio-narration user, I want each section to be a self-contained reading unit so a "listen to this section" feature is a thin layer on top of what already exists.
- As a future syllabus author, I want to attach handbook citations to each ACS task element so a leaf can resolve to "the FAA's authoritative wording on this element."

## What we are not building (so users don't ask)

- As a learner, I do **not** want to read a Sporty's prep book inside airboss -- those are copyrighted and out of scope.
- As a learner, I do **not** expect AIM to land here in v1 -- AIM is published with continuous revisions and needs a different pipeline; it has its own work package.
- As a learner, I do **not** expect to share my notes with another learner -- notes are private in v1 by design.
- As a learner, I do **not** expect a search box that returns hits across every handbook -- existing references / glossary search and the per-handbook table of contents are the v1 navigation. Cross-handbook search is a follow-up if it earns its keep.

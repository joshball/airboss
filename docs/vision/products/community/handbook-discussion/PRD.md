---
name: Handbook Discussion + Q&A
id: prd:com:handbook-discussion
tagline: Ask questions next to the FAA's words; CFIs answer; learners benefit from the aggregated wisdom
status: idea
priority: 4
prd_depth: light
category: community
platform_mode:
  - community
audience:
  - student-pilot
  - private-pilot
  - instrument-pilot
  - cfi
  - career-track
complexity: medium
personal_need: 4
depends_on:
  - handbook-ingestion-and-reader
surfaces:
  - web
content_reuse:
  - handbooks
  - regulations
last_worked: null
---

# Handbook Discussion + Q&A

> **Status: idea, not yet specced.** This PRD is the rough shape. A full spec needs to be authored before build (run `/ball-wp-spec` when ready). Multiple hard product decisions are listed below as open questions.

## What it does

Every section of every FAA handbook (and every regulation, AC, AIM paragraph) becomes a place where learners can ask questions and CFIs can write commentary. The system distinguishes **official** content (the FAA's words; reviewable, accountable) from **discussion** (questions, commentary; not official, but useful).

Three distinct interaction modes per section:

1. **Private notes** -- already shipped in the handbook reader. Just for the learner. Markdown textarea.
2. **Questions** -- a learner posts a question scoped to a specific section, paragraph, or figure. Three privacy modes:
   - **Private to my CFI** -- delivered to one paired instructor. Inbox.
   - **Anonymous public** -- visible to the community; the asker's identity is hidden. Other learners can answer; CFIs can answer authoritatively.
   - **Public as me** -- visible with the asker's name. Builds reputation; threads can be referenced ("see jdoe's question on PHAK 12.9").
3. **CFI commentary** -- a CFI marks a section with a note ("In practice, this is wrong because..." or "Don't memorize the formula; understand the why"). Visible to learners they teach (paired) or to the community (if the CFI opts in to public commentary).

The reader UI gains a new region next to the section body: **Discussion** with tabs for `Questions`, `CFI commentary`, and `My notes`. Questions answered by a verified CFI get a badge ("Answered by CFI Joshua Ball, ATP/CFI/CFII"). Highly-voted public Q&A threads are surfaced on the section page; long tails live behind a "more" affordance.

## Why it matters

The platform's promise is "the FAA's exact words, with citations." That promise is correct but cold. Real learning happens in the gap between *what the FAA wrote* and *what an experienced pilot understands*. Today that gap is filled by Reddit, FlyingMag forums, ground school instructors, and DPE checkride feedback -- distributed, hard to find, often wrong.

Anchoring discussion to the source text closes the loop:

- **Learners** ask questions where they're confused, find prior answers from other learners + verified CFIs, and don't have to context-switch to a forum.
- **CFIs** see what their students are confused about (private mode) and contribute commentary that helps the broader community (public mode). Reputation accrues.
- **The platform** gains a moat that competitor handbook readers can't match: the data is the conversation, not the source text.

## Distinguishing official vs discussion

This is the load-bearing product call. The reader must make it visually unmistakable:

- **Official content** (FAA text, CFR text, AIM text): authoritative styling. The audit story per [ADR 018](../../../decisions/018-source-artifact-storage-policy/decision.md) and [ADR 020](../../../decisions/020-handbook-edition-and-amendment-policy.md) traces every word to a source URL + SHA-256.
- **CFI commentary** (verified, reviewed): clearly attributed. "Joshua Ball, ATP/CFI/CFII says..." with a small badge. Searchable + filterable.
- **Discussion content** (questions, peer answers, anonymous): visually different from both. Lighter weight. Clear "this is community, not official" framing.

A learner reading the section should never confuse "what the FAA said" with "what some pilot on the internet thinks." Both have value; conflation is dangerous.

## Open product questions

These need answers before this becomes a real spec:

1. **CFI verification.** What proves a CFI is who they say they are? FAA airman registry lookup? Peer attestation? Manual review? Verification cost vs trust requirement.
2. **Moderation model.** Who removes bad content? CFIs? Power users? Joshua? Community voting + threshold?
3. **Identity model.** Real names mandatory for CFIs? Optional for learners? How does anonymous mode interact with paired-CFI mode?
4. **Scope of attachment.** Section-level, paragraph-level, or figure-level Q&A? Granularity affects UI and DB shape.
5. **Cross-handbook threads.** A question about thunderstorms could live under PHAK Ch. 12 §12.11 (Fronts), AIM 7-1-29 (Thunderstorms), or AC 00-24C (Thunderstorms). Does the question get attached to one canonical anchor, or can it span multiple?
6. **CFI-student pairing model.** Existing CFI Pairing PRD ([prd:com:cfi-pairing](../cfi-pairing/PRD.md)) is the obvious dependency. Does this PRD subsume part of it, or compose with it?
7. **Discoverability.** "Show me all unanswered questions in PHAK Ch. 12" -- a feed for active CFIs? "Show me all CFI commentary on Aerodynamics" -- a study aid? Surface design TBD.
8. **Handling stale Q&A across editions.** A question on PHAK 25C §12.9 -- when 25D ships, does it carry forward? Drift detection? Per [ADR 020](../../../decisions/020-handbook-edition-and-amendment-policy.md), errata can change the underlying text; what happens to threads anchored to a since-corrected paragraph?
9. **Aggregation / FAQ generation.** "These 17 learners asked variants of the same question; here's the one well-written answer." Manual curation? LLM-assisted? Either way, who's accountable for the canonical answer?
10. **Public vs platform-only.** Does discussion live behind the airboss login, or can it be shared/linked publicly (SEO, Google indexability)? Different content moderation profile each way.

## Composition with existing products

- **CFI Pairing** ([prd:com:cfi-pairing](../cfi-pairing/PRD.md)) provides the learner -> CFI relationship. Private "send to my CFI" mode rides on that.
- **Anonymous Mistakes** ([prd:com:anonymous-mistakes](../anonymous-mistakes/PRD.md)) is adjacent: this is "questions about what the FAA said," that's "what I screwed up doing." Same anonymity primitive, different content.
- **Knowledge graph** (ADR 011): nodes already cite handbook sections. A question on PHAK §12.9 could be auto-linked to nodes citing that section -- "here's what the airboss community has discussed about this concept."

## Why "future work" right now

Three blockers stop this from being a v1 feature:

1. **Handbook ingestion just shipped.** The depends-on (the reader) is in flight as we speak. Discussion is meaningless without a section-level reader to anchor it.
2. **CFI verification, moderation, and abuse prevention** are real product work. Shipping unmoderated discussion attached to FAA documents would be a liability.
3. **The hard questions above** (10 of them) are not yet answered. Half of them require Joshua's direct input as user-zero CFI.

Right product timing: after the handbook reader has been in use for a few weeks, when Joshua has felt the pain points himself ("I wish I could ask my CFI about this paragraph"), the open questions answer themselves through use.

## Trigger to spec

Run `/ball-wp-spec handbook-discussion` when:

- Handbook reader has been live for 4+ weeks.
- Joshua has accumulated 20+ private notes that *want* to be questions or CFI conversations.
- A second CFI is interested in commenting on the platform.
- The 10 open questions above have rough answers (even if some are "decide later").

Until then, this PRD is the placeholder.

## Surfaces

- **Web (study app)**: section-anchored Discussion panel; CFI commentary inline.
- **Web (CFI dashboard)**: triage queue for paired-CFI questions; "what my students are confused about."
- **Web (community feed, optional)**: chronological + voted feed of public questions and CFI commentary.

## Reuse

- `handbooks/` corpus + `handbook_section` rows = the anchor surface.
- `regulations/` corpus = the regulation anchor surface.
- Future AIM corpus + future AC corpus = same pattern.

The plumbing for "anchor a UGC item to a content corpus row" should be one BC, used by every section-aware surface (handbooks today, regs next, AIM later).

## Related

- [Community products README](../README.md)
- [CFI Pairing](../cfi-pairing/PRD.md) -- learner ↔ CFI relationship primitive
- [Anonymous Mistakes](../anonymous-mistakes/PRD.md) -- adjacent anonymity primitive
- [handbook-ingestion-and-reader spec](../../../work-packages/handbook-ingestion-and-reader/spec.md) -- the reader this attaches to
- [ADR 011](../../../decisions/011-knowledge-graph-learning-system/decision.md) -- knowledge graph + the citation surface this overlays
- [ADR 020](../../../decisions/020-handbook-edition-and-amendment-policy.md) -- editions/errata that may invalidate threads

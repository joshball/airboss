---
title: Reference Identifier System -- Context
status: draft
date_started: 2026-04-27
authors: Joshua Ball
related: [018-source-artifact-storage-policy]
---

# Reference Identifier System -- Context

This is the *context* file for ADR 019. The decision sits in [decision.md](decision.md). This file captures the conversation, the surface area, and the design pressures that shaped it.

## Why we need this

Authoring [course/regulations/](../../../course/regulations/) surfaced an architectural question that we under-thought during [ADR 018](../018-source-artifact-storage-policy/decision.md): **how do lessons reference source material?**

Concretely, when a Week 1 lesson cites §91.103, what is the lesson actually citing?

- The string "§91.103"?
- A file path like `regulations/cfr-14/part-91/91.103.md`?
- A URL like `https://www.ecfr.gov/.../91.103`?
- A DB row that doesn't exist yet?
- Some abstract identifier the platform resolves at render time?

The lesson has work to do regardless of how that question is answered. But the answer determines what happens when:

- The CFR section is amended (text changes)
- The CFR section is renumbered (paragraph (b) becomes (c))
- A new edition of the PHAK comes out
- An AC gets revised from `61-65J` to `61-65K`
- We start ingesting source PDFs into derivative markdown
- We build a hangar UI that surfaces source content live
- We add full-text search across the corpus
- A lesson written in 2026 needs to be re-verified in 2027

If we get the addressing model wrong, every future lesson that cites a regulation has to be rewritten when we change the backend. That's an unacceptable amount of churn.

## Conversation that surfaced this

Initial direction (in [course/regulations/DESIGN.md](../../../course/regulations/DESIGN.md)) was: lessons quote regulations sparingly inline, and link to live eCFR URLs. When the ingestion pipeline ships, swap URLs for derivative files.

The user pushed back with several observations the original framing didn't address:

1. **Versioning is real.** Regulations are amended. Calling a reference "stable" because the section number doesn't change is wrong -- the section number is stable, but the text it points at can change. A lesson written about §91.103 in 2026 may be wrong in 2027 if the FAA amends the wording.
2. **Annual cycle is predictable.** FARs and AIM are revised on roughly annual cadences. Pinning references to a year (`@2026`) is reasonable.
3. **Detection of changes requires structured comparison.** When we ingest the 2027 CFR, we need to be able to ask the system "which of our references point at sections that changed?" Naive string search ("look for `91.105`") breaks because paragraph numbering can shift.
4. **Multi-reference syntax must be robust.** "91.103, 91.104, 91.106, 91.107" needs an explicit form. So does "91.103 through 91.107 except 91.105."
5. **Inline link text should be substitutable.** Rather than the author manually writing "the IFR fuel and alternate trio are in 91.167-91.171" (which can drift if section numbers change), we want forms like `@short` or `@formal` that auto-substitute the canonical citation -- with full link text required for everything else, warned otherwise.
6. **References should live with the lesson, not in frontmatter.** Disconnected metadata rots. The body is the source of truth; the parser builds the bibliography.
7. **The committed derivative tier is for engineering loops, not user surfaces.** End users read the platform UI which queries a DB; the committed markdown exists for audit, re-seed, and rebuild-trigger purposes. ADR 018's three tiers should be four: source, derivative, indexed, generated.

## Design pressures

The decision has to satisfy multiple constraints simultaneously:

| Constraint | Implication |
| --- | --- |
| Lessons authored in 2026 should still be useful in 2030 without rewriting every reference | Identifiers must outlive backend changes |
| When a regulation is amended, the system must surface every lesson that needs re-verification | Identifiers must be structured enough that a diff between editions can target them |
| Multi-reference and partial-reference must be expressible | Range, list, and exclusion syntax needed |
| Authors should rarely have to type the canonical title -- get it from the registry | Substitution tokens (`@short`, `@formal`, etc.) in link text |
| Platform must render a stale-version warning when a lesson references an older edition than current | Editions are part of the identifier; resolver knows current vs. referenced |
| Adding a new corpus (e.g. POH, FAA Order, NTSB report) should not require rewriting the system | Identifier scheme must extend cleanly to new domains |
| The scheme must work in plain Markdown | Identifiers go in standard `[text](url)` link syntax; URL is the identifier |
| The scheme must support both "I want the latest" and "I want this specific version" | Edition pinning is optional; current is implied if omitted |
| Static validation must catch references that don't resolve | Build-time pass against the registry |
| Renderer must support multiple substitutions (short, formal, full title, the section text inline) | Substitution token vocabulary |

## The four-tier storage model

ADR 018 currently has three tiers (source, derivative, generated). The user observed -- correctly -- that "generated" lumps together two different things:

- *Indexed* derivatives -- DB rows that mirror the committed markdown. Owned by the corpus. Lifecycle: rebuilt when derivatives change.
- *Generated* artifacts -- platform-level computations. Lifecycle: continuously rebuilt as users interact.

These have different lifecycles, different ownership, and different invalidation rules. They should be modeled separately. The reference identifier system targets the *indexed* tier explicitly -- when a lesson cites `regs.cfr-14.91.103`, the renderer queries the indexed DB to get the section's title, current text, and "last amended" timestamp.

Proposal: extend [STORAGE.md](../../platform/STORAGE.md) to four tiers as part of this ADR.

## Out of scope (for ADR 019)

- The *implementation* of the registry. ADR 019 specifies the schema and the rules; a follow-on work package builds it.
- The CFR ingestion pipeline. Separate work package.
- The handbook ingestion pipeline (PHAK, AFH). Separate work package.
- The DB schema for the indexed tier. Specified by the ingestion WPs.
- The hangar authoring UI for non-engineer-edited references.
- Migration of the lessons authored before this ADR (Week 1 + 4 capstones use eCFR URLs in plain text). Done in a follow-on PR after the registry exists.

## Reviewer ask

When this draft goes to review, the reviewer should look specifically for:

- **Where will future-us hate past-us?** Cases where the identifier scheme can't represent something we'll inevitably want to express.
- **What corpus types will not fit?** Are there source materials (POHs, NTSB reports, manufacturer service bulletins, foreign regs, ICAO docs) where the dotted-slug scheme breaks?
- **What mutation cases break the scheme?** Renumbering, substantial-but-text-equivalent rewrites, sections being split, sections being merged, sections being moved between Parts.
- **What rendering modes break the scheme?** Print export, audio TTS, screen readers, search snippets, voice-only interfaces.
- **What versioning cases break the scheme?** A lesson references current; a year passes; we re-verify; some references are still current and some aren't. Does the system mechanically distinguish?
- **What multi-corpus cross-references break the scheme?** A lesson references both `regs.cfr-14.91.103` and `aim.5-1-7` and `interp.chief-counsel.walker-2017` and they together establish a single point. Does the system support that gracefully?
- **What internationalization breaks the scheme?** If we ever ingest ICAO Annexes, foreign reg sets, translations -- does the scheme adapt or do we have to rewrite?
- **What automation breaks the scheme?** When a script wants to do "give me every lesson that references §91.103," does the scheme support that without false negatives?

# Library cards + flat CFR rendering -- 2026-05-05

Triggering ask: `/library/regulations/14-cfr/91` linked externally instead of rendering local CFR sections. Cards across `/library/regulations/*` are too sparse -- need official titles, descriptions, "why pilots care" copy.

Skipping work-package overhead. Tracking inline.

## Wave 0 -- shared spine (sequential, me)

- [ ] Branch `library-cards-spine` off main
- [ ] Patch `libs/bc/study/src/regulations.ts` `buildSectionListView` -- fall back to flat depth-0 sections when no chapters
- [ ] Verify Part 91, Part 61, Part 1 render sections locally
- [ ] Verify section detail (`/library/regulations/14-cfr/91/103`) still works
- [ ] Extend view DTOs: optional `description`, `officialTitle`, `whyItMatters`, `scope` on bucket/group/umbrella
- [ ] Extend `LibraryCard.svelte` + small group cards to render new fields when present
- [ ] Document `reference.metadata.{description,officialTitle,whyItMatters,scope}` convention
- [ ] `bun run check` clean
- [ ] Push branch, open PR, merge
- [ ] Pull main

## Wave 1 -- parallel fan-out (6 agents in worktrees, after Wave 0 merged)

Each agent: extract official titles from source during ingest, author `whyItMatters` blurbs, re-seed `reference.metadata`. Stop after first ~5 entries for prose review.

- [ ] Agent 1: cfr-14 (226 parts) -- pause after Parts 1, 61, 91, 135, 141
- [ ] Agent 2: cfr-49 + ntsb + statutes
- [ ] Agent 3: phak + afh + avwx
- [ ] Agent 4: ifh + iph + risk-management + aviation-instructor + tips-mountain-flying
- [ ] Agent 5: aim + ac (all 9)
- [ ] Agent 6: landing copy + kind-page headers (14 CFR / 49 CFR / AIM / AC / NTSB / Handbooks)

## Wave 2 -- subpart hierarchy (1 agent, after Wave 1)

- [ ] Re-ingest CFR with subpart-level `reference_section` rows
- [ ] Update `buildSectionListView` to render Subpart -> Section tree
- [ ] Verify Part 91 displays as Subpart A/B/C/... with sections nested

## Notes

- Skip WP per user: "we don't need the pomp and circumstance of a wp if we can avoid it"
- ADR 019 phases 1-10 all shipped; this is browse-surface UX, not reference-system infra
- Existing dirty working tree files (`acs/index.json`, `course/syllabi/ppl-airplane-6c/*`) belong to another session -- leave alone

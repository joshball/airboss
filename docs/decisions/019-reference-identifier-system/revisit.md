---
title: ADR 019 -- Items to revisit later
date: 2026-04-27
authors: Joshua Ball
related: [decision.md]
---

# Items to revisit later

Companion to [decision.md](decision.md). Lists every item deliberately deferred from v3, with:

- **The trigger** -- the concrete event that causes us to revisit
- **The path to action** -- what we'd do when triggered
- **Why deferred** -- the reasoning at v3 approval time

This list is **not** a backlog of "stuff we'll get to eventually." It's a registry of *known design tensions* we've consciously chosen not to resolve now, paired with the conditions under which the decision becomes non-deferrable.

If a trigger never fires, the deferral never matures. That's the right outcome.

## Hard triggers (will likely fire within 1-3 years)

### R1. Internationalization (ICAO Annexes, EASA, foreign reg sets, translations)

**Trigger:** First non-English / non-FAA corpus is added to ingestion.

**Path to action:** Revise §1 of ADR 019 to specify language facet. Two options to consider:

- Language as edition pin extension: `airboss-ref:icao/annex-6/4-3-1?at=2024-en` vs `?at=2024-fr`
- Language as separate query parameter: `?at=2024&lang=en`

The corpus prefix model accommodates new corpora (`icao`, `easa`, `tc-canada`); the language facet is the new dimension that needs design.

**Why deferred:** No non-English corpus is on the airboss roadmap as of v3 approval. Designing for it now would invent a model without real cases to test against. When the first non-English corpus lands, we'll have concrete examples that constrain the design.

### R2. Audio-surface spoken-form citations

**Trigger:** `apps/audio/` ships its first surface that consumes content from the registry.

**Path to action:** Add spoken-form aliases to the indexed tier (e.g. "ninety-one one-oh-three" → `airboss-ref:regs/cfr-14/91/103`). Audio transcripts can match spoken regulatory citations to identifiers. Requires:

- Schema extension: `IndexedContent` adds `spoken_aliases?: string[]`
- Per-corpus rules: how does the corpus pronounce its identifiers
- Alias generation: ingestion or hand-authoring per corpus

**Why deferred:** `apps/audio/` is on the surface roadmap (per MULTI_PRODUCT_ARCHITECTURE.md) but not yet built. Spoken-form aliases are a property of the audio rendering surface; designing them before the surface exists would invent a model without real consumers.

### R3. Learner notifications surface

**Trigger:** `apps/study/` ships a learner-facing notifications surface (whether for "regulation X you cited has been amended" alerts or any other notification capability).

**Path to action:** Add pub/sub to the registry. When a registry entry's edition advances, downstream consumers (lessons that cite the entry, learners who completed those lessons) get notified. Requires:

- Notification schema (event types, severity, dedup rules)
- Subscription model (per-learner, per-lesson, per-corpus)
- Delivery mechanism (in-app, email, push)

**Why deferred:** Notifications are a real future capability the platform will need (per user direction), but no notification surface exists yet. The hooks (registry-edition events) are designable later as an additive change; lessons authored now don't need to know about them.

### R4. Cross-reference staleness modeling

**Trigger:** Third lesson is flagged for cross-reference issues during annual rollover, where the per-identifier diff job didn't catch the stale relationship (i.e., the related identifiers didn't change but their *relationship* did).

**Path to action:** Add cross-reference assertion records to the registry:

```typescript
interface CrossReferenceAssertion {
	id: string;
	lesson: LessonId;
	source_a: SourceId;     // e.g. regs/cfr-14/91/103
	source_b: SourceId;     // e.g. interp/chief-counsel/walker-2017
	relationship: 'interprets' | 'derives-from' | 'depends-on' | 'see-also';
	authored_at: Date;
}
```

When either A or B changes, the assertion is flagged stale. Author re-validates the relationship.

**Why deferred:** v3 relies on per-identifier staleness + author review (option B from the audit walk). The pattern is: when a referenced regulation changes, the lesson is flagged for review; the author's review catches the cross-reference issue downstream. We don't yet know if this catches enough cases. The third lesson's failure is the trigger that proves we need explicit modeling.

### R5. Hangar UI for non-engineer registry entries

**Trigger:** `apps/hangar/` ships content authoring (the surface that lets non-engineers contribute course content).

**Path to action:** Build a registry-entry authoring UI with rich search, autocomplete, and validation. Operators / non-engineer CFIs can:

- Search the registry by canonical short / formal / title
- Author new entries (subject to engineer review)
- Submit acknowledgments for lessons
- Trigger ingestion runs for missing corpora

**Why deferred:** Engineer-side authoring is sufficient through v3. The UX cost of typing identifiers manually is real but bounded; we'll know how serious when we have multiple authors.

### R6. Resolver service (`refs.airboss.dev`)

**Trigger:** Lessons are exported to a non-airboss surface (PDF download, archive snapshot, social share) at scale (defined as: 50+ external accesses per month measured via referrer logs from any external domain).

**Path to action:** Stand up `refs.airboss.dev` as a service that resolves `airboss-ref:` URIs into HTML pages with canonical metadata + redirect-to-live-source. Use cases:

- Click an `airboss-ref:` link from a non-airboss context, land on a useful page
- Bookmarkable, shareable URLs for citations
- Versioned snapshots for "the lesson said X about §91.103 in 2026" historical reference

**Why deferred:** Domain we don't own + service we'd have to operate + unbuilt infrastructure with no current demand. v3 uses per-corpus live URLs (eCFR, faa.gov) as external-viewer fallback; that's sufficient until external sharing becomes a real workflow.

## Soft triggers (might fire; depends on usage patterns)

### R7. Identifier autocomplete tooling (IDE plugin or hangar UI)

**Trigger:** Either (a) a second author independently complains about typing identifiers, or (b) tooling-tracked session-level duplicate count of the same `airboss-ref:` URL > 3 across more than 2 sessions in a 30-day window.

**Path to action:** Build an autocomplete mechanism. Two paths:

- IDE plugin (VS Code extension for `airboss-ref:` lookup)
- Hangar UI picker that emits identifier syntax

**Why deferred:** Friction is real but unmeasured. Designing autocomplete before friction is felt would optimize for a problem we don't yet have. The right time is when we hear "ugh, I keep typing these by hand."

### R8. Reproducibility of rendered snapshots across renderer versions [CLOSED]

**Status:** Closed. v3 stamps `renderer_version: <semver>` into snapshots at render time. The "do we need backwards-compat enforcement for the renderer itself" question would only fire if a divergence is actually reported. If that happens, write a renderer-versioning-policy ADR at that point. Until then, the stamp is the answer.

### R9. Cross-corpus alias chains

**Trigger:** Second time an alias chain crosses a corpus boundary in a way that supersession alone doesn't model cleanly.

**Path to action:** Extend `AliasEntry` schema to allow cross-corpus `from` / `to` references. Currently aliases are within-corpus only.

**Why deferred:** v3 models cross-corpus *supersession* (a single replacement event). Cross-corpus aliasing (a chain spanning corpora) is rare; first occurrence is handled via supersession. Second occurrence is the trigger to model it explicitly.

### R10. Registry-promotion delegation beyond the project owner

**Trigger:** Project owner is unavailable for > 1 week and `pending` ingestion batches are waiting (defined as: 2+ batches pending review for > 7 days).

**Path to action:** Author a delegation ADR specifying who can promote, under what conditions, with what audit trail. Possible delegates: trusted CFI partners, designated agents with review checklists, automated promotion for low-risk corpora.

**Why deferred:** Single-owner review is sufficient for current scale. Delegation is a governance question that deserves its own ADR when the bottleneck is real.

### R11. Per-user search / personal indexes

**Trigger:** `apps/study/` ships a "search my bookmarks / my study history" feature.

**Path to action:** Per-user indexes live in the generated tier (per §4). Schema and tooling defined when the feature is built. May warrant adding a sub-tier or splitting "computed" further.

**Why deferred:** No personal-search feature on the roadmap yet. v3's five-tier model accommodates by classifying user-state-dependent indexes as `generated`.

### R12. Embedding-based "lessons related to this concept"

**Trigger:** RAG retrieval is added to airboss (any surface that uses semantic search over lesson content).

**Path to action:** Vector indexes live in the computed tier (per §4). Schema for embedding storage, refresh cadence, dimensionality, and model choice all decided when the feature is built.

**Why deferred:** No semantic search on the roadmap yet. v3's five-tier model accommodates.

### R13. Academic-style bibliography export [DROPPED]

**Status:** Dropped. No concrete trigger. If a real need arises (partnership, user request), the request itself is the trigger; we don't pre-author a deferral. Adding formatter modules to `@ab/sources/citation-formatters` is straightforward extension when warranted.

### R14. Regulation-diff alerts to subscribers

**Trigger:** Same as R3 (learner notifications surface).

**Path to action:** Build pub/sub on registry edition changes. Emit events when a referenced section is amended; route to learners via the notifications surface. Schema lives alongside R3.

**Why deferred:** Same as R3.

## Watch list (might never fire; mark for awareness only)

### R15. Many-to-many alias semantics

**Trigger:** A registry edition introduces a renumbering where multiple paragraphs split into multiple new paragraphs (not 1→1, not 1→N, not N→1, but M→K).

**Path to action:** Extend `AliasEntry` schema. Author manually maps each old paragraph to its new home(s).

**Why deferred:** Regulatory renumberings rarely produce M→K splits. v3's `split` and `merge` kinds handle the realistic cases. M→K is theoretically possible but unlikely.

### R16. Identifier collision across registry shards

**Trigger:** The registry is split into shards (e.g., per-deployment, per-tenant) AND a collision is detected.

**Path to action:** Add a registry-shard prefix to identifiers, OR enforce global uniqueness via a coordinator service.

**Why deferred:** No registry sharding in v3 scope. Single registry per deployment.

### R17. Ingestion pipelines that produce non-deterministic output

**Trigger:** Annual diff job flags > 100 sections as "needs review" but spot-checking reveals the diffs are line-ending or whitespace artifacts.

**Path to action:** Tighten ingestion normalization. v3 §5 normalizes whitespace, line endings, Unicode NFC. This deferral covers anything that breaks past that (e.g., reformatted tables, semantically-equivalent reorderings).

**Why deferred:** v3's normalization is sufficient for standard ingestion patterns. If non-determinism shows up, the diff-job report is the trigger.

### R18. Ingestion contract for irregular corpora (NTSB, Chief Counsel, FAA Orders)

**Trigger:** Authoring the per-corpus ingestion WP for any irregular corpus.

**Path to action:** Each WP defines its own ingestion approach. Some are bulk-fetch (NTSB might be), some are hand-curated catalogs (Chief Counsel letters), some are hybrid (FAA Orders -- index from a list, fetch each).

**Why deferred:** v3 specifies the registry contract; per-corpus ingestion is the WP's concern.

### R19. Renderer extensibility (custom token vocabulary)

**Trigger:** Two or more authors propose new tokens that don't fit the existing 12.

**Path to action:** v3 §3.1 already says the token vocabulary is open and extended via `@ab/sources/tokens.ts`. The deferred concern is *governance*: how do we decide which proposed tokens land?

**Why deferred:** Token sprawl is a real risk. v3 lets us add tokens without ceremony; the question of "should we" is a governance question that fires only if the set sprawls.

### R20. Plain-text grep affordance [CLOSED]

**Status:** Resolved by design. v3 identifiers include section numbers in the locator path (`/91/103`), so `grep -r '91/103' course/` finds them directly. Smarter searches ("find all lessons that reference any paragraph of §91.103") are queries against the `@ab/sources` API — shipped in Phase 2, not a deferral.

## Process notes

### How items move off this list

A revisit.md item moves off when:

1. **Trigger fires.** Author the response per the listed path to action. If the path needs an ADR, write it; if a WP, spec and build it.
2. **Trigger becomes obsolete.** The condition that would have caused us to care no longer exists. Move the item to "Closed" with a note. (Don't delete.)
3. **The item is decided to be permanent.** Add a closing note explaining why we will not act, and move to "Closed".

### How new items get added

When v3 is implemented and unforeseen design tensions arise:

1. The agent or human flags the tension in a PR comment.
2. PR review evaluates whether to resolve immediately or defer.
3. Deferred items are added to this file with a concrete trigger.

### Closed items

(none yet)

## Cross-reference

For the full reasoning behind these deferrals, see:

- [decision.md §10](decision.md) -- Resolved deferrals (the canonical list with one-line dispositions; this file expands each)
- [review-2026-04-27.md](review-2026-04-27.md) -- Round-1 critique that surfaced many deferrals
- [review-v2-2026-04-27.md](review-v2-2026-04-27.md) -- Round-2 critique that surfaced the rest
- [context.md](context.md) -- Original conversation about the design pressures

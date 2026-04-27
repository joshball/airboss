---
title: 'Spec: Reference identifier scheme validator'
product: cross-cutting
feature: reference-identifier-scheme-validator
type: spec
status: unread
review_status: pending
---

# Spec: Reference identifier scheme validator

The platform-level publish gate for the new `airboss-ref:` identifier scheme defined by [ADR 019](../../decisions/019-reference-identifier-system/decision.md). A new `libs/sources/` lib at `@ab/sources` that owns the URI parser, the lesson-Markdown walker, and the rule-engine validator that runs at `bun run check` time. Phase 1 of the 10-phase plan in ADR 019 §8: the registry's runtime resolution and renderer come later; this package puts the gate in place so every later phase can rely on a clean substrate.

The validator is the publish gate. ERROR-tier findings exit non-zero from `bun run check`, which is what blocks merge to main. WARNING and NOTICE findings surface but do not block. There is no separate publish tooling -- "publish = merge to main", and CI runs `bun run check` (without `--fix`) on every PR.

This package ships the parser + validator + lesson walker. It does NOT ship the registry's actual TypeScript constants table, the per-corpus resolvers, or the renderer. Those are Phase 2 (registry-core), Phase 3 (CFR ingestion), Phase 4 (renderer). The validator depends on a registry **interface** that this package defines and stubs; Phase 2 fills the stub in.

## Why this matters

Without the validator in place, lesson authors can write `airboss-ref:`-shaped URLs that drift in 15 different directions: stale pins, typo'd corpora, orphan acknowledgments, path-rootless vs path-absolute, lazy link text, etc. ADR 019 enumerates 15 validation rules with severity tiers; without a build-time gate, none of them are real. Phase 1 makes them real before Phase 2 starts populating the registry, so every later phase has a clean substrate.

This is also the smallest thing that lets us start writing real `airboss-ref:` references in lessons. Even with an empty registry, the parser + lesson walker + rule engine catches malformed identifiers, missing pins, the `unknown:` escape hatch, and frontmatter ack drift. Authors can begin migrating prose well before the registry is populated.

## Success Criteria

- `libs/sources/` lib exists at `@ab/sources` with parser, validator, lesson-parser, and a registry-stub interface.
- Parser implements §1.1 + §1.1.1 strictly: canonical path-rootless form accepted; path-absolute and authority-based forms rejected; whitespace trimmed; no relative URL resolution.
- Validator implements all 15 rules from ADR 019 §1.5 in order; emits exactly one error per identifier (the first matching rule).
- Lesson parser walks Markdown body for `airboss-ref:` URLs (inline links and reference-style links) and validates frontmatter `acknowledgments` per §3.4.
- All 5 edge cases from ADR 019 §1.5.1 are covered by tests (future-pin, reserved, redacted, newly-created, CI on stale branch).
- `bun run check` integrates the validator and exits clean on the current `course/regulations/` lesson set (which uses plain eCFR URLs, not `airboss-ref:` yet, so the airboss-ref scan finds zero identifiers and passes cleanly).
- The registry interface is stubbed in a way that lets Phase 2 fill it in without touching the validator.
- Existing 1777 svelte-check files unaffected.

## Scope

### In

- New `libs/sources/` workspace at `@ab/sources` with `package.json`, `tsconfig.json`, `src/index.ts` barrel.
- `src/types.ts` -- `SourceId`, `SourceEntry` (per ADR 019 §2.1), `Edition` + `AliasEntry` (per §6.1), `RenderMode`, severity types, validator output types, `SourceLifecycle` enum.
- `src/parser.ts` -- the URI parser implementing §1.1 + §1.1.1. Returns `ParsedIdentifier | ParseError`. Treats locator as opaque (per-corpus shape is the resolver's concern; not Phase 1).
- `src/validator.ts` -- the rule engine implementing §1.5's 15 rules in order, with row 0 (`unknown:`) carve-out per §1.7.
- `src/lesson-parser.ts` -- walks Markdown body, extracts `airboss-ref:`-shaped URLs from inline + reference-style Markdown links, parses frontmatter `acknowledgments`, binds per-link reference labels to ack `id` values.
- `src/registry-stub.ts` -- minimal `RegistryReader` interface that the validator depends on. Default stub returns "no entries"; tests use a fixture registry. Phase 2's `@ab/sources` registry implementation fills the interface.
- `@ab/sources` path alias added to root `tsconfig.json`.
- `bun run check` integration: a `validateReferences` step that walks every lesson Markdown file under `course/regulations/`, parses, validates, reports tiered output. ERROR exits non-zero; WARNING and NOTICE print but don't block.
- Vitest unit tests for the parser, validator, and lesson-parser covering all 15 rules, all 5 edge cases, path-rootless vs path-absolute vs authority-based, whitespace trim, frontmatter ack binding, orphan acks.
- The `--fix` flag and the auto-stamping behavior described in §1.3 are **out of this package** because they require the registry to be queryable for "current accepted edition." See "Out of scope" below.

### Out

- The actual registry's TypeScript constants table (`SOURCES`, per-corpus resolvers, query API). Owned by Phase 2 (`reference-source-registry-core`).
- Per-corpus locator-shape validation. Phase 1's parser treats the locator as opaque; per-corpus resolvers ship in their respective ingestion phases (Phase 3 CFR, Phase 6 handbooks, Phase 7 AIM, etc.). Until those land, the validator's row-1 "locator is syntactically valid for that corpus's resolver" check passes any non-empty locator.
- The `--fix` mode that auto-stamps current `accepted` editions onto unpinned identifiers. Requires Phase 2's registry to know what "current accepted" means per corpus; ships with Phase 2.
- The renderer + token-substitution pipeline. Phase 4.
- The annual diff-job + lesson rewrite generator. Phase 5.
- The `unknown:` migration tool that rewrites placeholders to real identifiers when corpora are ingested. Phase 9.
- Citation rendering UI primitives. Phase 4.
- IDE language server integration for NOTICE-tier findings. Out of every phase in ADR 019 §8; tracked as a follow-on if the editor signal proves valuable.

## Data Model

All types in the `@ab/sources` package. No database tables. The registry-stub is a TypeScript interface; the constants registry that Phase 2 ships against this interface is also TypeScript.

### Types defined here

Source of truth: ADR 019 §2.1 (`SourceEntry`), §6.1 (`Edition`, `AliasEntry`), §1.5 (severity tiers + rule list). Ported verbatim into `libs/sources/src/types.ts`.

| Type            | Origin                            | Notes                                                          |
| --------------- | --------------------------------- | -------------------------------------------------------------- |
| `SourceId`      | ADR 019 §1.1                      | The canonical `airboss-ref:` URI string. Branded type.         |
| `SourceEntry`   | ADR 019 §2.1                      | Static identity per entry. No `parent`, `editions`, etc.       |
| `SourceLifecycle` | ADR 019 §2.4                    | `'draft' \| 'pending' \| 'accepted' \| 'retired' \| 'superseded'` |
| `Edition`       | ADR 019 §6.1                      | Per-edition metadata + alias map.                              |
| `AliasEntry`    | ADR 019 §6.1                      | `kind: 'silent' \| 'content-change' \| 'cross-section' \| 'split' \| 'merge'` |
| `Severity`      | ADR 019 §1.5                      | `'error' \| 'warning' \| 'notice'`                            |
| `ValidationFinding` | This package                  | `{ severity, ruleId, message, location, identifier }`         |
| `ParsedIdentifier`  | This package                  | `{ corpus, locator, pin, raw }` after successful parse        |
| `ParseError`        | This package                  | `{ kind, message, location }` for malformed URI strings       |

### `RegistryReader` interface (stubbed; Phase 2 fills in)

```typescript
interface RegistryReader {
	hasEntry(id: SourceId): boolean;
	getEntry(id: SourceId): SourceEntry | null;
	hasEdition(id: SourceId, edition: string): boolean;
	getEditionLifecycle(id: SourceId, edition: string): SourceLifecycle | null;
	getCurrentAcceptedEdition(corpus: string): string | null;
	getEditionDistance(id: SourceId, pin: string): number | null;
	walkAliases(id: SourceId, fromEdition: string, toEdition: string): AliasEntry[];
	walkSupersessionChain(id: SourceId): SourceEntry[];
	isCorpusKnown(corpus: string): boolean;
}
```

The default stub returns "nothing accepted" for all queries. Tests inject a fixture `RegistryReader` that returns the data the test needs. Phase 2's registry implementation provides a real `RegistryReader` against the constants table.

### Lesson frontmatter ack shape

Source of truth: ADR 019 §3.4. The lesson-parser validates this shape; the renderer (Phase 4) consumes it.

```yaml
acknowledgments:
  - id: <optional Markdown reference label>
    target: <SourceId>
    superseder: <SourceId>
    reason: <slug ≤ 64 chars>
    historical: <boolean, default false>
    note: <free-form prose>
```

## Behavior

### URI parsing (`src/parser.ts`)

Per ADR 019 §1.1 + §1.1.1.

- Trim leading + trailing whitespace from the raw URL string before parsing.
- Accept canonical path-rootless form: `airboss-ref:<corpus>/<locator>?at=<edition>`.
- Reject path-absolute (`airboss-ref:/...`) with a specific error: "path-absolute form is not canonical; use path-rootless `airboss-ref:<corpus>/...`".
- Reject authority-based (`airboss-ref://...`) with a specific error: "authority-based form is not canonical; use path-rootless `airboss-ref:<corpus>/...`".
- No relative URL resolution. `parser.parse(url)` returns `ParsedIdentifier` or `ParseError`; never composes a base URL.
- The locator is **opaque** to the parser. Multiple `/`-separated segments allowed; the per-corpus resolver (Phase 3+) decides whether the locator is syntactically valid for its corpus.
- The `?at=` query parameter is **optional at the parser layer**. The validator's row-1 rule decides whether absence is an error (it is, when the corpus has no slug-encoded edition).
- The `unknown:` magic prefix is recognised here (parses as `corpus: 'unknown'`). The validator's row-0 rule emits an ERROR for any identifier with `corpus === 'unknown'`.
- Extra path segments after the locator are concatenated and returned as `locator`; the parser does not validate segment depth.

### Rule engine (`src/validator.ts`)

Source of truth: ADR 019 §1.5. The 15 rules evaluate in order; the validator emits **exactly one error per identifier** (the first matching rule). WARNING and NOTICE rules can fire alongside an ERROR finding (an identifier may have one ERROR plus one or more WARNING / NOTICE findings).

| #  | Rule                                                                                                                          | Severity | Notes                                                                                            |
| -- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| 0  | `corpus === 'unknown'` (magic prefix per §1.7)                                                                                | ERROR    | Carve-out evaluated before row 1 so the parse-failure message doesn't preempt the migration prompt. |
| 1  | Identifier must parse: path-rootless, corpus enumerated in §1.2 (excluding `unknown`), locator non-empty                       | ERROR    | Per-corpus locator validation lives in the resolver; Phase 1 only checks "non-empty".            |
| 2  | Identifier resolves to an `accepted` or `superseded` registry entry                                                           | ERROR    | Calls `registry.getEntry(id)`. Stub registry returns null until Phase 2 fills it.               |
| 3  | Pinned edition exists in registry                                                                                             | ERROR    | Calls `registry.hasEdition(id, pin)`. Stub returns false.                                       |
| 4  | Identifier resolves to `pending`, `draft`, or `retired`                                                                       | ERROR    | Message names the lifecycle state.                                                               |
| 5  | Identifier uses `?at=unpinned`                                                                                                | WARNING  | Authorial opt-out per §1.3.                                                                      |
| 6  | Pinned edition is older than current `accepted` by > 1 edition                                                                | WARNING  | Calls `registry.getEditionDistance(id, pin)`.                                                   |
| 7  | Link text is empty (after stripping Markdown markup)                                                                          | ERROR    | Lesson-parser computes the stripped text and passes it to the rule engine.                      |
| 8  | Bare identifier in prose (not in a Markdown link)                                                                             | NOTICE   | Lesson-parser detects bare URL-shaped occurrences.                                              |
| 9  | Lazy link text (just the section number echoed back, no token)                                                                | NOTICE   | Lazy detection: link text matches the canonical short form pattern (e.g. `§91.103`) without a token. |
| 10 | Renumbering alias within section, content unchanged                                                                           | (silent) | Resolver applies the alias; no finding emitted.                                                  |
| 11 | Renumbering alias, content changed                                                                                            | WARNING  | `AliasEntry.kind === 'content-change'`.                                                          |
| 12 | Cross-section move (a `cross-section` `AliasEntry`)                                                                           | ERROR    | Resolver does NOT walk past a `cross-section` alias; chain stops at the first such hop.          |
| 13 | Reference to superseded entry without `acknowledgments` entry                                                                 | WARNING  | Lesson-parser passes the ack list; rule checks coverage.                                        |
| 14 | Reason slug in acknowledgments exceeds 48 characters                                                                          | NOTICE   | Slug rules: `[a-z0-9-]`, max 64; recommended 16-32; > 48 is the soft limit.                     |

Output shape per finding:

```typescript
interface ValidationFinding {
	severity: 'error' | 'warning' | 'notice';
	ruleId: number;          // 0..14
	message: string;
	location: { file: string; line: number; column: number };
	identifier: string | null;  // raw URL string; null for ack-level findings (e.g. orphan acks)
}
```

### Lesson parser (`src/lesson-parser.ts`)

- Reads `.md` files. Splits frontmatter (YAML between `---` fences) from body.
- Parses frontmatter via `yaml` (already a project dep). Validates `acknowledgments` shape per §3.4: each entry has `target` (required), optional `id`, `superseder` (required when present), `reason` (required when present, slug-shaped), `historical` (default false), `note` (optional).
- Walks body for `airboss-ref:` URLs. Three Markdown forms covered:
  - Inline links: `[<text>](airboss-ref:...)`
  - Reference-style links: `[<text>][<label>]` paired with `[<label>]: airboss-ref:...`
  - Bare URLs in prose: `airboss-ref:...` (without surrounding `[...](...)`) -- emits row-8 NOTICE.
- For each link, extracts: link text (Markdown source), stripped-text (after removing emphasis markers `*`, `_`, `` ` ``, etc. for row-7 emptiness check), the URL, and source span.
- Skips fenced code blocks (`` ``` ``) and inline code spans (`` ` ``) when scanning for bare URLs and links. Identifiers inside code are NOT validated -- they are treated as documentation of the syntax.
- For reference-style links, binds the bracket label to a frontmatter ack with matching `id`. Emits an ERROR if a body link references a label that doesn't exist as a `[label]: <url>` definition.
- After the body walk, cross-checks acknowledgments:
  - Each ack `target` must be an identifier the body actually references; otherwise emit row-13-adjacent ORPHAN warning ("acknowledgments entry has no body reference"). Per §3.4, warning today; CI gate to ERROR after 30-day grace period is a future enhancement.
  - When a single body link binds to multiple acks via a missing `id`, the lesson-parser emits an error (`§3.4: when one lesson has multiple acks for the same target, every binding link must have an explicit reference label`).
- The lesson-parser does NOT auto-fix. The `--fix` mode for auto-stamping ships with Phase 2.

### `bun run check` integration

A new `validateReferences()` step runs after the existing `references` step (`bun scripts/references.ts validate`, the wiki-link / `[[id]]` validator from the earlier reference-system-core WP). The two systems are distinct:

- The legacy `[[display::id]]` wiki-link system (reference-system-core) is the in-prose syntax for hand-authored aviation glossary terms. Stays in place.
- The new `airboss-ref:` system (this WP) is the URI-shaped reference for the canonical corpus (CFR, AIM, ACs, etc.). Lessons under `course/regulations/` will migrate from plain eCFR URLs to `airboss-ref:` URLs in Phase 9.

Both run side-by-side. The new step:

1. Walks every `.md` file under `course/regulations/**`.
2. For each file, runs the lesson-parser, then the rule engine for each found identifier.
3. Aggregates findings; prints per-severity sections; exits non-zero if any ERROR.

If the lesson set has zero `airboss-ref:` URLs (today's state, since migration is Phase 9), the validator finds zero identifiers, prints "0 references checked, 0 findings", and exits 0.

The validator MUST run only against `course/regulations/**` for now. Future content paths are added when corpora ship; the path list is a constant exported from `@ab/sources` so adding a path is one line.

## Validation

The validator's own behavior is what's being validated; the checks that enforce *the validator itself* are unit tests in this package. No DB-side gates.

| Concern                                                    | Where it runs              |
| ---------------------------------------------------------- | -------------------------- |
| Each row of §1.5 fires correctly                           | Vitest unit (`validator.test.ts`) |
| Row 0 (`unknown:`) takes priority over row 1               | Vitest unit                |
| Rules evaluate in order; exactly one ERROR per identifier  | Vitest unit                |
| Path-rootless accepted; path-absolute rejected; authority-based rejected | Vitest unit (`parser.test.ts`) |
| Whitespace trimmed                                         | Vitest unit                |
| Frontmatter ack shape per §3.4                             | Vitest unit (`lesson-parser.test.ts`) |
| Per-link `id` binding via Markdown reference labels        | Vitest unit                |
| Orphan ack warnings                                         | Vitest unit                |
| 5 edge cases per §1.5.1                                    | Vitest unit                |
| `bun run check` exits clean on current `course/regulations/` | Manual gate (test plan)  |

## Edge Cases

Per ADR 019 §1.5.1:

- **Future-pin (pinning to an edition that doesn't yet exist).** Row 3 ERROR. There is no `?at=future` machinery. The fixture registry's `hasEdition` returns false for unknown pins; rule fires.
- **Reserved sections.** A `[Reserved]` registry entry resolves normally. The validator does not have special handling; the resolver returns the entry, row 2 passes. Token substitution (Phase 4) handles the literal `[Reserved]` rendering.
- **Newly-created sections.** `last_amended_date` is initialized to first-appearance publication date (never null). The validator does not have special handling; row 2 passes when the entry exists.
- **Redacted sections.** Row 2 passes if the entry exists. Render-time `@text` substitution (Phase 4) handles the `[redacted]` literal + NOTICE in the build log. The validator emits no special finding.
- **CI re-running on stale PR branch.** `bun run check` runs without `--fix`; row 6 emits WARNING for any pin > 1 edition stale. WARNING does not block. PR can still merge. Author re-runs `--fix` (Phase 2 deliverable) locally to advance pins.

Additional edge cases this package handles directly:

- **Identifier in a fenced code block.** Skipped. The validator does not parse identifiers inside `` ``` ``.
- **Identifier in inline code.** Skipped. The validator does not parse identifiers inside `` ` ` ``.
- **Reference-style link with a label that has no definition.** ERROR ("undefined reference label `<label>`").
- **Two body links bind to the same ack target without `id` labels.** ERROR per §3.4 (rule embedded in lesson-parser).
- **Frontmatter `acknowledgments` is malformed YAML.** ERROR with the YAML parser's error message + file location.

## Out of Scope (resolved, not deferred)

| Surfaced consideration                                                                                | Resolution                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-stamping unpinned identifiers (`--fix` mode)                                                     | Drop from this WP. Ships with Phase 2 (`reference-source-registry-core`) which provides `getCurrentAcceptedEdition`. The validator's row 1 ERROR for unpinned identifiers is in place; the auto-fix is the only thing deferred.                                                                                                                                                                       |
| Per-corpus locator validation                                                                         | Drop from this WP. Each corpus's WP (Phase 3 for CFR, Phase 6 for handbooks, etc.) ships its own resolver. The validator depends on `RegistryReader.getEntry` returning null for unknown locators; until corpora are populated, every locator is "unknown to the registry" and row 2 fires.                                                                                                          |
| Renderer + token substitution                                                                         | Drop. Phase 4.                                                                                                                                                                                                                                                                                                                                                                                       |
| `unknown:` migration tool                                                                             | Drop. Phase 9. The validator's row 0 emits ERROR with the migration message; the actual rewrite tool ships when corpora are ingested.                                                                                                                                                                                                                                                                |
| Annual diff-job                                                                                       | Drop. Phase 5.                                                                                                                                                                                                                                                                                                                                                                                       |
| IDE language server / NOTICE-tier surfaces                                                             | Drop. ADR 019 §1.5 specifies NOTICE is "IDE language server only"; the language server is not currently part of the platform. NOTICE findings print to the CLI for now (visible but not blocking). When/if a language server lands, NOTICE findings move there.                                                                                                                                       |
| Multi-line / multi-link adjacency merge                                                                | Drop. Phase 4 (renderer). The validator does not normalise `§91.167-91.171`; that's a render-time concern. The validator only sees individual identifiers, each parsed and validated independently.                                                                                                                                                                                                  |
| `?at=unpinned` ERROR-promotion CI gate                                                                | Drop from this WP (warning only today). Promote to ERROR via a CI-only flag in a future maintenance pass, after we observe `?at=unpinned` usage in practice.                                                                                                                                                                                                                                          |
| Orphan ack ERROR-promotion (after 30-day grace)                                                       | Drop from this WP. Same pattern: warning today; the 30-day grace and ERROR promotion is a CI flag flip in the future.                                                                                                                                                                                                                                                                                |
| Non-Markdown content scanning (Svelte component imports of `@ab/sources` constants per §3.3)          | Drop from this WP. Phase 1 covers Markdown only. When Svelte components start importing `@ab/sources` identifier constants (post-Phase 4), the lesson-parser path expansion is a one-paragraph follow-on. Captured as a Phase 4 prerequisite, not deferred indefinitely.                                                                                                                              |

## Dependencies

- **Upstream:** ADR 019 (approved). No code dependencies; this is the first package in the new chain.
- **Downstream:** Phase 2 (`reference-source-registry-core`) imports `RegistryReader` and the type set from `@ab/sources`. Phase 3 (CFR ingestion) populates the registry against the Phase 2 implementation. Phase 4 (renderer) consumes the parser + types.
- **Side-by-side:** The legacy `[[display::id]]` wiki-link system (reference-system-core) is unaffected. Both validators run in `bun run check`; their outputs are aggregated.

## Open Items

Ratified during this spec, not deferred:

- Validator runs against `course/regulations/**` only in Phase 1. Path list is a constant in `@ab/sources`; future paths are one-line additions. (Decision: do not pre-author path expansion; add per phase.)
- The legacy `[[display::id]]` syntax and the new `airboss-ref:` syntax coexist permanently. They serve different content (glossary terms vs. canonical corpus references). No migration between them.
- WARNING-tier findings print to stdout; ERROR-tier findings print to stderr. NOTICE-tier findings print to stdout. CI captures both.

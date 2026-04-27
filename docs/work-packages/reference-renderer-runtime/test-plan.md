---
title: 'Test plan: Reference renderer runtime'
product: cross-cutting
feature: reference-renderer-runtime
type: test-plan
status: unread
review_status: pending
---

# Test plan: Reference renderer runtime

## Setup

- Phases 1-3 are merged (#241, #246, #247). Registry has real `regs` entries for §91.103, §91.167, §91.169, §91.171, etc., once `primeRenderFixtures()` runs.
- This WP adds `libs/sources/src/render/`, `apps/study/src/lib/server/references.ts`, `apps/study/src/lib/components/RenderedLesson.svelte`, and `apps/study/src/routes/(dev)/references/`.
- Test fixtures (synthetic `interp/walker-2017` + `interp/smith-2027` for ack tests) prime via `__test_helpers__.ts`.

---

## Automated (Vitest)

### `extractIdentifiers` -- `libs/sources/src/render/extract.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| EX-01 | Empty body | `[]`. |
| EX-02 | One inline link | `[id]`. |
| EX-03 | Two inline links to same id same pin | `[id]` (dedup). |
| EX-04 | Two inline links to same id different pins | Two-element list, source order. |
| EX-05 | Reference-style link with definition | Identifier extracted. |
| EX-06 | Bare URL in prose | Identifier extracted (NOTICE-tier handling at render is "no token substitution"). |
| EX-07 | Identifier inside fenced code | Skipped. |
| EX-08 | Identifier inside inline code | Skipped. |
| EX-09 | Identifier inside reference-definition line | Skipped. |
| EX-10 | Body with three identifiers ordered C, A, B | List preserves source order: `[C, A, B]`. |

### `tokens` -- `libs/sources/src/render/tokens.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| TK-01 | Module init registers all 12 default tokens | `listTokens().length === 12`; each named-`@*` token returns from `getToken`. |
| TK-02 | `registerToken` adds a custom token | `getToken('@custom')` returns it. |
| TK-03 | Re-registering existing name throws | `expect(() => registerToken({ name: '@cite', ... })).toThrow()`. |
| TK-04 | `__token_internal__.resetToDefaults()` restores 12 | Custom token disappears; default `@cite` returns. |
| TK-05 | `@short` substitutes `entry.canonical_short` | `'§91.103'`. |
| TK-06 | `@formal` substitutes `entry.canonical_formal` | `'14 CFR § 91.103'`. |
| TK-07 | `@title` substitutes `entry.canonical_title` | `'Preflight action'`. |
| TK-08 | `@cite` substitutes short + space + title | `'§91.103 Preflight action'`. |
| TK-09 | `@list` substitutes group's listText for 3-element group | `'§91.167-91.169'` for contiguous. |
| TK-10 | `@list` substitutes single-entry shortcut | `'§91.103'` for 1-element group. |
| TK-11 | `@as-of` substitutes pin literal | `'2026'`. |
| TK-12 | `@as-of` against `?at=unpinned` | `'unpinned'`. |
| TK-13 | `@as-of` against null pin | `''`. |
| TK-14 | `@text` substitutes indexed normalizedText | The full section markdown. |
| TK-15 | `@quote` wraps in blockquote markup | `'> ...\n> -- §91.103'` shape. |
| TK-16 | `@last-amended` substitutes ISO date | `'2009-08-21'`. |
| TK-17 | `@deeplink` substitutes liveUrl | `'https://www.ecfr.gov/current/title-14/...'`. |
| TK-18 | `@chapter` walks parent slug for chapter | The chapter entry's title (or empty when not a handbook id). |
| TK-19 | `@subpart` walks parent slug for subpart | The subpart entry's title (or empty). |
| TK-20 | `@part` walks parent slug for part | The part entry's title. |

### `adjacency` -- `libs/sources/src/render/adjacency.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| AD-01 | One identifier in body | One 1-element group. |
| AD-02 | Two adjacent same-corpus same-pin separated by `, ` | One 2-element group. |
| AD-03 | Three adjacent separated by `, ... and ` | One 3-element group. |
| AD-04 | Two identifiers separated by prose | Two 1-element groups. |
| AD-05 | Same-corpus different-pin adjacent | Two 1-element groups. |
| AD-06 | Different-corpus same-pin adjacent | Two 1-element groups. |
| AD-07 | Range form: 167, 168, 169 contiguous | Group shape `'range'`, listText source `from 167 to 169`. |
| AD-08 | Comma-list form: 167, 169, 171 | Group shape `'list'`, members preserved. |
| AD-09 | Range form across decimals (e.g. `103.a`-style locator) | Falls back to `'list'`. |
| AD-10 | Markdown emphasis around adjacent links (`*[id1](url) and [id2](url)*`) | Still treated as adjacent. |
| AD-11 | Adjacent links with semicolons | Still treated as adjacent. |

### `annotations` -- `libs/sources/src/render/annotations.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| AN-01 | No acks, no supersession | `kind: 'none'`. |
| AN-02 | Ack with `historical: true` | `kind: 'historical'`, text `(historical reference)`. |
| AN-03 | `historical_lens: true`, no per-target ack | `kind: 'historical'` for every id. |
| AN-04 | `historical_lens: true` with per-target `historical: false` ack | Per-target wins; `kind` matches per-target ack semantics. |
| AN-05 | Ack with `superseder` matching chain end | `kind: 'covered'`, text contains `(acknowledged ${chainEnd.canonical_short} supersession; ${reason})`. |
| AN-06 | Ack with `superseder` that's now superseded | `kind: 'chain-advanced'`, text `(ack chain advanced; please re-validate)`. |
| AN-07 | No acks but chain crosses corpora | `kind: 'cross-corpus'`, text contains `(via ...)`. |
| AN-08 | No acks, single-corpus chain length > 1 | `kind: 'none'` (validator already emits row-13). |
| AN-09 | Ack reason kebab-case `original-intact` rendered verbatim | Reason text `original-intact`. |

### `batchResolve` -- `libs/sources/src/render/batch-resolve.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| BR-01 | Static-only path: id resolves, body has only `@cite` | Indexed content NOT read; `resolved.indexed === null`. |
| BR-02 | Indexed-tier path: body has `@text` | Indexed content read; `resolved.indexed !== null`. |
| BR-03 | Indexed-tier path with both `@text` and `@cite` for same id | One indexed read (memoization). |
| BR-04 | Different ids each with `@text` | Two indexed reads. |
| BR-05 | Supersession chain length > 1 surfaces in `chain` | `resolved.chain.length > 1`. |
| BR-06 | Cross-corpus chain | `resolved.annotation.kind === 'cross-corpus'`. |
| BR-07 | Unknown corpus | `resolved.entry === null`, `resolved.chain === []`. |
| BR-08 | Empty ids | Empty map. |
| BR-09 | Resolver factory override | Custom factory returns; production not consulted. |
| BR-10 | `liveUrl` populated from per-corpus resolver | URL is a string. |

### Mode handlers -- `libs/sources/src/render/modes/{web,plain-text,print,tts,default}.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| MW-01 | Web: `@cite` link | `<a href="<liveUrl>" class="ab-ref ab-ref-regs">§91.103 Preflight action</a>`. |
| MW-02 | Web: with `covered` annotation | Trailing `<span class="ab-ref-annotation ab-ref-covered">(...)</span>`. |
| MW-03 | Web: with ack note | `title="<note>"` on the anchor. |
| MW-04 | Web: grouped link first member | Anchor emitted with adjacency listText. |
| MW-05 | Web: grouped link non-first member | Empty string (group consumed by first). |
| MP-01 | Plain-text: `@cite` link | `§91.103 Preflight action (https://www.ecfr.gov/current/...)`. |
| MP-02 | Plain-text: with annotation | `§91.103 Preflight action (https://...) (acknowledged ...)`. |
| MR-01 | Print: anchor + `<sup>n</sup>` | `<sup>1</sup>` marker present. |
| MR-02 | Print: footnote text in `<aside class="ab-ref-footnotes">` | Aside present at end of output; URL in footnote body. |
| MT-01 | TTS: `@cite` | `§91.103 Preflight action`; URL not present. |
| MT-02 | TTS: `@text` | Section text spoken; identifier removed. |
| MD-01 | Screen-reader: `aria-label` set | `aria-label="<cite + annotation>"` on anchor. |
| MD-02 | RSS: absolute URLs | URL is fully qualified. |
| MD-03 | Share-card: 80-char truncation | Output length <= 80. |
| MD-04 | RAG: machine-readable comment | Output contains `<!-- airboss-ref:... -->`. |
| MD-05 | Slack-unfurl: title from `@cite` | First line is the cite. |
| MD-06 | Transclusion: pin preserved | Resolved entry's pin is the source pin. |
| MD-07 | Tooltip: 200-char truncation | Output length <= 200. |

### `substituteTokens` end-to-end -- `libs/sources/src/render/substitute.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| SU-01 | Web mode, fixture happy-path body | Snapshot matches. |
| SU-02 | Web mode, fixture adjacency body | Single anchor for the 3-element group. |
| SU-03 | Web mode, fixture acknowledgment body | Annotation span present after the binding link. |
| SU-04 | Plain-text mode, fixture happy-path body | Snapshot matches. |
| SU-05 | Plain-text mode, fixture acknowledgment body | Inline-parenthetical annotation present. |
| SU-06 | Print mode, fixture happy-path body | Footnote machinery present. |
| SU-07 | TTS mode, fixture happy-path body | Identifier removed from output. |
| SU-08 | Web mode, body with non-airboss-ref link | Link untouched. |
| SU-09 | Web mode, body with unresolved id (entry null) | Link text untouched (defensive); `console.warn` fires. |
| SU-10 | Empty body | Body unchanged. |

### Serialize round-trip -- `libs/sources/src/render/serialize.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| SE-01 | Empty map round-trips | Equal. |
| SE-02 | Single entry round-trips | Equal; `last_amended_date` precision preserved. |
| SE-03 | Chain of length 3 round-trips | Equal. |
| SE-04 | `liveUrl: null` round-trips | Equal. |
| SE-05 | `indexed` populated round-trips | Equal. |

### `loadLessonReferences` (apps/study) -- `apps/study/src/lib/server/references.test.ts`

| ID | Scenario | Expected |
| --- | --- | --- |
| LR-01 | Empty body | Returns `{ body: '', resolved: {}, mode: 'web' }`. |
| LR-02 | Body with one resolved id | `resolved` has one key. |
| LR-03 | Body with `@text` token | Indexed content present in serialized form. |
| LR-04 | Mode override `'plain-text'` | `mode === 'plain-text'`. |
| LR-05 | Acknowledgments forwarded | `resolved[id].annotation.kind` matches expected cascade output. |

---

## Manual

### Demo route smoke

| ID | Action | Expected |
| --- | --- | --- |
| DM-01 | Visit `/references` | Page renders with three fixture lessons in `web` mode. |
| DM-02 | Each anchor has `href` to eCFR | Hover URL bar; eCFR URL visible. |
| DM-03 | `?mode=plain-text` | Output is plaintext, URLs in parens. |
| DM-04 | `?mode=print` | `<sup>` footnote markers visible. |
| DM-05 | `?mode=tts` | Identifier removed; substitution text only. |
| DM-06 | `?mode=screen-reader` | `aria-label` set on each anchor. |
| DM-07 | Adjacency fixture has single anchor for 3-element group | Range form `§91.167-91.169` rendered. |
| DM-08 | Acknowledgment fixture | Annotation span attached to the binding link. |

### `bun run check` gate

| ID | Action | Expected |
| --- | --- | --- |
| CK-01 | `bun run check` | Exits 0. |
| CK-02 | `bun test libs/sources/` | All render tests pass; existing 100+ Phase 1-3 tests still pass. |
| CK-03 | `bun test apps/study/` | New server-helper tests pass. |

### Visual inspection (the eyeball test)

| ID | Action | Expected |
| --- | --- | --- |
| VI-01 | Happy-path lesson rendered in web mode | `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` appears as `§91.103 Preflight action`, hyperlinked, no leftover `@cite` literal. |
| VI-02 | Adjacency lesson | Three contiguous identifier links render as one anchor with `§91.167-91.169` text. |
| VI-03 | Acknowledgment lesson | Reference to `walker-2017` includes a trailing `(acknowledged 2030 supersession; original-intact)` annotation. |
| VI-04 | Cross-corpus chain (synthetic fixture) | Annotation `(via §X in regs:tsa-49)` visible. |

---

## Coverage assertions

The render API surface is fully covered when:

- Every public export from `@ab/sources/render/index.ts` has at least one direct unit test.
- Every of the 12 default tokens has a substitution test producing the §3.1 output.
- Every render mode (11) has at least one mode-handler test asserting its §3.1 surface shape.
- Every annotation kind (5: `none`, `covered`, `chain-advanced`, `historical`, `cross-corpus`) has at least one annotation test.
- The three demo fixtures (happy-path, adjacency, acknowledgment) each pass an end-to-end snapshot test in at least two render modes (web + plain-text minimum).
- Round-trip serialization is asserted for every field on `SerializableResolvedIdentifier`.
- The SvelteKit server load helper has at least one test exercising the full pipeline (extract -> resolve -> serialize -> deserialize -> substitute).

---

## Out of test plan

- **Production lesson page rendering.** Phase 4 ships the demo route only. A production lesson page integration is a separate WP under `apps/study/`.
- **Real PDF rasterization.** Phase 4's `print` mode emits HTML; the PDF surface consumes it but is not Phase 4's deliverable.
- **Real TTS synthesis.** Phase 4's `tts` mode emits text; spoken-form aliases (R2) ship with `apps/audio/`.
- **Cross-browser visual regression.** Phase 4's manual smoke is "the demo route renders without runtime error in dev mode." Cross-browser snapshots ship when `apps/study/` adds Playwright cross-browser coverage.
- **Performance benchmarks.** Phase 4's render is regex + map lookups, comfortably sub-millisecond at typical lesson sizes. If perf becomes a concern at scale, memoize-by-body-hash inside the component's `$derived`.

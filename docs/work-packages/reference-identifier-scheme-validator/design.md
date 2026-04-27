---
title: 'Design: Reference identifier scheme validator'
product: cross-cutting
feature: reference-identifier-scheme-validator
type: design
status: unread
review_status: pending
---

# Design: Reference identifier scheme validator

## Library boundary: `libs/sources/`, not `libs/aviation/`

**Question:** Where do the parser, rule engine, and lesson-walker live?

**Chosen:** A new `libs/sources/` workspace at `@ab/sources`. Distinct from the existing `libs/aviation/`.

**Why:**

- ADR 019 §2 explicitly names the new lib `@ab/sources`. The registry it owns (Phase 2+) is the canonical-corpus runtime resolver; not the same thing as the hand-authored 175-entry aviation glossary in `@ab/aviation`.
- The two libs serve different content in lessons:
  - `@ab/aviation` owns `[[display::id]]` wiki-link prose syntax for glossary terms (V-speeds, mnemonics, definitions).
  - `@ab/sources` owns `airboss-ref:` URI-shaped references for the canonical corpus (CFR sections, AIM paragraphs, ACs, NTSB reports, etc.).
- They coexist permanently. No migration path between them. Different content, different validators, different render paths.
- Phase 2 (`reference-source-registry-core`) ships the registry implementation in this lib. Phase 1 (this WP) ships only the validator + types + stub interface, so Phase 2 can drop in without touching the validator.

**Cost accepted:** One more `@ab/*` path alias. Standard pattern; cheap.

## Types live here, registry implementation lands in Phase 2

**Question:** The validator depends on `RegistryReader` to query lifecycle, edition existence, alias chains. Where does that interface live? Where does its implementation live?

**Chosen:** Interface in `@ab/sources/types.ts`. Default `NULL_REGISTRY` stub here. Real implementation in Phase 2.

**Why:**

- The validator must be testable today, before any registry data exists. Tests inject fixture `RegistryReader` instances; no DB roundtrip, no global state.
- Phase 2 ships the constants table and the per-corpus resolvers in the same lib (`@ab/sources`). It implements `RegistryReader` against the constants. Drop-in; the validator doesn't change.
- This avoids the temptation to short-circuit the rule engine ("we don't have a registry yet, so let's skip rows 2-4"). Rows 2-4 always run. Today they always fire (because the stub returns null/false), which is the correct Phase 1 behavior: any author who writes an `airboss-ref:` URL gets ERROR, prompting them to wait for Phase 2 corpora.

## Parse first, validate second; rule engine sees a parsed shape

**Question:** Should each rule re-parse the URL string, or should there be one parser pass producing a typed shape that all rules consume?

**Chosen:** One parser pass. The validator operates on `ParsedIdentifier | ParseError`.

**Why:**

- 15 rules; if each re-parsed the URL, every parser bug would manifest 15 ways.
- The parse error itself is what row 1 reports. Rows 2-14 only run when parsing succeeded (and row 0 ran before row 1).
- The parser is small (sub-200 lines) and pure. Easy to test in isolation.

### Parser flow

```text
Raw string -> trim whitespace -> peek scheme -> reject path-absolute / authority-based ->
  split <corpus>/<rest> on first slash -> split <rest> + <query> on '?' ->
  parse query for `at` value -> emit ParsedIdentifier { corpus, locator, pin, raw }
```

Special case: `corpus === 'unknown'` is recognised by the parser as a regular shape. The validator's row 0 takes over from there.

### URL parser library?

**Decision:** Use Bun's built-in `URL` constructor where it gives us the right answer; hand-roll the path-rootless / path-absolute / authority-based discrimination.

The reason `URL` alone isn't enough: per ADR 019 §1.1.1, all three syntactic variants `airboss-ref:foo`, `airboss-ref:/foo`, `airboss-ref://foo` are accepted by WHATWG URL but mean different things. We must reject the latter two with specific error messages. The cleanest implementation is regex-discriminate the leading slashes ourselves and then optionally use `URL` to extract the query string. (Or skip `URL` entirely; the format is regular enough.)

## Rule engine: ordered, exactly-one-error, multi-finding

**Question:** §1.5 says "exactly one error per identifier (the first matching rule)" but WARNING and NOTICE rules can also fire. How do we represent that without losing information?

**Chosen:**

- Iterate rules in declaration order.
- For ERROR-tier rules: the first match terminates the ERROR slot. Subsequent ERROR rules do not run.
- For WARNING and NOTICE rules: every match emits a finding. They run independently of the ERROR slot.

So an identifier might have 0-1 ERROR findings and 0-N WARNING/NOTICE findings.

### Rule structure

```typescript
interface Rule {
	id: number;             // 0..14
	severity: Severity;
	check(parsed: ParsedIdentifier | ParseError, ctx: RuleContext): RuleResult;
}

type RuleResult =
	| { fired: false }
	| { fired: true; message: string };
```

`RuleContext` carries the registry reader, the lesson context (link text, ack list, source span), and any prior findings (for rules that need to know what already fired).

The rule engine:

```typescript
function validateIdentifier(parsed: ParsedIdentifier | ParseError, ctx: RuleContext): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	let errorEmitted = false;
	for (const rule of RULES) {
		if (rule.severity === 'error' && errorEmitted) continue;
		const result = rule.check(parsed, ctx);
		if (!result.fired) continue;
		findings.push({ severity: rule.severity, ruleId: rule.id, message: result.message, ... });
		if (rule.severity === 'error') errorEmitted = true;
	}
	return findings;
}
```

Row 10 (silent auto-resolve) is implemented as a rule that returns `{ fired: false }` even when it matches; the alias resolver pre-applies the alias inside `RuleContext` so downstream rules see the resolved identifier.

## Lesson-parser: regex + state machine, not a Markdown AST

**Question:** Walk the body for `airboss-ref:` URLs. Use a full Markdown parser, or roll our own?

**Chosen:** Roll our own. Regex + state machine for fenced-code-block tracking. Mirrors `libs/aviation/src/wikilink/parser.ts` (the legacy `[[display::id]]` parser).

**Why:**

- A full Markdown parser is heavy; we only care about three things: inline links, reference-style links + label definitions, and code-block boundaries.
- Lesson Markdown is hand-authored. Edge cases that would require a real Markdown spec (CommonMark inline link nesting, link-reference matching with case folding, etc.) don't appear in our content.
- The legacy `[[id]]` parser has been running on `course/knowledge/` for months without issue. Same pattern works here.

### State machine

```text
TEXT                      Default state.
  "```"   ->              FENCED_CODE
  "`"     ->              INLINE_CODE
  "[" + look_ahead is "[" -> stay in TEXT (legacy [[id]] parser owns that)
  "[" + look_ahead is text + "]" + "(" -> INLINE_LINK
  "[" + look_ahead is text + "]" + "[" -> REF_STYLE_LINK
  /^\[([^\]]+)\]:/  ->     REF_DEFINITION (line-start; collect label + URL)
  newline-prefix "airboss-ref:..." -> bare URL detection (NOTICE row 8)

FENCED_CODE                "```" -> TEXT. Skip identifier scanning.
INLINE_CODE                "`" or newline -> TEXT. Skip.
INLINE_LINK                Collect text + URL between (...). Emit identifier occurrence.
REF_STYLE_LINK             Collect text + label between [...]. Look up label later from REF_DEFINITION pass.
REF_DEFINITION             Collect URL after `[label]:`. Add to label table.
```

After the body walk completes, resolve REF_STYLE_LINK occurrences against the label table. Unresolved labels emit ERROR.

### Frontmatter parsing

YAML between the leading `---\n` and the next `\n---`. Project already depends on `yaml`; use it. Validate the `acknowledgments` array shape with explicit field checks (no Zod here; the lib is dependency-light).

### Bare URL detection

A bare URL is `airboss-ref:...` not preceded by `](` (i.e. not the URL portion of an inline link) and not preceded by `]: ` (i.e. not the URL portion of a reference definition). Regex:

```text
/(?<![\]\(:\s\)])\bairboss-ref:[^\s\)]+/g
```

with a follow-up filter that re-checks the surrounding context for safety. Bare URLs emit NOTICE row 8 -- they don't block the build.

## Severity output: stderr for ERROR, stdout for WARNING/NOTICE

**Question:** Where does each tier print?

**Chosen:**

- ERROR -> stderr (so CI's `2>&1` aggregation surfaces them up the chain).
- WARNING -> stdout (visible in CI logs but not failure markers).
- NOTICE -> stdout.
- All findings include file path + line + column for clickable terminals (`path:line:col` convention).

CLI summary (printed last):

```text
Reference identifier validation: 25 lessons checked, 0 identifiers found, 0 findings.
```

Or with findings:

```text
Reference identifier validation: 25 lessons checked, 47 identifiers found, 12 findings:

ERROR (2)
  course/regulations/week-04-.../05-preflight-action.md:42:18
    [airboss-ref:unknown/foo] row 0: Transitional reference; cannot publish. Replace with a real identifier or wait for ingestion of the relevant corpus.
  course/regulations/week-04-.../06-vfr-weather-minimums.md:128:7
    [airboss-ref:/regs/cfr-14/91/155?at=2026] row 1: path-absolute form is not canonical; use path-rootless `airboss-ref:<corpus>/...`

WARNING (5)
  ...

NOTICE (5)
  ...
```

## Dependency-light: parser uses no external deps; lesson-parser uses `yaml`

**Question:** What goes in `package.json`?

**Chosen:**

- `@ab/sources` deps: `yaml` (already a project dep, used in frontmatter).
- No `@ab/constants` dep (the validator doesn't need any constants today; if the path list grows, it stays internal to the lib).
- No `@ab/aviation` dep (different system).
- No DB deps (no Drizzle, no postgres).

Dependency-light = easy to ship + fast to iterate.

## Test fixtures: `RegistryReader` is the seam

**Question:** How do tests assert behavior of rules that depend on the registry?

**Chosen:** Tests construct fixture `RegistryReader` instances inline.

```typescript
const fixtureReader: RegistryReader = {
	hasEntry: (id) => id === ('airboss-ref:regs/cfr-14/91/103' as SourceId),
	getEntry: (id) => id === ('airboss-ref:regs/cfr-14/91/103' as SourceId)
		? { id, corpus: 'regs', canonical_short: '§91.103', ..., lifecycle: 'accepted' }
		: null,
	hasEdition: (_, ed) => ed === '2026',
	getEditionLifecycle: (_, ed) => ed === '2026' ? 'accepted' : null,
	getCurrentAcceptedEdition: (corpus) => corpus === 'regs' ? '2026' : null,
	getEditionDistance: (_, pin) => pin === '2026' ? 0 : 5,
	walkAliases: () => [],
	walkSupersessionChain: () => [],
	isCorpusKnown: (c) => c === 'regs',
};
```

Each test wires up exactly the registry data it needs. No global registry state in tests.

## Future expansion points (captured, not deferred)

- **Path list expansion.** When new content paths come online (`apps/study/src/lib/lessons/`, `course/aim/`, etc.), add to `LESSON_CONTENT_PATHS` in `@ab/sources`. One-line change.
- **Per-corpus locator validation.** Each corpus's WP (Phase 3+) registers a `parseLocator` resolver. The validator's row 1 calls into the corresponding resolver when present; falls back to "non-empty" check when absent. The validator code is in place; resolvers are added per phase.
- **`--fix` mode.** Phase 2 deliverable. The validator gains a `fixUnpinned: boolean` option that rewrites lesson files in place to add `?at=<currentAccepted>`. Implementation pattern: capture source spans during parse, build replacement strings, write back.
- **NOTICE-to-IDE.** When/if a language server lands, NOTICE findings move there instead of stdout. Phase 1 keeps them on stdout so they're visible in CI.

## Non-decisions (deferred to later phases per ADR 019 §8)

- Token recognition vs substitution. Phase 1 recognises `@cite`, `@list`, etc. only enough to detect "lazy text" for row 9. Substitution is Phase 4.
- Adjacent-identifier merging (`§91.167-91.171`). Phase 4 (renderer).
- `unknown:` migration tool. Phase 9.
- Annual diff job. Phase 5.
- Hangar UI for registry entries. Hangar revival WP per ADR 017 + ADR 019 §10.

## Reference flow (end-to-end, single identifier)

```text
Author writes: [@cite](airboss-ref:regs/cfr-14/91/103?at=2026)
                                    |
                                    | (lesson-parser, body walk)
                                    v
{ raw: 'airboss-ref:regs/cfr-14/91/103?at=2026',
  linkText: '@cite',
  strippedText: '@cite',
  source: { file: '...', line: 42, column: 18 } }
                                    |
                                    | (parser.parseIdentifier)
                                    v
{ corpus: 'regs', locator: 'cfr-14/91/103', pin: '2026' }
                                    |
                                    | (validator.validateIdentifier with default NULL_REGISTRY)
                                    v
[ { severity: 'error', ruleId: 2, message: 'Identifier does not resolve to an accepted entry.' } ]
                                    |
                                    | (check.ts aggregates per file)
                                    v
Final exit: non-zero (because at least one ERROR fired during walk).
```

After Phase 2 lands and the registry has the entry, the same identifier produces zero findings; check exits 0.

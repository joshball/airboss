import { describe, expect, test } from 'vitest';
import { isParseError, parseIdentifier } from './parser.ts';
import { NULL_REGISTRY } from './registry-stub.ts';
import type {
	AliasEntry,
	IdentifierOccurrence,
	LessonAcknowledgment,
	ParsedIdentifier,
	ParseError,
	RegistryReader,
	SourceEntry,
	SourceId,
	SourceLifecycle,
	SourceLocation,
} from './types.ts';
import { type RuleContext, validateIdentifier } from './validator.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FILE = 'fixture.md';
const LOC: SourceLocation = { file: FILE, line: 1, column: 1 };

function parseOrThrow(raw: string): ParsedIdentifier {
	const parsed = parseIdentifier(raw);
	if (isParseError(parsed)) throw new Error(`fixture parse failed: ${parsed.message}`);
	return parsed;
}

function parseExpectingError(raw: string): ParseError {
	const parsed = parseIdentifier(raw);
	if (!isParseError(parsed)) throw new Error('expected parse error, got success');
	return parsed;
}

interface FixtureOpts {
	entries?: Record<string, SourceEntry>;
	editions?: Record<string, ReadonlySet<string>>;
	currentAccepted?: Record<string, string>;
	editionDistance?: Record<string, number>;
	aliases?: Record<string, readonly AliasEntry[]>;
	supersessionChains?: Record<string, readonly SourceEntry[]>;
	knownCorpora?: ReadonlySet<string>;
}

function fixtureRegistry(opts: FixtureOpts = {}): RegistryReader {
	// Derive known corpora from explicit `knownCorpora` plus any corpora
	// implied by `entries` and `currentAccepted`. Tests that supplied entries
	// in Phase 1 shouldn't have to also set `knownCorpora` to keep their
	// row-2/row-3/row-4 expectations after Phase 2's row-1 activation.
	const derivedKnownCorpora = new Set<string>(opts.knownCorpora ?? []);
	for (const id of Object.keys(opts.entries ?? {})) {
		const corpus = id.split(':')[1]?.split('/')[0];
		if (corpus !== undefined) derivedKnownCorpora.add(corpus);
	}
	for (const corpus of Object.keys(opts.currentAccepted ?? {})) {
		derivedKnownCorpora.add(corpus);
	}
	return {
		hasEntry: (id) => Boolean(opts.entries?.[id]),
		getEntry: (id) => opts.entries?.[id] ?? null,
		hasEdition: (id, edition) => opts.editions?.[id]?.has(edition) ?? false,
		getEditionLifecycle: (_id, _edition) => null,
		getCurrentAcceptedEdition: (corpus) => opts.currentAccepted?.[corpus] ?? null,
		getEditionDistance: (id, _pin) => opts.editionDistance?.[id] ?? null,
		walkAliases: (id, _from, _to) => opts.aliases?.[id] ?? [],
		walkSupersessionChain: (id) => opts.supersessionChains?.[id] ?? [],
		isCorpusKnown: (corpus) => derivedKnownCorpora.has(corpus),
	};
}

function makeEntry(id: string, lifecycle: SourceLifecycle): SourceEntry {
	return {
		id: id as SourceId,
		corpus: id.split(':')[1]?.split('/')[0] ?? 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2026-01-01'),
		lifecycle,
	};
}

function ctx(
	registry: RegistryReader,
	occurrence?: Partial<IdentifierOccurrence>,
	acks?: readonly LessonAcknowledgment[],
): RuleContext {
	const occ: IdentifierOccurrence | undefined = occurrence
		? {
				raw: occurrence.raw ?? '',
				location: LOC,
				linkText: occurrence.linkText ?? null,
				strippedText: occurrence.strippedText ?? null,
				isBare: occurrence.isBare ?? false,
				referenceLabel: occurrence.referenceLabel ?? null,
			}
		: undefined;
	return { registry, location: LOC, occurrence: occ, acknowledgments: acks };
}

// ---------------------------------------------------------------------------
// Row 0 -- unknown:
// ---------------------------------------------------------------------------

describe('validator row 0 -- unknown: prefix', () => {
	test('V-00: airboss-ref:unknown/foo emits exactly row 0 ERROR; row 1 does not also fire', () => {
		const parsed = parseOrThrow('airboss-ref:unknown/cost-sharing-letter');
		const findings = validateIdentifier(parsed, ctx(NULL_REGISTRY));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(0);
		expect(errors[0].message).toMatch(/Transitional reference/);
		// No row-2 / row-3 / row-4 follow-up for unknown:
		expect(findings.find((f) => f.ruleId === 2)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Row 1 -- parse failure
// ---------------------------------------------------------------------------

describe('validator row 1 -- parse', () => {
	test('V-01: path-absolute parse error becomes row 1 ERROR', () => {
		const err = parseExpectingError('airboss-ref:/regs/cfr-14/91/103?at=2026');
		const findings = validateIdentifier(null, ctx(NULL_REGISTRY), err);
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(1);
		expect(errors[0].message).toMatch(/path-absolute/);
	});

	test('V-01b: authority-based parse error becomes row 1 ERROR', () => {
		const err = parseExpectingError('airboss-ref://regs/cfr-14/91/103?at=2026');
		const findings = validateIdentifier(null, ctx(NULL_REGISTRY), err);
		expect(findings[0].ruleId).toBe(1);
		expect(findings[0].message).toMatch(/authority-based/);
	});
});

// ---------------------------------------------------------------------------
// Row 2 -- unresolved entry
// ---------------------------------------------------------------------------

describe('validator row 2 -- entry resolution', () => {
	test('V-02: identifier resolves to accepted entry => no row-2 finding', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.find((f) => f.ruleId === 2)).toBeUndefined();
		expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
	});

	test('V-02b: registry has corpus enumerated but no entry => row 2 ERROR fires', () => {
		// Use a fixture that knows the corpus but has no entry for the id.
		const parsed = parseOrThrow('airboss-ref:regs/cfr-14/91/103?at=2026');
		const reg = fixtureRegistry({ knownCorpora: new Set(['regs']) });
		const findings = validateIdentifier(parsed, ctx(reg));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(2);
	});

	test('V-02c: NULL_REGISTRY (no corpus enumerated) => row 1 ERROR fires (Phase 2 row-1 activation)', () => {
		const parsed = parseOrThrow('airboss-ref:regs/cfr-14/91/103?at=2026');
		const findings = validateIdentifier(parsed, ctx(NULL_REGISTRY));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(1);
		expect(errors[0].message).toMatch(/not enumerated/);
	});

	test('V-02d: unknown corpus prefix with productionRegistry-style isCorpusKnown=false => row 1 ERROR', () => {
		const parsed = parseOrThrow('airboss-ref:not-a-corpus/foo?at=2026');
		const reg = fixtureRegistry({ knownCorpora: new Set(['regs']) }); // not-a-corpus not enumerated
		const findings = validateIdentifier(parsed, ctx(reg));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(1);
		expect(errors[0].message).toMatch(/not-a-corpus/);
	});
});

// ---------------------------------------------------------------------------
// Row 3 -- pinned edition not in registry
// ---------------------------------------------------------------------------

describe('validator row 3 -- pinned edition exists', () => {
	test('V-03: registry has entry but no matching edition => row 3 fires (after row 2 if needed)', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2099';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) }, // pin 2099 not present
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(3);
		expect(errors[0].message).toMatch(/2099/);
	});
});

// ---------------------------------------------------------------------------
// Row 4 -- lifecycle blockers
// ---------------------------------------------------------------------------

describe('validator row 4 -- lifecycle', () => {
	test('V-04: pending entry => row 4 ERROR with "pending review"', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'pending') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(4);
		expect(errors[0].message).toMatch(/pending/);
	});

	test('V-04b: retired entry => row 4 ERROR with "retired"', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'retired') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings[0].ruleId).toBe(4);
		expect(findings[0].message).toMatch(/retired/);
	});

	test('V-04c: draft entry => row 4 ERROR with "draft"', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'draft') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings[0].ruleId).toBe(4);
		expect(findings[0].message).toMatch(/draft/);
	});
});

// ---------------------------------------------------------------------------
// Row 5 -- ?at=unpinned WARNING
// ---------------------------------------------------------------------------

describe('validator row 5 -- ?at=unpinned', () => {
	test('V-05: ?at=unpinned emits WARNING row 5 alongside an ERROR', () => {
		const parsed = parseOrThrow('airboss-ref:regs/cfr-14/91/103?at=unpinned');
		// Use a registry that knows the corpus so we exercise row 5 alongside
		// row 2 (entry-not-found), matching the "WARNING coexists with ERROR"
		// pattern. With NULL_REGISTRY post-Phase-2 we'd hit row 1 instead.
		const reg = fixtureRegistry({ knownCorpora: new Set(['regs']) });
		const findings = validateIdentifier(parsed, ctx(reg));
		const warnings = findings.filter((f) => f.severity === 'warning');
		expect(warnings.find((f) => f.ruleId === 5)).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Row 6 -- stale pin WARNING
// ---------------------------------------------------------------------------

describe('validator row 6 -- stale pin', () => {
	test('V-06: pin > 1 edition older than current accepted => WARNING row 6', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2024';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2024', '2025', '2026']) },
			currentAccepted: { regs: '2026' },
			editionDistance: { [id]: 2 },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.find((f) => f.ruleId === 6)).toBeDefined();
	});

	test('row 6 does not fire when distance is 0 or 1', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2025';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2025', '2026']) },
			currentAccepted: { regs: '2026' },
			editionDistance: { [id]: 1 },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.find((f) => f.ruleId === 6)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Row 7 -- empty link text
// ---------------------------------------------------------------------------

describe('validator row 7 -- empty link text', () => {
	test('V-07: empty link text emits ERROR row 7', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg, { raw: id, isBare: false, linkText: '', strippedText: '' }));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// Row 8 -- bare identifier in prose
// ---------------------------------------------------------------------------

describe('validator row 8 -- bare URL', () => {
	test('V-08: bare URL emits NOTICE row 8', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		// Registry knows `regs` so row 1 doesn't preempt the row-8 NOTICE.
		const reg = fixtureRegistry({ knownCorpora: new Set(['regs']) });
		const findings = validateIdentifier(
			parsed,
			ctx(reg, { raw: id, isBare: true, linkText: null, strippedText: null }),
		);
		expect(findings.find((f) => f.ruleId === 8 && f.severity === 'notice')).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Row 9 -- lazy link text
// ---------------------------------------------------------------------------

describe('validator row 9 -- lazy link text', () => {
	test('V-09: link text echoing canonical short form emits NOTICE row 9', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(
			parsed,
			ctx(reg, { raw: id, isBare: false, linkText: '§91.103', strippedText: '§91.103' }),
		);
		expect(findings.find((f) => f.ruleId === 9 && f.severity === 'notice')).toBeDefined();
	});

	test('row 9 does not fire when an @-token is present', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(
			parsed,
			ctx(reg, { raw: id, isBare: false, linkText: '@cite', strippedText: '@cite' }),
		);
		expect(findings.find((f) => f.ruleId === 9)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Rows 10-12 -- alias chain
// ---------------------------------------------------------------------------

describe('validator rows 10-12 -- alias chain', () => {
	test('V-10: silent alias auto-resolve emits no finding', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2024';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2024', '2026']) },
			currentAccepted: { regs: '2026' },
			aliases: {
				[id]: [{ from: id as SourceId, to: id as SourceId, kind: 'silent' }],
			},
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.find((f) => f.ruleId === 10 || f.ruleId === 11 || f.ruleId === 12)).toBeUndefined();
	});

	test('V-11: content-change alias emits WARNING row 11', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2024';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2024', '2026']) },
			currentAccepted: { regs: '2026' },
			aliases: {
				[id]: [{ from: id as SourceId, to: id as SourceId, kind: 'content-change' }],
			},
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.find((f) => f.ruleId === 11 && f.severity === 'warning')).toBeDefined();
	});

	test('V-12: cross-section alias emits ERROR row 12 and stops the walk', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2024';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2024', '2026']) },
			currentAccepted: { regs: '2026' },
			aliases: {
				[id]: [
					{ from: id as SourceId, to: id as SourceId, kind: 'cross-section' },
					// A subsequent content-change should NOT fire; row 12 stops the walk.
					{ from: id as SourceId, to: id as SourceId, kind: 'content-change' },
				],
			},
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		// row 2 and row 12 are both ERROR-tier. row 2 won't fire because the
		// entry exists; only row 12 should fire.
		expect(findings.filter((f) => f.severity === 'error').map((f) => f.ruleId)).toEqual([12]);
		expect(findings.find((f) => f.ruleId === 11)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Row 13 -- superseded without ack
// ---------------------------------------------------------------------------

describe('validator row 13 -- superseded without ack', () => {
	test('V-13: superseded entry with no ack => WARNING row 13', () => {
		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'superseded') },
			editions: { [id]: new Set([]) }, // pin-less corpus; row 3 doesn't fire
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.find((f) => f.ruleId === 13 && f.severity === 'warning')).toBeDefined();
	});

	test('row 13 does not fire when ack covers the target', () => {
		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'superseded') },
		});
		const acks: readonly LessonAcknowledgment[] = [
			{ target: id as SourceId, historical: false, reason: 'original-intact' },
		];
		const findings = validateIdentifier(parsed, ctx(reg, undefined, acks));
		expect(findings.find((f) => f.ruleId === 13)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Row 14 -- ack reason slug too long
// ---------------------------------------------------------------------------

describe('validator row 14 -- ack reason slug length', () => {
	test('V-14: reason slug 49+ chars => NOTICE row 14', () => {
		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
		});
		const longSlug = 'a'.repeat(49);
		const acks: readonly LessonAcknowledgment[] = [{ target: id as SourceId, historical: false, reason: longSlug }];
		const findings = validateIdentifier(parsed, ctx(reg, undefined, acks));
		expect(findings.find((f) => f.ruleId === 14 && f.severity === 'notice')).toBeDefined();
	});

	test('row 14 does not fire at 48 chars exactly', () => {
		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
		});
		const acks: readonly LessonAcknowledgment[] = [
			{ target: id as SourceId, historical: false, reason: 'a'.repeat(48) },
		];
		const findings = validateIdentifier(parsed, ctx(reg, undefined, acks));
		expect(findings.find((f) => f.ruleId === 14)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Exclusivity / ordering
// ---------------------------------------------------------------------------

describe('validator exactly-one-error + multi-finding ordering', () => {
	test('V-EX: row 2 ERROR + row 5 WARNING coexist on the same identifier', () => {
		const parsed = parseOrThrow('airboss-ref:regs/cfr-14/91/103?at=unpinned');
		const reg = fixtureRegistry({ knownCorpora: new Set(['regs']) });
		const findings = validateIdentifier(parsed, ctx(reg));
		const errors = findings.filter((f) => f.severity === 'error');
		const warnings = findings.filter((f) => f.severity === 'warning');
		expect(errors.map((f) => f.ruleId)).toEqual([2]);
		expect(warnings.map((f) => f.ruleId)).toContain(5);
	});

	test('V-EX2: identifier matching multiple ERROR rules emits only the first one', () => {
		// row 2 (entry not in registry) AND row 4 would apply if the entry were
		// pending, but since the registry has no entry, row 2 wins. Row 4 cannot
		// fire because it requires `entry !== null`. Use a registry that knows
		// `regs` so row 1 doesn't preempt.
		const parsed = parseOrThrow('airboss-ref:regs/cfr-14/91/103?at=2026');
		const reg = fixtureRegistry({ knownCorpora: new Set(['regs']) });
		const findings = validateIdentifier(parsed, ctx(reg));
		const errors = findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBe(1);
		expect(errors[0].ruleId).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// §1.5.1 edge cases
// ---------------------------------------------------------------------------

describe('§1.5.1 edge cases', () => {
	test('V-EDGE-1: future-pin (edition not in registry) => row 3 ERROR', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2099';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings[0].ruleId).toBe(3);
		expect(findings[0].severity).toBe('error');
	});

	test('V-EDGE-2: reserved section -> resolves normally; no special finding', () => {
		const id = 'airboss-ref:regs/cfr-14/91/149?at=2026';
		const parsed = parseOrThrow(id);
		const reservedEntry: SourceEntry = {
			...makeEntry(id, 'accepted'),
			canonical_title: '[Reserved]',
		};
		const reg = fixtureRegistry({
			entries: { [id]: reservedEntry },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
	});

	test('V-EDGE-3: newly-created section resolves normally', () => {
		const id = 'airboss-ref:regs/cfr-14/91/999?at=2026';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2026']) },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
	});

	test('V-EDGE-4: redacted section (NOTICE is render-time, not validator)', () => {
		const id = 'airboss-ref:ntsb/WPR23LA123/probable-cause';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		// Validator should not emit a redaction finding; that's Phase 4.
		expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
	});

	test('V-EDGE-5: stale-branch CI rerun -> row 6 WARNING; non-blocking', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103?at=2024';
		const parsed = parseOrThrow(id);
		const reg = fixtureRegistry({
			entries: { [id]: makeEntry(id, 'accepted') },
			editions: { [id]: new Set(['2024', '2026', '2027']) },
			currentAccepted: { regs: '2027' },
			editionDistance: { [id]: 3 },
		});
		const findings = validateIdentifier(parsed, ctx(reg));
		expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
		expect(findings.find((f) => f.ruleId === 6 && f.severity === 'warning')).toBeDefined();
	});
});

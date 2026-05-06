/**
 * Unit tests for the knowledge-graph reference parser introduced by ADR 019
 * amendment 2026-05 step 4.
 *
 * Covers:
 *
 * - Legacy `{source, detail, note}` citations parse and emit a per-entry
 *   WARNING with the canonical `legacy-citation-shape` code.
 * - Structured `{ref, ...sentinels, quote?, note?}` citations parse, attach
 *   sentinel field-name validation, and reject unknown sentinel keys with
 *   ERROR (typo defense per amendment D1).
 * - Locator-precision detection routes `?page=`, `?paragraph=`, and the
 *   sibling `quote:` field to `'edition-sensitive'`; everything else maps to
 *   `'doc-or-chapter-level'`.
 * - The on-disk JSONB serializer strips the internal `shape` discriminator
 *   so the column round-trips through the existing `Citation` union.
 *
 * The validator-side wiring (per-citation findings flowing through the
 * build-knowledge pipeline) is exercised end-to-end by running
 * `bun scripts/build-knowledge-index.ts --dry-run` against the live
 * `course/knowledge/` corpus; that path is hermetic enough that a separate
 * harness here would be redundant.
 */

import { describe, expect, it } from 'vitest';
import { __test__ } from './build-knowledge-index';

const { asReferenceArray, computeLocatorPrecision, serializeReferenceForDb, LEGACY_CITATION_WARNING_CODE } = __test__;

describe('asReferenceArray', () => {
	it('parses a legacy citation and emits the legacy-shape WARNING', () => {
		const result = asReferenceArray([
			{
				source: 'AFH (FAA-H-8083-3B)',
				detail: 'Chapter 3 -- Basic Flight Maneuvers',
				note: 'Practical interpretation.',
			},
		]);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		const warning = result.warnings[0];
		expect(warning).toBeDefined();
		if (warning === undefined) return;
		expect(warning).toContain(LEGACY_CITATION_WARNING_CODE);
		expect(warning).toContain('references[0]');
		expect(result.references).toHaveLength(1);
		const parsed = result.references[0];
		expect(parsed).toBeDefined();
		if (parsed === undefined) return;
		expect(parsed.shape).toBe('legacy');
		if (parsed.shape !== 'legacy') return;
		expect(parsed.source).toBe('AFH (FAA-H-8083-3B)');
		expect(parsed.detail).toBe('Chapter 3 -- Basic Flight Maneuvers');
		expect(parsed.note).toBe('Practical interpretation.');
	});

	it('parses a structured citation with chapter_title sentinel', () => {
		const result = asReferenceArray([
			{
				ref: 'airboss-ref:handbooks/afh/3',
				chapter_title: 'Basic Flight Maneuvers',
				note: 'Practical flight interpretation of the four forces.',
			},
		]);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
		expect(result.references).toHaveLength(1);
		const parsed = result.references[0];
		expect(parsed).toBeDefined();
		if (parsed === undefined) return;
		expect(parsed.shape).toBe('ref');
		if (parsed.shape !== 'ref') return;
		expect(parsed.ref).toBe('airboss-ref:handbooks/afh/3');
		expect(parsed.sentinels).toEqual([{ field: 'chapter_title', expected: 'Basic Flight Maneuvers' }]);
		expect(parsed.quote).toBeNull();
		expect(parsed.note).toBe('Practical flight interpretation of the four forces.');
	});

	it('rejects unknown sentinel field names with ERROR (typo defense)', () => {
		const result = asReferenceArray([
			{
				ref: 'airboss-ref:handbooks/afh/3',
				chapter_titel: 'Basic Flight Maneuvers',
			},
		]);
		expect(result.warnings).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		const message = result.errors[0];
		expect(message).toBeDefined();
		if (message === undefined) return;
		expect(message).toContain('chapter_titel');
		expect(message).toContain('allowed:');
	});

	it('rejects entries that set both ref and source', () => {
		const result = asReferenceArray([
			{
				ref: 'airboss-ref:handbooks/afh/3',
				source: 'AFH',
			},
		]);
		expect(result.errors).toHaveLength(1);
		const message = result.errors[0];
		expect(message).toBeDefined();
		if (message === undefined) return;
		expect(message).toContain("cannot set both 'ref'");
	});

	it('rejects entries missing both discriminators', () => {
		const result = asReferenceArray([{ note: 'orphan note' }]);
		expect(result.errors).toHaveLength(1);
		const message = result.errors[0];
		expect(message).toBeDefined();
		if (message === undefined) return;
		expect(message).toContain('missing required citation discriminator');
	});

	it('returns empty arrays on a missing references field', () => {
		const result = asReferenceArray(undefined);
		expect(result.references).toEqual([]);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	it('emits ERROR when references is not an array', () => {
		const result = asReferenceArray({ ref: 'airboss-ref:handbooks/afh/3' });
		expect(result.errors).toEqual(["'references' must be an array"]);
	});

	it('captures multiple sentinels on one citation', () => {
		const result = asReferenceArray([
			{
				ref: 'airboss-ref:handbooks/afh/3/2',
				chapter_title: 'Basic Flight Maneuvers',
				section_title: 'Climbs',
			},
		]);
		expect(result.errors).toHaveLength(0);
		const parsed = result.references[0];
		expect(parsed).toBeDefined();
		if (parsed === undefined) return;
		if (parsed.shape !== 'ref') return;
		expect(parsed.sentinels).toEqual([
			{ field: 'chapter_title', expected: 'Basic Flight Maneuvers' },
			{ field: 'section_title', expected: 'Climbs' },
		]);
	});
});

describe('computeLocatorPrecision', () => {
	it('returns doc-or-chapter-level for chapter-level URIs without precision flags', () => {
		expect(
			computeLocatorPrecision({
				shape: 'ref',
				ref: 'airboss-ref:handbooks/afh/3',
				sentinels: [],
				quote: null,
				note: '',
			}),
		).toBe('doc-or-chapter-level');
	});

	it('returns edition-sensitive when ?page= is present', () => {
		expect(
			computeLocatorPrecision({
				shape: 'ref',
				ref: 'airboss-ref:handbooks/afh/3?page=12',
				sentinels: [],
				quote: null,
				note: '',
			}),
		).toBe('edition-sensitive');
	});

	it('returns edition-sensitive when ?paragraph= is present', () => {
		expect(
			computeLocatorPrecision({
				shape: 'ref',
				ref: 'airboss-ref:regs/14cfr91/91.103?paragraph=a',
				sentinels: [],
				quote: null,
				note: '',
			}),
		).toBe('edition-sensitive');
	});

	it('returns edition-sensitive when a quote is captured', () => {
		expect(
			computeLocatorPrecision({
				shape: 'ref',
				ref: 'airboss-ref:handbooks/afh/3',
				sentinels: [],
				quote: 'verbatim text',
				note: '',
			}),
		).toBe('edition-sensitive');
	});
});

describe('serializeReferenceForDb', () => {
	it('serialises a legacy citation without leaking the discriminator', () => {
		expect(
			serializeReferenceForDb({
				shape: 'legacy',
				source: 'AFH (FAA-H-8083-3B)',
				detail: 'Chapter 3 -- Basic Flight Maneuvers',
				note: 'practical commentary',
			}),
		).toEqual({
			source: 'AFH (FAA-H-8083-3B)',
			detail: 'Chapter 3 -- Basic Flight Maneuvers',
			note: 'practical commentary',
		});
	});

	it('serialises a structured citation flat with sentinel fields', () => {
		expect(
			serializeReferenceForDb({
				shape: 'ref',
				ref: 'airboss-ref:handbooks/afh/3',
				sentinels: [{ field: 'chapter_title', expected: 'Basic Flight Maneuvers' }],
				quote: null,
				note: 'contextual note',
			}),
		).toEqual({
			ref: 'airboss-ref:handbooks/afh/3',
			chapter_title: 'Basic Flight Maneuvers',
			note: 'contextual note',
		});
	});

	it('omits empty quote and note in the serialised shape', () => {
		expect(
			serializeReferenceForDb({
				shape: 'ref',
				ref: 'airboss-ref:handbooks/afh/3',
				sentinels: [],
				quote: null,
				note: '',
			}),
		).toEqual({ ref: 'airboss-ref:handbooks/afh/3' });
	});

	it('preserves a populated quote field', () => {
		expect(
			serializeReferenceForDb({
				shape: 'ref',
				ref: 'airboss-ref:handbooks/afh/3?at=8083-3C',
				sentinels: [],
				quote: 'lift equals weight in steady flight',
				note: '',
			}),
		).toEqual({
			ref: 'airboss-ref:handbooks/afh/3?at=8083-3C',
			quote: 'lift equals weight in steady flight',
		});
	});
});

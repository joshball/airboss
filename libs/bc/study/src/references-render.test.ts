/**
 * Pure-function tests for {@link resolveCitationsForRender} -- the citation
 * renderer-resolution helper introduced by ADR 019 amendment 2026-05 step 5.
 *
 * The bug this fixes: the knowledge-node `/reference/knowledge/<id>` page was
 * rendering the literal string `"Handbook"` (the `kind` family label) where
 * it should have rendered `"Airplane Flying Handbook"` (the registry's
 * `reference.title`). The renderer now reads through this resolver, which
 * looks up the registry row and returns its `title`/`edition`.
 *
 * No DB. The function takes the reference table as input.
 */

import { REFERENCE_KINDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { resolveCitationsForRender } from './references';
import type { ReferenceRow } from './schema';

const NOW = new Date('2026-05-06T00:00:00Z');

function buildReferenceRow(overrides: Partial<ReferenceRow> = {}): ReferenceRow {
	const base: ReferenceRow = {
		id: 'ref_test',
		kind: REFERENCE_KINDS.HANDBOOK,
		documentSlug: 'afh',
		edition: 'FAA-H-8083-3C',
		title: 'Airplane Flying Handbook',
		publisher: 'FAA',
		url: null,
		subjects: [],
		primaryCert: null,
		sectionSchema: {},
		metadata: {},
		supersededById: null,
		seedOrigin: null,
		createdAt: NOW,
		updatedAt: NOW,
	};
	return { ...base, ...overrides };
}

describe('resolveCitationsForRender (ADR 019 amendment 2026-05 step 5)', () => {
	it('resolves a new ref-shape AFH chapter citation to the registry title', () => {
		// The bug case from the amendment doc: the AFH citation rendered
		// "Handbook" instead of "Airplane Flying Handbook".
		const refs: ReferenceRow[] = [
			buildReferenceRow({
				id: 'ref_afh_3c',
				documentSlug: 'afh',
				edition: 'FAA-H-8083-3C',
				title: 'Airplane Flying Handbook',
			}),
		];
		const resolved = resolveCitationsForRender(
			[
				{
					ref: 'airboss-ref:handbooks/afh/3',
					chapter_title: 'Basic Flight Maneuvers',
					note: 'Practical flight interpretation of the four forces.',
				},
			],
			refs,
		);

		expect(resolved).toHaveLength(1);
		const [first] = resolved;
		expect(first).toBeDefined();
		if (!first) return;
		// THE LOAD-BEARING ASSERTION: title is the registry's `Airplane Flying
		// Handbook`, NOT the kind-family label `Handbook`.
		expect(first.title).toBe('Airplane Flying Handbook');
		expect(first.title).not.toBe('Handbook');
		expect(first.edition).toBe('FAA-H-8083-3C');
		expect(first.kind).toBe(REFERENCE_KINDS.HANDBOOK);
		expect(first.locatorLabel).toBe('Basic Flight Maneuvers');
		expect(first.note).toBe('Practical flight interpretation of the four forces.');
		expect(first.broken).toBe(false);
		expect(first.isPriorEdition).toBe(false);
		expect(first.pinnedEditionSlug).toBeNull();
	});

	it('resolves an unpinned PHAK citation to the current edition title', () => {
		const refs: ReferenceRow[] = [
			buildReferenceRow({
				id: 'ref_phak_25c',
				documentSlug: 'phak',
				edition: 'FAA-H-8083-25C',
				title: "Pilot's Handbook of Aeronautical Knowledge",
			}),
		];
		const [resolved] = resolveCitationsForRender(
			[{ ref: 'airboss-ref:handbooks/phak/5', chapter_title: 'Aerodynamics of Flight' }],
			refs,
		);
		expect(resolved?.title).toBe("Pilot's Handbook of Aeronautical Knowledge");
		expect(resolved?.edition).toBe('FAA-H-8083-25C');
	});

	it('flags a pinned-prior-edition citation with isPriorEdition + pinnedEditionSlug', () => {
		const refs: ReferenceRow[] = [
			buildReferenceRow({
				id: 'ref_afh_3b',
				documentSlug: 'afh',
				edition: 'FAA-H-8083-3B',
				title: 'Airplane Flying Handbook',
				supersededById: 'ref_afh_3c',
			}),
			buildReferenceRow({
				id: 'ref_afh_3c',
				documentSlug: 'afh',
				edition: 'FAA-H-8083-3C',
				title: 'Airplane Flying Handbook',
			}),
		];
		const [resolved] = resolveCitationsForRender(
			[{ ref: 'airboss-ref:handbooks/afh/FAA-H-8083-3B/3', chapter_title: 'Basic Flight Maneuvers' }],
			refs,
		);
		expect(resolved?.title).toBe('Airplane Flying Handbook');
		expect(resolved?.edition).toBe('FAA-H-8083-3B');
		expect(resolved?.isPriorEdition).toBe(true);
		expect(resolved?.pinnedEditionSlug).toBe('FAA-H-8083-3B');
	});

	it('renders an unknown handbook slug as broken', () => {
		const [resolved] = resolveCitationsForRender([{ ref: 'airboss-ref:handbooks/nonesuch/3' }], []);
		expect(resolved?.broken).toBe(true);
		expect(resolved?.title).toBe('');
	});

	it('preserves legacy freeform citations verbatim (source -> title)', () => {
		const [resolved] = resolveCitationsForRender(
			[{ source: 'AFH (FAA-H-8083-3B)', detail: 'Chapter 3 -- Basic Flight Maneuvers', note: 'note text' }],
			[],
		);
		expect(resolved?.kind).toBeNull();
		expect(resolved?.title).toBe('AFH (FAA-H-8083-3B)');
		expect(resolved?.locatorLabel).toBe('Chapter 3 -- Basic Flight Maneuvers');
		expect(resolved?.note).toBe('note text');
	});

	it('preserves redirected_from from the structured citation through to the resolved shape', () => {
		const refs: ReferenceRow[] = [
			buildReferenceRow({
				id: 'ref_afh_3c',
				documentSlug: 'afh',
				edition: 'FAA-H-8083-3C',
				title: 'Airplane Flying Handbook',
			}),
		];
		const [resolved] = resolveCitationsForRender(
			[
				{
					ref: 'airboss-ref:handbooks/afh/4',
					chapter_title: 'Energy Management: Mastering Altitude and Airspeed Control',
					redirected_from: 'airboss-ref:handbooks/afh/FAA-H-8083-3B/4',
					note: 'Practical stall recognition and recovery, accelerated stall.',
				},
			],
			refs,
		);
		expect(resolved?.redirectedFrom).toBe('airboss-ref:handbooks/afh/FAA-H-8083-3B/4');
		expect(resolved?.title).toBe('Airplane Flying Handbook');
		expect(resolved?.locatorLabel).toBe('Energy Management: Mastering Altitude and Airspeed Control');
	});

	it('returns redirectedFrom=null when the structured citation omits the field', () => {
		const refs: ReferenceRow[] = [
			buildReferenceRow({
				id: 'ref_afh_3c',
				documentSlug: 'afh',
				edition: 'FAA-H-8083-3C',
				title: 'Airplane Flying Handbook',
			}),
		];
		const [resolved] = resolveCitationsForRender(
			[{ ref: 'airboss-ref:handbooks/afh/3', chapter_title: 'Basic Flight Maneuvers' }],
			refs,
		);
		expect(resolved?.redirectedFrom).toBeNull();
	});

	it('returns redirectedFrom=null on legacy freeform citations', () => {
		const [resolved] = resolveCitationsForRender(
			[{ source: 'AFH (FAA-H-8083-3B)', detail: 'Chapter 3 -- Basic Flight Maneuvers' }],
			[],
		);
		expect(resolved?.redirectedFrom).toBeNull();
	});

	it('resolves the in-type structured handbook shape via reference_id', () => {
		const refs: ReferenceRow[] = [
			buildReferenceRow({
				id: 'ref_phak_25c',
				documentSlug: 'phak',
				edition: 'FAA-H-8083-25C',
				title: "Pilot's Handbook of Aeronautical Knowledge",
			}),
		];
		const [resolved] = resolveCitationsForRender(
			[
				{
					kind: REFERENCE_KINDS.HANDBOOK,
					reference_id: 'ref_phak_25c',
					locator: { chapter: 5, section: 2 },
					note: 'lift section',
				},
			],
			refs,
		);
		expect(resolved?.title).toBe("Pilot's Handbook of Aeronautical Knowledge");
		expect(resolved?.locatorLabel).toBe('Ch. 5 §2');
		expect(resolved?.broken).toBe(false);
	});
});

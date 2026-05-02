/**
 * Round-trip + byte-identity tests for the TOML codec.
 *
 * Guarantees:
 *   - decode(encode(x)) deep-equals x for every `Reference` in `aviation.ts`
 *     and a representative `Source[]` fixture covering every format.
 *   - encode(decode(encode(x))) === encode(x) -- idempotent after the first
 *     normalization pass. That's the byte-identity property hangar relies
 *     on to produce minimal diffs.
 */

import { describe, expect, it } from 'vitest';
import { AVIATION_REFERENCES } from './references/aviation';
import type { Reference } from './schema/reference';
import type { Source } from './schema/source';
import { decodeReferences, decodeSources, encodeReferences, encodeSources } from './toml-codec';

const SOURCE_FIXTURES: readonly Source[] = [
	{
		id: 'cfr-14',
		type: 'cfr',
		title: '14 CFR - Aeronautics and Space',
		version: 'revised-2026-01-01',
		downloadedAt: 'pending-download',
		format: 'xml',
		path: '/abs/path/cfr/cfr-14.xml',
		url: 'https://www.govinfo.gov/bulkdata/CFR/2026/title-14/CFR-2026-title14.xml',
		checksum: 'pending-download',
	},
	{
		id: 'aim-current',
		type: 'aim',
		title: 'FAA Aeronautical Information Manual',
		version: '2026-01',
		downloadedAt: 'pending-download',
		format: 'pdf',
		path: '/abs/path/aim/aim-current.pdf',
		url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
		checksum: 'pending-download',
	},
	{
		id: 'faa-safety',
		type: 'faa-safety',
		title: 'FAASTeam',
		version: '2026-01',
		downloadedAt: 'pending-download',
		format: 'html',
		path: '/abs/path/faa-safety/faa-safety.html',
		url: 'https://www.faasafety.gov/',
		checksum: 'pending-download',
	},
];

function normalizeReference(ref: Reference): Reference {
	return {
		id: ref.id,
		displayName: ref.displayName,
		aliases: [...ref.aliases],
		paraphrase: ref.paraphrase,
		tags: ref.tags,
		sources: ref.sources.map((c) => ({
			sourceId: c.sourceId,
			locator: { ...c.locator },
			...(c.url !== undefined ? { url: c.url } : {}),
		})),
		related: [...ref.related],
		...(ref.author !== undefined ? { author: ref.author } : {}),
		...(ref.reviewedAt !== undefined ? { reviewedAt: ref.reviewedAt } : {}),
		...(ref.verbatim !== undefined ? { verbatim: { ...ref.verbatim } } : {}),
	};
}

function sortedById<T extends { id: string }>(items: readonly T[]): T[] {
	return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

describe('toml-codec references', () => {
	it('round-trips the full AVIATION_REFERENCES array', () => {
		const encoded = encodeReferences(AVIATION_REFERENCES);
		const decoded = decodeReferences(encoded);
		expect(decoded.length).toBe(AVIATION_REFERENCES.length);
		const original = sortedById(AVIATION_REFERENCES).map(normalizeReference);
		const roundTripped = [...decoded].map(normalizeReference);
		expect(roundTripped).toEqual(original);
	});

	it('is byte-identical after the first encode', () => {
		const first = encodeReferences(AVIATION_REFERENCES);
		const second = encodeReferences(decodeReferences(first));
		expect(second).toBe(first);
	});

	it('emits deterministic output for a golden subset', () => {
		const subset: Reference[] = [
			{
				id: 'zeta',
				displayName: 'Zeta',
				aliases: [],
				paraphrase: 'Alpha line.\nBeta line.',
				tags: {
					sourceType: 'cfr',
					aviationTopic: ['aerodynamics'],
					flightRules: 'vfr',
					knowledgeKind: 'definition',
				},
				sources: [],
				related: [],
			},
			{
				id: 'alpha',
				displayName: 'Alpha',
				aliases: ['a'],
				paraphrase: 'A.',
				tags: {
					sourceType: 'aim',
					aviationTopic: ['navigation'],
					flightRules: 'ifr',
					knowledgeKind: 'procedure',
					phaseOfFlight: ['enroute'],
				},
				sources: [
					{
						sourceId: 'aim-current',
						locator: { chapter: 5, section: 1, paragraph: 1 },
						url: 'https://example.org/aim',
					},
				],
				related: ['zeta'],
			},
		];
		const out = encodeReferences(subset);
		// Sorted by id: alpha first.
		expect(out.indexOf('id = "alpha"')).toBeLessThan(out.indexOf('id = "zeta"'));
		// Deterministic tag key order: sourceType before flightRules.
		expect(out.indexOf('tags.sourceType')).toBeLessThan(out.indexOf('tags.flightRules'));
	});
});

describe('toml-codec sources', () => {
	it('round-trips the source fixture array', () => {
		const encoded = encodeSources(SOURCE_FIXTURES);
		const decoded = decodeSources(encoded);
		expect(decoded.length).toBe(SOURCE_FIXTURES.length);
		const original: Source[] = sortedById(SOURCE_FIXTURES).map((s) => ({ ...s }));
		const roundTripped: Source[] = [...decoded].map((s) => ({ ...s }));
		expect(roundTripped).toEqual(original);
	});

	it('is byte-identical after the first encode', () => {
		const first = encodeSources(SOURCE_FIXTURES);
		const second = encodeSources(decodeSources(first));
		expect(second).toBe(first);
	});

	it('round-trips a sectional (geotiff-zip) source byte-identically', () => {
		const sectional: Source = {
			id: 'sectional-denver',
			type: 'sectional',
			title: 'Denver VFR Sectional Chart',
			version: 'pending-download',
			format: 'geotiff-zip',
			path: 'sectional/sectional-denver',
			url: 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/Denver.zip',
			checksum: 'pending-download',
			downloadedAt: 'pending-download',
		};
		const encoded = encodeSources([sectional]);
		const decoded = decodeSources(encoded);
		expect(decoded).toHaveLength(1);
		expect(decoded[0]).toEqual(sectional);
		// Idempotent.
		expect(encodeSources(decoded)).toBe(encoded);
	});
});

/**
 * Cluster bond contract -- handbook + CFR root rows from the aviation
 * registry must agree with chapter/section row `clusterKey` shape so
 * `buildClusters` actually forms clusters in production.
 *
 * Why this matters: handbook roots are aviation registry refs with id like
 * `doc-faah808325c` and sourceType `phak`. Chapters come from the DB via
 * `loadHandbookSections` and set `clusterKey: documentSlug` (e.g. `phak`).
 * If the two sides disagree the cluster never forms -- a real bug that
 * shipped once (correctness C2 in 2026-05-11 review).
 */

import { describe, expect, test } from 'vitest';
// Side-effect import to register AVIATION_TOPIC / FAA / AIM references.
import '@ab/aviation';
import { loadAviationRefs } from '../loaders/aviation-refs';
import { parseQuery } from '../query-parser';
import type { PaletteHost } from '../schema/result-types';

const HOST: PaletteHost = { surface: 'global', userId: undefined };

describe('cluster-bond contract', () => {
	test('handbook root rows expose a `clusterKey` matching the seeder documentSlug', () => {
		// Query the aviation registry for PHAK; the root row must carry a
		// clusterKey that matches the handbook seeder's documentSlug ('phak').
		const out = loadAviationRefs(parseQuery('PHAK'), HOST);
		const phak = out.find((r) => r.type === 'faa.handbook' && r.id === 'doc-faah808325c');
		expect(phak).toBeDefined();
		expect(phak?.clusterKey).toBe('phak');
	});

	test('CFR Part root rows expose a `clusterKey` matching the seeder documentSlug', () => {
		// Query for 14 CFR Part 91; the root must carry clusterKey '14cfr91'
		// matching the CFR seeder convention.
		const out = loadAviationRefs(parseQuery('Part 91'), HOST);
		const part91 = out.find((r) => r.type === 'faa.cfr.part' && r.id === 'doc-cfr-14-91');
		expect(part91).toBeDefined();
		expect(part91?.clusterKey).toBe('14cfr91');
	});

	test('AvWX handbook clusterKey matches the avwx documentSlug', () => {
		const out = loadAviationRefs(parseQuery('FAA-H-8083-28'), HOST);
		const avwx = out.find((r) => r.type === 'faa.handbook' && r.id === 'doc-faah808328b');
		expect(avwx).toBeDefined();
		expect(avwx?.clusterKey).toBe('avwx');
	});
});

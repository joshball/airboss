/**
 * Library-by-cert orphan check.
 *
 * THE most important test in Wave 4: every active reference row must reach
 * a learner via at least one library spine. The library has four spines:
 *
 *   1. Cert spine (`/library/cert/[cert]`)         -- ref.primaryCert is set
 *   2. Topic spine (`/library/topic/[topic]`)      -- ref.subjects has >=1 entry
 *   3. Regulations spine (`/library/regulations`)  -- kind is cfr/ac/aim/pcg/ntsb
 *   4. Aircraft spine (`/library/aircraft/[slug]`) -- kind is poh
 *
 * If a row falls through all four, learners cannot reach it from the
 * library navigation. This guard catches future references that are added
 * with no primary_cert AND no subjects AND a non-regulations / non-poh
 * kind. Such a row exists only as data; the UI never surfaces it.
 *
 * Aligned with the regulationsBucketMatcher in
 * `apps/study/src/routes/(app)/library/+page.server.ts` -- if the
 * regulations spine ever expands its kind set, update this test in lockstep.
 */

import { REFERENCE_KINDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { listReferences } from './references';

const REGULATIONS_SPINE_KINDS: ReadonlySet<string> = new Set([
	REFERENCE_KINDS.CFR,
	REFERENCE_KINDS.AC,
	REFERENCE_KINDS.AIM,
	REFERENCE_KINDS.PCG,
	REFERENCE_KINDS.NTSB,
]);

const AIRCRAFT_SPINE_KIND: string = REFERENCE_KINDS.POH;

describe('library-by-cert: orphan check', () => {
	it('every active reference is reachable via at least one library spine', async () => {
		const refs = await listReferences();

		const orphans: string[] = [];
		for (const ref of refs) {
			const inCertSpine = ref.primaryCert !== null;
			const inTopicSpine = (ref.subjects as readonly string[]).length > 0;
			const inRegulationsSpine = REGULATIONS_SPINE_KINDS.has(ref.kind);
			const inAircraftSpine = ref.kind === AIRCRAFT_SPINE_KIND;
			if (!inCertSpine && !inTopicSpine && !inRegulationsSpine && !inAircraftSpine) {
				orphans.push(`${ref.documentSlug}@${ref.edition} (kind=${ref.kind})`);
			}
		}

		expect(orphans, `Orphaned references (no spine):\n${orphans.join('\n')}`).toEqual([]);
	});
});

/**
 * SAFO manifest seed adapter (WP-SAFO-INFO).
 *
 * Thin dispatcher into the shared bulletin seeder. SAFOs and InFOs share an
 * identical pipeline shape; the only difference is the registry lookup and
 * a few labels. See `bulletin.ts` for the full seeding logic.
 */

import { REFERENCE_KINDS } from '@ab/constants';
import { getSafoSeedMapping } from '@ab/sources/safo';
import type { SafoManifest } from '../manifest-validation';
import { seedBulletinManifest } from './bulletin';
import type { SeedContext, SeedSummary } from './types';

export async function seedSafoManifest(
	manifest: SafoManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	return seedBulletinManifest(
		manifest,
		{
			referenceKind: REFERENCE_KINDS.SAFO,
			editionLabel: `SAFO ${manifest.bulletin_id}`,
			lookupMapping: getSafoSeedMapping,
			corpusLabel: 'SAFO',
		},
		context,
		summary,
	);
}

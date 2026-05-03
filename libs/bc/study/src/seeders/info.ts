/**
 * InFO manifest seed adapter (WP-SAFO-INFO).
 *
 * Thin dispatcher into the shared bulletin seeder. SAFOs and InFOs share an
 * identical pipeline shape; the only difference is the registry lookup and
 * a few labels. See `bulletin.ts` for the full seeding logic.
 */

import { REFERENCE_KINDS } from '@ab/constants';
import { getInfoSeedMapping } from '@ab/sources/info';
import type { InfoManifest } from '../manifest-validation';
import { seedBulletinManifest } from './bulletin';
import type { SeedContext, SeedSummary } from './types';

export async function seedInfoManifest(
	manifest: InfoManifest,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	return seedBulletinManifest(
		manifest,
		{
			referenceKind: REFERENCE_KINDS.INFO,
			editionLabel: `InFO ${manifest.bulletin_id}`,
			lookupMapping: getInfoSeedMapping,
			corpusLabel: 'InFO',
		},
		context,
		summary,
	);
}

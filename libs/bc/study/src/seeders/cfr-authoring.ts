/**
 * CFR per-Part authoring overlay loader.
 *
 * Hand-authored description / why-it-matters / scope copy for the priority
 * Parts (Wave 1: 91, 61, 135, 141, ...) lives in
 * `regulations/cfr-{14,49}/_authoring/parts.yaml`. The CFR seeder reads
 * this file once per Title and merges each Part's overlay into
 * `reference.metadata` alongside the manifest-derived `officialTitle`.
 *
 * Merge precedence (per WP-CFR Wave 1 spec):
 *
 *   - `officialTitle` -- manifest wins (it comes from eCFR XML <HEAD>,
 *     which is authoritative).
 *   - `description`, `whyItMatters`, `scope` -- authoring YAML wins
 *     (manifest doesn't carry these fields).
 *
 * Long-tail Parts without an authored entry get `officialTitle` only;
 * the audit page surfaces the missing description / whyItMatters as a
 * recommended-field gap.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const partOverlaySchema = z.object({
	description: z.string().min(1).optional(),
	whyItMatters: z.string().min(1).optional(),
	scope: z.string().min(1).optional(),
});
export type CfrPartOverlay = z.infer<typeof partOverlaySchema>;

const authoringFileSchema = z.object({
	parts: z.record(z.string(), partOverlaySchema),
});

/**
 * Load the per-Part authoring overlays for one CFR Title. Returns an
 * empty map when the file is missing -- the seeder treats this as a
 * non-error so a freshly-cloned repo without the YAML still seeds.
 */
export async function loadCfrPartAuthoring(authoringFilePath: string): Promise<Record<string, CfrPartOverlay>> {
	if (!existsSync(authoringFilePath)) return {};
	const raw = await readFile(authoringFilePath, 'utf-8');
	const parsed = parseYaml(raw) as unknown;
	const validated = authoringFileSchema.parse(parsed);
	return validated.parts;
}

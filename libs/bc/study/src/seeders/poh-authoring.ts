/**
 * POH/AFM per-aircraft authoring overlay loader.
 *
 * Hand-authored manufacturer / revision / why-it-matters / topic copy for
 * the per-aircraft POH references lives in
 * `aircraft/_authoring/poh.yaml`. The reference seed reads this file once
 * per run and merges each entry's overlay into `reference.metadata` for
 * the matching `(documentSlug, kind = poh)` row.
 *
 * Merge precedence: title / publisher / url come from
 * `course/references/poh.yaml` (the bibliographic record); description,
 * whyItMatters, manufacturer, revisionDate, applicableSerialNumbers, and
 * topics come from this overlay.
 *
 * Mirrors `cfr-authoring.ts` -- same `existsSync` early-return, same Zod
 * validation against `AVIATION_TOPIC_VALUES`, same all-or-nothing-fail-loud
 * shape so authoring typos surface during seed rather than as silent data
 * gaps in the audit page.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { AVIATION_TOPIC_MAX, AVIATION_TOPIC_VALUES, type AviationTopic } from '@ab/constants';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const aviationTopicEnum = z.enum(AVIATION_TOPIC_VALUES as readonly [AviationTopic, ...AviationTopic[]]);

const aircraftOverlaySchema = z.object({
	aircraftModel: z.string().min(1),
	manufacturer: z.string().min(1),
	revision: z.string().min(1),
	revisionDate: z.string().min(1).optional(),
	applicableSerialNumbers: z.string().min(1).optional(),
	description: z.string().min(1),
	whyItMatters: z.string().min(1),
	topics: z.array(aviationTopicEnum).min(1).max(AVIATION_TOPIC_MAX),
});
export type PohOverlay = z.infer<typeof aircraftOverlaySchema>;

const authoringFileSchema = z.object({
	aircraft: z.record(z.string(), aircraftOverlaySchema),
});

/**
 * Load the per-aircraft POH authoring overlays. Returns an empty map when
 * the file is missing -- the seeder treats this as a non-error so a fresh
 * clone (no `aircraft/_authoring/` yet) still seeds the bibliographic rows
 * and the audit page surfaces the missing fields as recommended-field
 * gaps.
 */
export async function loadPohAuthoring(authoringFilePath: string): Promise<Record<string, PohOverlay>> {
	if (!existsSync(authoringFilePath)) return {};
	const raw = await readFile(authoringFilePath, 'utf-8');
	const parsed = parseYaml(raw) as unknown;
	const validated = authoringFileSchema.parse(parsed);
	return validated.aircraft;
}

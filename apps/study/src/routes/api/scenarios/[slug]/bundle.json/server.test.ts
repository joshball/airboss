/**
 * Tests for `GET /api/scenarios/[slug]/bundle.json`.
 *
 * Covers four route behaviours:
 *
 * 1. Happy path -- a registered scenario slug returns the full bundle
 *    (truth + commentary + product files) as JSON.
 * 2. Unknown slug -- a slug not in `WX_SCENARIO_VALUES` 400s before any
 *    fs work.
 * 3. Missing bundle -- a registered slug whose `truth.json` does not exist
 *    on disk 404s.
 * 4. Cache-control header is present on success.
 *
 * Uses real fs against the repo's committed scenario bundle. The
 * happy-path fixture is `frontal-xc-march`, which is checked into
 * `data/wx-scenarios/`.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { GET, type ScenarioBundle } from './+server';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/api/scenarios/[slug]/bundle.json -> repo root is
// seven levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..');
const FIXTURE_SLUG = 'frontal-xc-march';
const FIXTURE_TRUTH_PATH = resolve(REPO_ROOT, 'data/wx-scenarios', FIXTURE_SLUG, 'truth.json');

interface FakeEvent {
	params: { slug: string };
	locals: { requestId: string; user: null };
}

function makeEvent(slug: string): FakeEvent {
	return { params: { slug }, locals: { requestId: 'test-req', user: null } };
}

function isHttp(value: unknown, status: number): boolean {
	return isHttpError(value) && value.status === status;
}

describe('GET /api/scenarios/[slug]/bundle.json', () => {
	it('returns the full bundle for a registered scenario slug', async () => {
		if (!existsSync(FIXTURE_TRUTH_PATH)) {
			// Bundle artefacts not present in this checkout. Mirrors the
			// charts-route fixture-tolerance pattern.
			return;
		}

		const response = await GET(makeEvent(FIXTURE_SLUG) as unknown as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toMatch(/application\/json/);
		expect(response.headers.get('Cache-Control')).toMatch(/max-age=\d+/);

		const bundle = (await response.json()) as ScenarioBundle;
		expect(bundle.scenarioId).toBe(FIXTURE_SLUG);
		expect(bundle.truth).not.toBeNull();
		expect(bundle.products).toMatchObject({ 'metars.json': expect.anything() });
	});

	it('rejects an unknown scenario slug with 400', async () => {
		await expect(
			(async () => {
				await GET(makeEvent('not-a-real-scenario') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 400));
	});

	it('404s when a registered slug has no truth.json on disk', async () => {
		// `mountain-wave-rockies` is in WX_SCENARIO_VALUES but no bundle is
		// committed to `data/wx-scenarios/`. Skip if a bundle later lands.
		const truthPath = resolve(REPO_ROOT, 'data/wx-scenarios/mountain-wave-rockies/truth.json');
		if (existsSync(truthPath)) return;
		await expect(
			(async () => {
				await GET(makeEvent('mountain-wave-rockies') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 404));
	});
});

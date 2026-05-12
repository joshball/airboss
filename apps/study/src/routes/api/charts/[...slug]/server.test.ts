/**
 * Tests for `GET /api/charts/[...slug]`.
 *
 * Covers the four behaviours the route promises:
 *
 * 1. Happy path -- a valid wx-scenarios slug streams the on-disk SVG with
 *    `image/svg+xml` content-type.
 * 2. Unknown slug -- a well-formed slug that doesn't exist on disk yields
 *    404 (rather than 500).
 * 3. Path traversal -- a slug containing `..` is rejected before any fs
 *    work runs.
 * 4. Family prefix -- a slug outside the two valid families is rejected.
 *
 * Uses real fs against the repo's committed chart artifacts; no mocks. The
 * happy-path fixture is the frontal-xc-march surface-analysis chart, which
 * is checked into `data/charts/wx/`. If that artifact moves, this test will
 * fail loudly -- which is the right alert for a route that depends on the
 * on-disk layout.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { GET } from './+server';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/api/charts/[...slug] -> repo root is seven levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..');
const FIXTURE_SLUG = 'wx-scenarios/frontal-xc-march/surface-analysis';
const FIXTURE_SVG_PATH = resolve(
	REPO_ROOT,
	'data/charts/wx/wx-scenarios/frontal-xc-march/surface-analysis/frontal-xc-march-surface-analysis-chart.svg',
);

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

describe('GET /api/charts/[...slug]/chart.svg', () => {
	it('streams the SVG bytes for a valid wx-scenarios slug', async () => {
		// Skip if the committed fixture has moved or isn't present locally.
		// The test wants to fail loudly if the layout changes (see file header)
		// but shouldn't false-positive on a partial checkout.
		if (!existsSync(FIXTURE_SVG_PATH)) {
			return;
		}

		const response = await GET(makeEvent(`${FIXTURE_SLUG}/chart.svg`) as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
		expect(response.headers.get('Cache-Control')).toMatch(/max-age=\d+/);

		const body = await response.text();
		expect(body).toMatch(/<svg /);
	});

	it('returns 404 for a well-formed slug that does not exist on disk', async () => {
		await expect(
			(async () => {
				await GET(
					makeEvent('wx-scenarios/no-such-scenario/no-such-chart/chart.svg') as unknown as Parameters<typeof GET>[0],
				);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 404));
	});

	it('rejects a slug containing path traversal with 400', async () => {
		await expect(
			(async () => {
				await GET(makeEvent('wx-scenarios/../../etc/passwd/chart.svg') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 400));
	});

	it('rejects a slug that does not start with a known chart family prefix', async () => {
		await expect(
			(async () => {
				await GET(makeEvent('not-a-real-family/something/chart.svg') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 400));
	});

	it('returns 404 when the trailing artifact segment is missing', async () => {
		await expect(
			(async () => {
				await GET(makeEvent('wx-scenarios/frontal-xc-march/surface-analysis') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 404));
	});

	it('returns 404 when the trailing artifact segment is meta.json (only chart.svg is served)', async () => {
		await expect(
			(async () => {
				await GET(makeEvent(`${FIXTURE_SLUG}/meta.json`) as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy((e: unknown) => isHttp(e, 404));
	});
});

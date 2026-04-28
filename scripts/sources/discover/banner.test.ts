/**
 * Dispatcher banner tests.
 *
 * The banner runs once per `bun run sources <cmd>` invocation; it must be
 * cheap (state-file read only) and fully suppressible.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DISCOVERY_LAYOUT_HINTS, DISCOVERY_QUIET_ENV, DISCOVERY_TIERS } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { maybePrintBanner } from './banner';
import { getCatalogueEntry } from './catalogue';
import { emptyState, mergeScrapeResult, saveState } from './state';

describe('maybePrintBanner', () => {
	let cacheRoot: string;
	const lines: string[] = [];
	const log = (line: string) => {
		lines.push(line);
	};

	beforeEach(() => {
		cacheRoot = mkdtempSync(join(tmpdir(), 'airboss-discover-banner-'));
		lines.length = 0;
	});
	afterEach(() => {
		rmSync(cacheRoot, { recursive: true, force: true });
	});

	function seedAfhCandidate(): void {
		const afh = getCatalogueEntry('afh');
		if (afh === undefined) throw new Error('catalogue missing afh');
		const state = mergeScrapeResult(
			emptyState({
				slug: afh.slug,
				title: afh.title,
				parentPageUrl: afh.parentPageUrl,
				tier: afh.tier,
			}),
			[
				{
					url: 'https://www.faa.gov/afh.pdf',
					layoutHint: DISCOVERY_LAYOUT_HINTS.ADDENDUM,
				},
			],
			{
				now: '2026-04-28T00:00:00Z',
				tier: DISCOVERY_TIERS.ACTIONABLE,
				dismissedUrls: new Set(),
				appliedUrlsToId: new Map(),
			},
		);
		saveState(cacheRoot, state);
	}

	it('emits a banner when at least one candidate is unreviewed', () => {
		seedAfhCandidate();
		maybePrintBanner({ cacheRoot, env: {}, logger: log });
		expect(lines.some((l) => l.includes('1 unreviewed errata candidate'))).toBe(true);
	});

	it('is silent when AIRBOSS_QUIET=1', () => {
		seedAfhCandidate();
		maybePrintBanner({ cacheRoot, env: { [DISCOVERY_QUIET_ENV]: '1' }, logger: log });
		expect(lines).toHaveLength(0);
	});

	it('is silent when no state files exist yet', () => {
		maybePrintBanner({ cacheRoot, env: {}, logger: log });
		expect(lines).toHaveLength(0);
	});
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveCurrentSectionalEdition } from './resolve-edition';

const FIXTURE = readFileSync(resolve(import.meta.dirname, '__fixtures__', 'aeronav-index.html'), 'utf8');

function makeFetcher(html: string): (url: string) => Promise<string> {
	return async () => html;
}

describe('resolveCurrentSectionalEdition', () => {
	it('parses the latest date + edition for the requested region', async () => {
		const result = await resolveCurrentSectionalEdition({
			region: 'Denver',
			indexUrl: 'https://aeronav.faa.gov/visual/',
			urlTemplate: 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip',
			fetchHtml: makeFetcher(FIXTURE),
			now: () => new Date('2026-04-24T12:00:00.000Z'),
		});
		expect(result.effectiveDate).toBe('2026-03-21');
		expect(result.editionNumber).toBe(116);
		expect(result.resolvedUrl).toBe('https://aeronav.faa.gov/visual/2026-03-21/sectional-files/Denver.zip');
		expect(result.resolvedAt).toBe('2026-04-24T12:00:00.000Z');
	});

	it('substitutes `region` even when the template references it multiple times', async () => {
		const result = await resolveCurrentSectionalEdition({
			region: 'Seattle',
			indexUrl: 'https://aeronav.faa.gov/visual/',
			urlTemplate: 'https://host/{region}/{edition-date}/{region}.zip',
			fetchHtml: makeFetcher(FIXTURE),
		});
		expect(result.resolvedUrl).toBe('https://host/Seattle/2026-03-21/Seattle.zip');
	});

	it('throws when the template is missing the edition-date placeholder', async () => {
		await expect(
			resolveCurrentSectionalEdition({
				region: 'Denver',
				indexUrl: 'https://aeronav.faa.gov/visual/',
				urlTemplate: 'https://aeronav.faa.gov/visual/Denver.zip',
				fetchHtml: makeFetcher(FIXTURE),
			}),
		).rejects.toThrow(/edition-date/);
	});

	it('throws when the HTML contains no date for the region', async () => {
		await expect(
			resolveCurrentSectionalEdition({
				region: 'Anchorage',
				indexUrl: 'https://aeronav.faa.gov/visual/',
				urlTemplate: 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip',
				fetchHtml: makeFetcher(FIXTURE),
			}),
		).rejects.toThrow(/Anchorage/);
	});

	it('throws when the fetcher returns an empty body', async () => {
		await expect(
			resolveCurrentSectionalEdition({
				region: 'Denver',
				indexUrl: 'https://aeronav.faa.gov/visual/',
				urlTemplate: 'https://aeronav.faa.gov/visual/{edition-date}/{region}.zip',
				fetchHtml: makeFetcher(''),
			}),
		).rejects.toThrow(/empty response/);
	});

	it('returns null editionNumber when the page does not expose one', async () => {
		const bare = '<html><body><p>Denver current: 2025-11-30</p></body></html>';
		const result = await resolveCurrentSectionalEdition({
			region: 'Denver',
			indexUrl: 'https://example/',
			urlTemplate: 'https://host/{edition-date}/{region}.zip',
			fetchHtml: makeFetcher(bare),
		});
		expect(result.editionNumber).toBeNull();
		expect(result.effectiveDate).toBe('2025-11-30');
	});
});

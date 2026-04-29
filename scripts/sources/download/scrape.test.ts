/**
 * Two-hop scrape unit tests. All HTTP traffic is mocked.
 */

import { describe, expect, it } from 'vitest';
import { resolveChapterUrls } from './scrape';

const PHAK_INDEX = `
<!DOCTYPE html>
<html>
<body>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-1-introduction-flying">Chapter 1</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-2-aeronautical-decision-making">Chapter 2</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-3-aircraft-construction">Chapter 3</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-4-principles-flight">Chapter 4</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-5-aerodynamics-flight">Chapter 5</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-6-flight-controls">Chapter 6</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-7-aircraft-systems">Chapter 7</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-8-flight-instruments">Chapter 8</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-9-flight-manuals">Chapter 9</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-10-weight-balance">Chapter 10</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-11-aircraft-performance">Chapter 11</a>
<a href="/regulationspolicies/handbooksmanuals/aviation/phak/chapter-12-weather-theory">Chapter 12</a>
</body>
</html>
`;

function chapterPageHtml(n: number): string {
	return `
<!DOCTYPE html>
<html>
<body>
<p>Chapter ${n} download</p>
<a href="/sites/faa.gov/files/${String(n + 2).padStart(2, '0')}_phak_ch${n}.pdf">PDF</a>
</body>
</html>
`;
}

function makeFakeFetch(indexUrl: string): typeof fetch {
	return async (input: RequestInfo | URL): Promise<Response> => {
		const url = String(input);
		if (url === indexUrl) {
			return new Response(PHAK_INDEX, { status: 200, headers: { 'Content-Type': 'text/html' } });
		}
		const m = url.match(/chapter-(\d+)-/);
		if (m !== null) {
			return new Response(chapterPageHtml(Number.parseInt(m[1] ?? '1', 10)), {
				status: 200,
				headers: { 'Content-Type': 'text/html' },
			});
		}
		return new Response('not found', { status: 404 });
	};
}

describe('resolveChapterUrls', () => {
	it('resolves 12 PHAK chapters in order', async () => {
		const indexUrl = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak';
		const result = await resolveChapterUrls(indexUrl, 'chapter-{N}-', 12, makeFakeFetch(indexUrl));
		expect(result).toHaveLength(12);
		expect(result.map((r) => r.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		// Slugs differ per chapter (introduction-flying vs aerodynamics-flight); the
		// scraper still resolves each by ordinal-prefix-match.
		const ch7 = result.find((r) => r.ordinal === 7);
		expect(ch7?.pageUrl).toContain('chapter-7-aircraft-systems');
		expect(ch7?.pdfUrl).toContain('09_phak_ch7.pdf');
		// Ordinal 1 is NOT confused with ordinal 10/11/12 ("chapter-1-" doesn't
		// match "chapter-10-").
		const ch1 = result.find((r) => r.ordinal === 1);
		expect(ch1?.pageUrl).toContain('chapter-1-introduction-flying');
	});

	it('hard-fails when a chapter page is missing', async () => {
		const indexUrl = 'https://www.faa.gov/test/handbook';
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const url = String(input);
			if (url === indexUrl) {
				return new Response(`<a href="${indexUrl}/chapter-1-only">x</a>`, {
					status: 200,
					headers: { 'Content-Type': 'text/html' },
				});
			}
			return new Response('not found', { status: 404 });
		};
		await expect(resolveChapterUrls(indexUrl, 'chapter-{N}-', 1, fakeFetch)).rejects.toThrow(/HTTP 404|no \.pdf link/);
	});

	it('hard-fails when index page lacks an expected chapter ordinal', async () => {
		const indexUrl = 'https://www.faa.gov/test/handbook';
		const fakeFetch: typeof fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const url = String(input);
			if (url === indexUrl) {
				// Only chapter 1 in the index; chapter 2 is missing.
				return new Response(`<a href="${indexUrl}/chapter-1-foo">x</a>`, {
					status: 200,
					headers: { 'Content-Type': 'text/html' },
				});
			}
			return new Response('<a href="/file.pdf">PDF</a>', {
				status: 200,
				headers: { 'Content-Type': 'text/html' },
			});
		};
		await expect(resolveChapterUrls(indexUrl, 'chapter-{N}-', 2, fakeFetch)).rejects.toThrow(
			/no chapter 2 link found/,
		);
	});

	it('rejects a pagePattern missing the {N} placeholder', async () => {
		await expect(resolveChapterUrls('https://x.test', 'chapter-N-', 1)).rejects.toThrow(/{N}/);
	});
});

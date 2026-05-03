/**
 * Cache-first plan-build tests for the two-hop chapter-PDF resolver.
 *
 * `buildChapterPdfPlans` (in `plans.ts`) runs the publisher's two-hop scrape
 * (1 index GET + N chapter-page GETs) only when the per-handbook manifest does
 * NOT already carry valid cached `chapter_page_url` + `source_url` rows for
 * every configured chapter. These tests pin the four branches:
 *
 *   1. Cached manifest matches `chapter_count` -> resolver is NOT called.
 *   2. Missing manifest -> resolver runs.
 *   3. Manifest with only some chapter rows -> resolver runs (partial cache).
 *   4. `--rescrape` flag -> resolver runs even when cache is complete.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs } from './args';
import type { ChapterArtifact, HandbookManifestFile, ManifestEntry } from './manifest';
import { buildPlans } from './plans';

const PHAK_INDEX_URL = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak';
const PHAK_EDITION = 'FAA-H-8083-25C';
const PHAK_CHAPTER_COUNT = 17;

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-cache-'));
});

afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

/**
 * Resolver spy: records every call and returns synthetic resolved URLs. When
 * the cache short-circuits the call site, `calls` stays at 0; that's the
 * behavior the tests pin.
 */
function makeResolverSpy(): {
	resolver: (
		indexUrl: string,
		pagePattern: string,
		chapterCount: number,
	) => Promise<readonly { ordinal: number; pageUrl: string; pdfUrl: string }[]>;
	calls: { indexUrl: string; pagePattern: string; chapterCount: number }[];
} {
	const calls: { indexUrl: string; pagePattern: string; chapterCount: number }[] = [];
	const resolver = async (indexUrl: string, pagePattern: string, chapterCount: number) => {
		calls.push({ indexUrl, pagePattern, chapterCount });
		const out: { ordinal: number; pageUrl: string; pdfUrl: string }[] = [];
		for (let n = 1; n <= chapterCount; n += 1) {
			out.push({
				ordinal: n,
				pageUrl: `${indexUrl}/chapter-${n}-live`,
				pdfUrl: `${indexUrl}/chapter-${n}/live.pdf`,
			});
		}
		return out;
	};
	return { resolver, calls };
}

/**
 * Throwing resolver: any invocation fails the test. Used to assert "the cache
 * short-circuited the live scrape" without relying on a call counter alone.
 */
const NEVER_CALLED_RESOLVER = async (): Promise<readonly { ordinal: number; pageUrl: string; pdfUrl: string }[]> => {
	throw new Error('resolver should not be invoked when manifest cache is valid');
};

function makeManifestEntry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
	return {
		corpus: 'handbooks',
		doc: 'phak',
		edition: PHAK_EDITION,
		source_url: 'https://www.faa.gov/sites/faa.gov/files/00_phak_intro.pdf',
		source_filename: 'FAA-H-8083-25C.pdf',
		source_sha256: '0'.repeat(64),
		size_bytes: 1234,
		fetched_at: '2026-04-30T00:00:00.000Z',
		schema_version: 1,
		...overrides,
	};
}

function makeChapterArtifact(ordinal: number, overrides: Partial<ChapterArtifact> = {}): ChapterArtifact {
	const padded = String(ordinal).padStart(2, '0');
	return {
		...makeManifestEntry(),
		source_url: `${PHAK_INDEX_URL}/chapter-${ordinal}/cached.pdf`,
		source_filename: `${PHAK_EDITION}-ch${padded}.pdf`,
		ordinal,
		chapter_page_url: `${PHAK_INDEX_URL}/chapter-${ordinal}-cached`,
		...overrides,
	};
}

/**
 * Write a per-handbook PHAK manifest with `chapterRows` chapter entries to the
 * cache layout the resolver expects (`<root>/handbooks/phak/<edition>/manifest.json`).
 */
function writePhakManifest(chapterRows: readonly ChapterArtifact[]): void {
	const editionDir = join(tempRoot, 'handbooks', 'phak', PHAK_EDITION);
	mkdirSync(editionDir, { recursive: true });
	const manifest: HandbookManifestFile = {
		schema_version: 1,
		corpus: 'handbooks',
		doc: 'phak',
		edition: PHAK_EDITION,
		primary: makeManifestEntry(),
		chapters: chapterRows,
	};
	writeFileSync(join(editionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

describe('buildPlans -- chapter URL caching (C7)', () => {
	it('reuses cached chapter URLs and never invokes the resolver when manifest is complete', async () => {
		const cachedRows = Array.from({ length: PHAK_CHAPTER_COUNT }, (_, i) => makeChapterArtifact(i + 1));
		writePhakManifest(cachedRows);

		const args = parseArgs(['--corpus=handbooks']);
		const plans = await buildPlans(args, tempRoot, { resolveChapterUrls: NEVER_CALLED_RESOLVER });

		const phakChapters = plans.filter((p) => p.doc === 'phak' && p.kind === 'chapter-pdf');
		expect(phakChapters).toHaveLength(PHAK_CHAPTER_COUNT);
		// Cache hit: chapter URLs come from manifest, not from the live resolver.
		const ch7 = phakChapters.find((p) => p.ordinal === 7);
		expect(ch7?.url).toBe(`${PHAK_INDEX_URL}/chapter-7/cached.pdf`);
		expect(ch7?.chapterPageUrl).toBe(`${PHAK_INDEX_URL}/chapter-7-cached`);
	});

	it('falls back to the resolver when no manifest exists', async () => {
		// No manifest written -- cache directory does not exist.
		const { resolver, calls } = makeResolverSpy();
		const args = parseArgs(['--corpus=handbooks']);
		const plans = await buildPlans(args, tempRoot, { resolveChapterUrls: resolver });

		const phakChapters = plans.filter((p) => p.doc === 'phak' && p.kind === 'chapter-pdf');
		expect(phakChapters).toHaveLength(PHAK_CHAPTER_COUNT);
		// Resolver was called exactly once (PHAK is the only two-hop handbook).
		const phakResolverCalls = calls.filter((c) => c.indexUrl === PHAK_INDEX_URL);
		expect(phakResolverCalls).toHaveLength(1);
		expect(phakResolverCalls[0]?.chapterCount).toBe(PHAK_CHAPTER_COUNT);
		// Plans use the live resolver's URLs.
		const ch7 = phakChapters.find((p) => p.ordinal === 7);
		expect(ch7?.url).toBe(`${PHAK_INDEX_URL}/chapter-7/live.pdf`);
	});

	it('falls back to the resolver when a chapter row is missing chapter_page_url', async () => {
		// 17 rows, but ch7 has chapter_page_url=null -- cache is partial.
		const rows = Array.from({ length: PHAK_CHAPTER_COUNT }, (_, i) => makeChapterArtifact(i + 1));
		const truncated = rows.map((r): ChapterArtifact => (r.ordinal === 7 ? { ...r, chapter_page_url: null } : r));
		writePhakManifest(truncated);

		const { resolver, calls } = makeResolverSpy();
		const args = parseArgs(['--corpus=handbooks']);
		const plans = await buildPlans(args, tempRoot, { resolveChapterUrls: resolver });

		const phakResolverCalls = calls.filter((c) => c.indexUrl === PHAK_INDEX_URL);
		expect(phakResolverCalls).toHaveLength(1);
		const ch7 = plans.find((p) => p.doc === 'phak' && p.kind === 'chapter-pdf' && p.ordinal === 7);
		// Live resolver's URLs win once cache is invalidated.
		expect(ch7?.url).toBe(`${PHAK_INDEX_URL}/chapter-7/live.pdf`);
	});

	it('falls back to the resolver when row count != configured chapter_count', async () => {
		// Only 16 of the 17 PHAK chapters cached.
		const rows = Array.from({ length: PHAK_CHAPTER_COUNT - 1 }, (_, i) => makeChapterArtifact(i + 1));
		writePhakManifest(rows);

		const { resolver, calls } = makeResolverSpy();
		const args = parseArgs(['--corpus=handbooks']);
		await buildPlans(args, tempRoot, { resolveChapterUrls: resolver });

		const phakResolverCalls = calls.filter((c) => c.indexUrl === PHAK_INDEX_URL);
		expect(phakResolverCalls).toHaveLength(1);
	});

	it('forces the resolver when --rescrape is set, even with a complete cache', async () => {
		const cachedRows = Array.from({ length: PHAK_CHAPTER_COUNT }, (_, i) => makeChapterArtifact(i + 1));
		writePhakManifest(cachedRows);

		const { resolver, calls } = makeResolverSpy();
		const args = parseArgs(['--corpus=handbooks', '--rescrape']);
		const plans = await buildPlans(args, tempRoot, { resolveChapterUrls: resolver });

		const phakResolverCalls = calls.filter((c) => c.indexUrl === PHAK_INDEX_URL);
		expect(phakResolverCalls).toHaveLength(1);
		const ch7 = plans.find((p) => p.doc === 'phak' && p.kind === 'chapter-pdf' && p.ordinal === 7);
		// Live URLs override the (still-present) cached values.
		expect(ch7?.url).toBe(`${PHAK_INDEX_URL}/chapter-7/live.pdf`);
	});
});

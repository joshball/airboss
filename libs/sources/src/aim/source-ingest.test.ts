/**
 * Tests for the AIM source-ingest manifest reader.
 *
 * Regression coverage for the correctness review (2026-05-01, finding #1):
 * `discoverCachedAim` previously read `entries[]` from the cache manifest,
 * but the downloader (per ADR 021/022) writes the AIM cache manifest as
 * `{ primary, sections[], appendices[] }` -- there is no `entries[]` array.
 * The bug made `bun run sources register aim --cache=...` skip every PDF
 * silently. These tests assert the loader consumes the real cache shape.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAimSourceIngest } from './source-ingest.ts';

function makeTempCache(): string {
	return mkdtempSync(join(tmpdir(), 'airboss-aim-source-ingest-'));
}

function writeAimManifest(cacheRoot: string, manifest: unknown): void {
	const aimDir = join(cacheRoot, 'aim');
	mkdirSync(aimDir, { recursive: true });
	writeFileSync(join(aimDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

function writeAimPdfStub(cacheRoot: string, filename: string): void {
	// We never actually parse this PDF in these tests -- extractAim is exercised
	// elsewhere. The bytes here are a minimal placeholder so the existsSync
	// check in `discoverCachedAim` succeeds.
	writeFileSync(join(cacheRoot, 'aim', filename), '%PDF-1.4\n%stub\n', 'utf-8');
}

describe('runAimSourceIngest manifest discovery', () => {
	it('reads `primary` from the AIM cache manifest (ADR 021/022 shape)', async () => {
		const cacheRoot = makeTempCache();
		const derivativeRoot = mkdtempSync(join(tmpdir(), 'airboss-aim-deriv-'));
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: {
				corpus: 'aim',
				doc: 'aim',
				edition: null,
				source_url: 'https://example.invalid/aim.pdf',
				source_filename: 'aim.pdf',
				source_sha256: 'deadbeef',
				size_bytes: 100,
				fetched_at: '2026-04-29T00:00:00Z',
				schema_version: 1,
			},
			sections: [],
			appendices: [],
		});
		writeAimPdfStub(cacheRoot, 'aim.pdf');

		const report = await runAimSourceIngest({ cacheRoot, derivativeRoot });

		// Under the bug, `editionsScanned` was 0 and the skipReasons listed
		// "missing entries[] array". Now we discover the primary edition. The
		// downstream PDF extract may still fail on a stub PDF, but discovery
		// must succeed.
		expect(report.editionsScanned).toBe(1);
		expect(report.skipReasons.some((r) => r.includes('missing entries[] array'))).toBe(false);
		expect(report.skipReasons.some((r) => r.includes('per-corpus manifest not found'))).toBe(false);
	});

	it("uses the slug 'current' when primary.edition is null", async () => {
		const cacheRoot = makeTempCache();
		const derivativeRoot = mkdtempSync(join(tmpdir(), 'airboss-aim-deriv-'));
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: {
				corpus: 'aim',
				doc: 'aim',
				edition: null,
				source_url: 'https://example.invalid/aim.pdf',
				source_filename: 'aim.pdf',
				source_sha256: 'deadbeef',
				size_bytes: 100,
				fetched_at: '2026-04-29T00:00:00Z',
				schema_version: 1,
			},
			sections: [],
			appendices: [],
		});
		writeAimPdfStub(cacheRoot, 'aim.pdf');

		const report = await runAimSourceIngest({ cacheRoot, derivativeRoot, edition: 'current' });
		expect(report.editionsScanned).toBe(1);
		// We requested `--edition=current` so the filter must match.
		expect(report.skipReasons.some((r) => r.includes("edition 'current' not found"))).toBe(false);
	});

	it('rejects manifests missing the primary entry', async () => {
		const cacheRoot = makeTempCache();
		const derivativeRoot = mkdtempSync(join(tmpdir(), 'airboss-aim-deriv-'));
		writeAimManifest(cacheRoot, { schema_version: 1, corpus: 'aim' });

		const report = await runAimSourceIngest({ cacheRoot, derivativeRoot });
		expect(report.editionsScanned).toBe(0);
		expect(report.skipReasons.some((r) => r.includes('missing primary'))).toBe(true);
	});

	it('rejects the legacy `entries[]` shape with a clear error', async () => {
		// Belt-and-braces: a stale manifest from before this fix would have
		// `entries[]` and no `primary`. The reader must surface a useful skip
		// reason rather than silently emit zero editions.
		const cacheRoot = makeTempCache();
		const derivativeRoot = mkdtempSync(join(tmpdir(), 'airboss-aim-deriv-'));
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			entries: [
				{
					corpus: 'aim',
					doc: 'aim',
					edition: '2026-04',
					source_url: 'https://example.invalid/aim.pdf',
					source_filename: 'aim.pdf',
					source_sha256: 'deadbeef',
					fetched_at: '2026-04-29T00:00:00Z',
				},
			],
		});

		const report = await runAimSourceIngest({ cacheRoot, derivativeRoot });
		expect(report.editionsScanned).toBe(0);
		expect(report.skipReasons.some((r) => r.includes('missing primary'))).toBe(true);
	});
});

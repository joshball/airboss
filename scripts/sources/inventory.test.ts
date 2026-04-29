/**
 * Inventory generator tests. The output is supposed to be byte-equal across
 * regenerations against the same input cache state -- the test asserts that
 * property by running the generator twice with the same generatedAt seed.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildInventory, runInventory, SHA_PREFIX_LENGTH } from './inventory';

let tempRoot: string;
let outputPath: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-inv-'));
	outputPath = join(tempRoot, 'INVENTORY.md');
});
afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

describe('buildInventory', () => {
	it('produces a markdown document with the per-corpus headings', () => {
		const out = buildInventory(tempRoot, '2026-04-29');
		expect(out).toContain('# Source inventory');
		expect(out).toContain('## Handbooks');
		expect(out).toContain('## Advisory Circulars');
		expect(out).toContain('## ACS -- Airman Certification Standards');
		expect(out).toContain('## AIM -- Aeronautical Information Manual');
		expect(out).toContain('## Regulations (CFR via eCFR)');
		expect(out).toContain('Last regenerated: 2026-04-29');
	});

	it('is byte-equal across two runs with the same input + seed', () => {
		const a = buildInventory(tempRoot, '2026-04-29');
		const b = buildInventory(tempRoot, '2026-04-29');
		expect(b).toBe(a);
	});

	it('uses 12-char SHA-256 prefix and writes a manifest entry table per handbook', () => {
		// Pre-populate one handbook manifest. PHAK lives at
		// `<root>/handbooks/phak/FAA-H-8083-25C/manifest.json`.
		const phakDir = join(tempRoot, 'handbooks', 'phak', 'FAA-H-8083-25C');
		const fs = require('node:fs');
		fs.mkdirSync(phakDir, { recursive: true });
		writeFileSync(
			join(phakDir, 'manifest.json'),
			JSON.stringify({
				schema_version: 1,
				corpus: 'handbooks',
				doc: 'phak',
				edition: 'FAA-H-8083-25C',
				primary: {
					corpus: 'handbooks',
					doc: 'phak',
					edition: 'FAA-H-8083-25C',
					source_url: 'https://example.test/phak.pdf',
					source_filename: 'FAA-H-8083-25C.pdf',
					source_sha256: 'a4f8d9b0c1e2deadbeef0000000000000000000000000000000000000000000000',
					size_bytes: 1024,
					fetched_at: '2026-04-27T12:00:00.000Z',
					schema_version: 1,
				},
			}),
			'utf-8',
		);
		const out = buildInventory(tempRoot, '2026-04-29');
		expect(out).toContain('a4f8d9b0c1e2');
		expect(SHA_PREFIX_LENGTH).toBe(12);
		// Date column trimmed to YYYY-MM-DD.
		expect(out).toContain('2026-04-27');
	});

	it('falls back to "-" placeholders for missing manifests (clean cache)', () => {
		const out = buildInventory(tempRoot, '2026-04-29');
		// Every row in an empty cache should have a `-` SHA placeholder.
		expect(out).toContain('| `-` |');
	});
});

describe('runInventory', () => {
	it('writes INVENTORY.md to the configured outputPath', async () => {
		const code = await runInventory({
			cacheRoot: tempRoot,
			outputPath,
			generatedAt: '2026-04-29',
		});
		expect(code).toBe(0);
		const content = readFileSync(outputPath, 'utf-8');
		expect(content).toContain('# Source inventory');
		expect(content).toContain('Last regenerated: 2026-04-29');
	});

	it('regen against the same cache yields byte-equal output', async () => {
		await runInventory({ cacheRoot: tempRoot, outputPath, generatedAt: '2026-04-29' });
		const first = readFileSync(outputPath, 'utf-8');
		await runInventory({ cacheRoot: tempRoot, outputPath, generatedAt: '2026-04-29' });
		const second = readFileSync(outputPath, 'utf-8');
		expect(second).toBe(first);
	});
});

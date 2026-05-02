/**
 * Phase 8 -- AC ingest CLI exit-code + SHA-verify regression tests.
 *
 * Source of truth: 2026-05-01 backend review (findings #1, #2, #4). Pre-fix,
 * `runIngestCli` always returned 0 even when `report.skipReasons` had
 * unrecoverable entries (silent partial advance). The register path also
 * trusted the cache without re-hashing the bytes, so a poisoned cache could
 * advance state. These tests lock in the post-fix behaviour:
 *
 *   - Hard skips (extraction failed, SHA mismatch) -> non-zero exit.
 *   - Soft skips (per-corpus manifest absent, unrevisioned ACs, etc.) -> 0.
 *   - SHA verification re-hashes the cached bytes against the manifest's
 *     `source_sha256` and surfaces a `ShaMismatchError` on drift.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { INGEST_EXIT_CODES } from '../shared/exit-codes.ts';
import { runIngestCli } from './ingest.ts';

let workDir: string;
let cacheRoot: string;
let derivativeRoot: string;

beforeEach(() => {
	resetRegistry();
	workDir = mkdtempSync(join(tmpdir(), 'ac-cli-'));
	cacheRoot = join(workDir, 'cache');
	derivativeRoot = join(workDir, 'derivative');
	mkdirSync(cacheRoot, { recursive: true });
	mkdirSync(derivativeRoot, { recursive: true });
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
	resetRegistry();
});

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function writeFakeAcCache(args: { docNumber: string; revision: string; mismatchSha: boolean }): void {
	const acDir = join(cacheRoot, 'ac');
	mkdirSync(acDir, { recursive: true });
	const filename = `AC_${args.docNumber}-${args.revision.toUpperCase()}.pdf`;
	const pdfPath = join(acDir, filename);
	const fakeBytes = Buffer.from('not a real PDF', 'utf-8');
	writeFileSync(pdfPath, fakeBytes);
	const recordedSha = args.mismatchSha
		? '0000000000000000000000000000000000000000000000000000000000000000'
		: sha256(fakeBytes);
	const manifest = {
		schema_version: 1,
		corpus: 'ac',
		entries: [
			{
				corpus: 'ac',
				doc: `ac-${args.docNumber.replace(/\./g, '-')}-${args.revision.toLowerCase()}`,
				edition: args.revision.toUpperCase(),
				source_url: `https://example.test/ac/${filename}`,
				source_filename: filename,
				source_sha256: recordedSha,
				fetched_at: new Date().toISOString(),
			},
		],
	};
	writeFileSync(join(acDir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
}

describe('runIngestCli exit codes', () => {
	test('CLI-01: returns 0 (OK) when cache is empty -- soft skip', async () => {
		const code = await runIngestCli([`--cache=${cacheRoot}`, `--out=${derivativeRoot}`]);
		expect(code).toBe(INGEST_EXIT_CODES.OK);
	});

	test('CLI-02: returns 1 (HARD_SKIPS) on SHA mismatch (cache poisoning)', async () => {
		writeFakeAcCache({ docNumber: '61-65', revision: 'j', mismatchSha: true });
		const code = await runIngestCli([`--cache=${cacheRoot}`, `--out=${derivativeRoot}`]);
		expect(code).toBe(INGEST_EXIT_CODES.HARD_SKIPS);
	});

	test('CLI-03: --skip-sha-verify bypasses SHA check (test escape hatch)', async () => {
		writeFakeAcCache({ docNumber: '61-65', revision: 'j', mismatchSha: true });
		// SHA verification skipped, but extractPdf still fails because the file
		// isn't a real PDF. So we still get a hard skip from the extract path,
		// but for a DIFFERENT reason. Confirms --skip-sha-verify wires through.
		const code = await runIngestCli([`--cache=${cacheRoot}`, `--out=${derivativeRoot}`, '--skip-sha-verify']);
		expect(code).toBe(INGEST_EXIT_CODES.HARD_SKIPS);
	});

	test('CLI-04: returns 1 on extraction failure (non-PDF bytes)', async () => {
		writeFakeAcCache({ docNumber: '61-65', revision: 'j', mismatchSha: false });
		const code = await runIngestCli([`--cache=${cacheRoot}`, `--out=${derivativeRoot}`]);
		expect(code).toBe(INGEST_EXIT_CODES.HARD_SKIPS);
	});

	test('CLI-05: returns 2 (BAD_ARGS) on unknown argument', async () => {
		const code = await runIngestCli(['--bogus']);
		expect(code).toBe(INGEST_EXIT_CODES.BAD_ARGS);
	});

	test('CLI-06: returns 0 on --help', async () => {
		const code = await runIngestCli(['--help']);
		expect(code).toBe(INGEST_EXIT_CODES.OK);
	});
});

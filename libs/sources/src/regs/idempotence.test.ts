import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { runIngest } from './ingest.ts';
import { setRegsDerivativeRoot } from './resolver.ts';

const FIXTURE_PATH = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-idempotence-'));
	resetRegistry();
	setRegsDerivativeRoot(tmpRoot);
});

afterEach(() => {
	setRegsDerivativeRoot(join(process.cwd(), 'regulations'));
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('runIngest idempotence', () => {
	it('a second run modifies zero files and records no new promotion', async () => {
		const first = await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});
		expect(first.promotionBatchId).not.toBeNull();
		expect(first.filesWritten).toBeGreaterThan(0);

		const second = await runIngest({
			title: '14',
			editionDate: '2026-01-01',
			outRoot: tmpRoot,
			fixturePath: FIXTURE_PATH,
		});

		// Note: manifest.json contains `fetchedAt` which is `new Date().toISOString()`,
		// regenerated each run; that one file always rewrites. Everything else is
		// hash-stable.
		expect(second.filesWritten).toBeLessThanOrEqual(1);
		expect(second.filesUnchanged).toBeGreaterThan(0);
		expect(second.entriesAlreadyAccepted).toBeGreaterThan(0);
		expect(second.promotionBatchId).toBeNull();
	});
});

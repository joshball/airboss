/**
 * Source seed registry tests. Per-entry invariants that should hold regardless
 * of whether any binary is actually on disk.
 *
 * Successor to `libs/aviation/src/sources/registry.test.ts`. The legacy
 * "paths under `data/sources/`" assertion is gone; paths now resolve through
 * the developer-local cache root per ADR 018.
 */

import { isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	getSeedSource,
	getSeedSourcesByType,
	isSeedSourceDownloaded,
	PENDING_DOWNLOAD,
	SOURCES,
} from './source-seed-registry';

describe('hangar source seed registry', () => {
	it('has at least the Phase 1 entries (cfr, aim, phak, afh, ifh, pcg)', () => {
		const ids = SOURCES.map((s) => s.id);
		expect(ids).toContain('cfr-14');
		expect(ids).toContain('aim-current');
		expect(ids).toContain('phak-current');
		expect(ids).toContain('afh-current');
		expect(ids).toContain('ifh-current');
		expect(ids).toContain('pcg-current');
	});

	it('has unique ids', () => {
		const seen = new Set<string>();
		for (const s of SOURCES) {
			expect(seen.has(s.id)).toBe(false);
			seen.add(s.id);
		}
	});

	it('paths are absolute (resolved through the cache root)', () => {
		for (const s of SOURCES) {
			expect(isAbsolute(s.path)).toBe(true);
			expect(s.path.includes('..')).toBe(false);
		}
	});

	it('Phase 1 entries are marked as pending-download', () => {
		for (const s of SOURCES) {
			expect(s.checksum).toBe(PENDING_DOWNLOAD);
			expect(s.downloadedAt).toBe(PENDING_DOWNLOAD);
			expect(isSeedSourceDownloaded(s)).toBe(false);
		}
	});

	it('getSeedSource() resolves a known id', () => {
		expect(getSeedSource('cfr-14')?.type).toBe('cfr');
	});

	it('getSeedSource() returns undefined for unknown ids', () => {
		expect(getSeedSource('made-up-source')).toBeUndefined();
	});

	it('getSeedSourcesByType() filters the registry', () => {
		const cfrSources = getSeedSourcesByType('cfr');
		expect(cfrSources.length).toBeGreaterThanOrEqual(1);
		for (const source of cfrSources) {
			expect(source.type).toBe('cfr');
		}
		expect(cfrSources.map((s) => s.id)).toContain('cfr-14');
	});
});

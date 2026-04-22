/**
 * Source registry tests. Per-entry invariants that should hold regardless of
 * whether any binary is actually on disk.
 */

import { describe, expect, it } from 'vitest';
import { getSource, getSourcesByType, isSourceDownloaded, PENDING_DOWNLOAD, SOURCES } from './registry';

describe('SOURCES registry', () => {
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

	it('paths are always under data/sources/', () => {
		for (const s of SOURCES) {
			expect(s.path.startsWith('data/sources/')).toBe(true);
			expect(s.path.includes('..')).toBe(false);
		}
	});

	it('Phase 1 entries are marked as pending-download', () => {
		for (const s of SOURCES) {
			expect(s.checksum).toBe(PENDING_DOWNLOAD);
			expect(s.downloadedAt).toBe(PENDING_DOWNLOAD);
			expect(isSourceDownloaded(s)).toBe(false);
		}
	});

	it('getSource() resolves a known id', () => {
		expect(getSource('cfr-14')?.type).toBe('cfr');
	});

	it('getSource() returns undefined for unknown ids', () => {
		expect(getSource('made-up-source')).toBeUndefined();
	});

	it('getSourcesByType() filters the registry', () => {
		const cfrSources = getSourcesByType('cfr');
		expect(cfrSources.length).toBeGreaterThanOrEqual(1);
		for (const source of cfrSources) {
			expect(source.type).toBe('cfr');
		}
		expect(cfrSources.map((s) => s.id)).toContain('cfr-14');
	});
});

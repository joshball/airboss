/**
 * Phase 9 -- bootstrap (registry hydration from on-disk derivatives).
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { hydrateRegsFromDerivatives } from './bootstrap.ts';
import { resetRegistry } from './registry/__test_helpers__.ts';
import { productionRegistry } from './registry/index.ts';
import type { SourceId } from './types.ts';

let workDir: string;

beforeEach(() => {
	resetRegistry();
	workDir = join(tmpdir(), `airboss-bootstrap-${process.pid}-${Date.now()}`);
	mkdirSync(workDir, { recursive: true });
});

afterEach(() => {
	resetRegistry();
	rmSync(workDir, { recursive: true, force: true });
});

function writeManifest(title: '14' | '49', editionDate: string, sectionsByPart: Record<string, unknown[]>): void {
	const titleDir = join(workDir, 'regulations', `cfr-${title}`, editionDate);
	mkdirSync(titleDir, { recursive: true });
	const editionSlug = editionDate.slice(0, 4);
	writeFileSync(
		join(titleDir, 'manifest.json'),
		JSON.stringify(
			{
				schemaVersion: 1,
				title,
				editionSlug,
				editionDate,
				sourceUrl: `file:///${title}/source.xml`,
				sourceSha256: 'abc',
				fetchedAt: '2026-04-27T00:00:00Z',
				partCount: Object.keys(sectionsByPart).length,
				subpartCount: 0,
				sectionCount: Object.values(sectionsByPart).reduce((acc, rows) => acc + rows.length, 0),
			},
			null,
			2,
		),
		'utf-8',
	);
	writeFileSync(
		join(titleDir, 'sections.json'),
		JSON.stringify({ schemaVersion: 1, edition: editionSlug, sectionsByPart }, null, 2),
		'utf-8',
	);
}

describe('hydrateRegsFromDerivatives', () => {
	test('returns zero counts when regulations/ does not exist', () => {
		const report = hydrateRegsFromDerivatives({ cwd: workDir });
		expect(report.editionsHydrated).toBe(0);
		expect(report.entriesAdded).toBe(0);
	});

	test('synthesizes Part + Section entries for one edition and promotes them to accepted', () => {
		writeManifest('14', '2026-04-22', {
			'91': [
				{
					id: 'airboss-ref:regs/cfr-14/91/103',
					canonical_short: '§91.103',
					canonical_title: 'Preflight action',
					last_amended_date: '2024-01-01',
					body_path: '91/91-103.md',
					body_sha256: 'sha',
				},
			],
		});
		const report = hydrateRegsFromDerivatives({ cwd: workDir });
		expect(report.editionsHydrated).toBe(1);
		// 1 Part entry + 1 Section entry = 2 entries.
		expect(report.entriesAdded).toBe(2);

		const sectionEntry = productionRegistry.getEntry('airboss-ref:regs/cfr-14/91/103' as SourceId);
		expect(sectionEntry).not.toBeNull();
		expect(sectionEntry?.canonical_short).toBe('§91.103');
		expect(sectionEntry?.lifecycle).toBe('accepted');

		const partEntry = productionRegistry.getEntry('airboss-ref:regs/cfr-14/91' as SourceId);
		expect(partEntry).not.toBeNull();
		expect(partEntry?.canonical_short).toBe('14 CFR Part 91');
		expect(partEntry?.lifecycle).toBe('accepted');

		// Edition is registered and resolvable via hasEdition.
		expect(productionRegistry.hasEdition('airboss-ref:regs/cfr-14/91/103' as SourceId, '2026')).toBe(true);
		expect(productionRegistry.hasEdition('airboss-ref:regs/cfr-14/91' as SourceId, '2026')).toBe(true);
	});

	test('is idempotent: re-running over the same manifest adds zero new entries', () => {
		writeManifest('14', '2026-04-22', {
			'91': [
				{
					id: 'airboss-ref:regs/cfr-14/91/103',
					canonical_short: '§91.103',
					canonical_title: 'Preflight action',
					last_amended_date: '2024-01-01',
					body_path: '91/91-103.md',
					body_sha256: 'sha',
				},
			],
		});
		const first = hydrateRegsFromDerivatives({ cwd: workDir });
		expect(first.entriesAdded).toBe(2);

		const second = hydrateRegsFromDerivatives({ cwd: workDir });
		expect(second.entriesAdded).toBe(0);
		expect(second.entriesAlreadyAccepted).toBe(2);
	});

	test('handles multiple editions across both Title 14 and Title 49', () => {
		writeManifest('14', '2026-04-22', {
			'91': [
				{
					id: 'airboss-ref:regs/cfr-14/91/103',
					canonical_short: '§91.103',
					canonical_title: 'Preflight action',
					last_amended_date: '2024-01-01',
					body_path: '91/91-103.md',
					body_sha256: 'sha',
				},
			],
		});
		writeManifest('49', '2026-04-20', {
			'830': [
				{
					id: 'airboss-ref:regs/cfr-49/830/5',
					canonical_short: '§830.5',
					canonical_title: 'Immediate notification',
					last_amended_date: '2010-01-01',
					body_path: '830/830-5.md',
					body_sha256: 'sha',
				},
			],
		});
		const report = hydrateRegsFromDerivatives({ cwd: workDir });
		expect(report.editionsHydrated).toBe(2);
		// 2 Parts + 2 Sections.
		expect(report.entriesAdded).toBe(4);

		expect(productionRegistry.getEntry('airboss-ref:regs/cfr-14/91' as SourceId)).not.toBeNull();
		expect(productionRegistry.getEntry('airboss-ref:regs/cfr-49/830' as SourceId)).not.toBeNull();
		expect(productionRegistry.getEntry('airboss-ref:regs/cfr-49/830/5' as SourceId)).not.toBeNull();
	});

	test('skips edition dirs missing manifest.json or sections.json', () => {
		const partial = join(workDir, 'regulations', 'cfr-14', 'broken');
		mkdirSync(partial, { recursive: true });
		writeFileSync(join(partial, 'manifest.json'), '{}', 'utf-8');
		// no sections.json
		const report = hydrateRegsFromDerivatives({ cwd: workDir });
		expect(report.editionsHydrated).toBe(0);
		expect(report.skipped).toHaveLength(1);
		expect(report.skipped[0]?.reason).toMatch(/missing/u);
	});
});

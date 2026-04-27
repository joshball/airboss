import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DerivativeWriteInput, writeDerivativeTree } from './derivative-writer.ts';
import { normalizeRawPart, normalizeRawSection, normalizeRawSubpart } from './normalizer.ts';

const PUBLISHED = new Date('2026-01-01');

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-deriv-'));
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
});

function buildInput(): DerivativeWriteInput {
	const part = normalizeRawPart(
		{ kind: 'part', title: '14', part: '91', headTitle: 'General Operating and Flight Rules' },
		{ publishedDate: PUBLISHED },
	);
	const subpart = normalizeRawSubpart(
		{ kind: 'subpart', title: '14', part: '91', subpart: 'b', headTitle: 'Flight Rules' },
		{ publishedDate: PUBLISHED },
	);
	const section103 = normalizeRawSection(
		{
			kind: 'section',
			title: '14',
			part: '91',
			subpart: 'b',
			section: '103',
			headTitle: 'Preflight action',
			bodyText: 'Each pilot in command shall...',
			amendedDate: '2008-09-05',
			reserved: false,
		},
		{ publishedDate: PUBLISHED },
	);

	return {
		title: '14',
		editionDate: '2026-01-01',
		editionSlug: '2026',
		outRoot: tmpRoot,
		sections: [section103],
		subparts: [subpart],
		parts: [part],
		manifest: {
			sourceUrl: 'file:///tmp/fixture.xml',
			sourceSha256: 'deadbeef',
			fetchedAt: '2026-01-01T00:00:00.000Z',
		},
	};
}

describe('writeDerivativeTree', () => {
	it('writes per-section markdown + meta json', () => {
		const input = buildInput();
		const report = writeDerivativeTree(input);
		expect(report.filesWritten).toBeGreaterThan(0);

		const editionDir = join(tmpRoot, 'cfr-14/2026-01-01');
		expect(existsSync(join(editionDir, '91/91-103.md'))).toBe(true);
		expect(existsSync(join(editionDir, '91/91-103.meta.json'))).toBe(true);
		expect(existsSync(join(editionDir, '91/subpart-b.md'))).toBe(true);
		expect(existsSync(join(editionDir, '91/index.md'))).toBe(true);
		expect(existsSync(join(editionDir, 'sections.json'))).toBe(true);
		expect(existsSync(join(editionDir, 'manifest.json'))).toBe(true);
	});

	it('manifest contains the documented fields', () => {
		writeDerivativeTree(buildInput());
		const manifest = JSON.parse(readFileSync(join(tmpRoot, 'cfr-14/2026-01-01/manifest.json'), 'utf-8'));
		expect(manifest.schemaVersion).toBe(1);
		expect(manifest.title).toBe('14');
		expect(manifest.editionSlug).toBe('2026');
		expect(manifest.editionDate).toBe('2026-01-01');
		expect(manifest.sourceUrl).toBe('file:///tmp/fixture.xml');
		expect(manifest.sourceSha256).toBe('deadbeef');
		expect(manifest.partCount).toBe(1);
		expect(manifest.subpartCount).toBe(1);
		expect(manifest.sectionCount).toBe(1);
	});

	it('sections.json contains a body_path + body_sha256 entry', () => {
		writeDerivativeTree(buildInput());
		const sectionsJson = JSON.parse(readFileSync(join(tmpRoot, 'cfr-14/2026-01-01/sections.json'), 'utf-8'));
		expect(sectionsJson.schemaVersion).toBe(1);
		expect(sectionsJson.edition).toBe('2026');
		expect(sectionsJson.sectionsByPart['91']).toHaveLength(1);
		const entry = sectionsJson.sectionsByPart['91'][0];
		expect(entry.id).toBe('airboss-ref:regs/cfr-14/91/103');
		expect(entry.body_path).toBe('91/91-103.md');
		expect(entry.body_sha256).toMatch(/^[a-f0-9]{64}$/);
	});

	it('second run with identical input is a no-op', () => {
		writeDerivativeTree(buildInput());
		const second = writeDerivativeTree(buildInput());
		expect(second.filesWritten).toBe(0);
		expect(second.filesUnchanged).toBeGreaterThan(0);
	});

	it('rewrites only the changed file when one body changes', () => {
		writeDerivativeTree(buildInput());
		const updatedInput = buildInput();
		const updatedSection = {
			...updatedInput.sections[0],
			bodyMarkdown: '# §91.103 Preflight action\n\nUpdated body.\n',
			bodyHashInput: '# §91.103 Preflight action\n\nUpdated body.\n',
		} as (typeof updatedInput.sections)[number];
		const next: DerivativeWriteInput = { ...updatedInput, sections: [updatedSection] };
		const report = writeDerivativeTree(next);
		// Modified files: the section markdown, its meta (sha changed), and sections.json (entry sha changed)
		expect(report.filesWritten).toBeGreaterThanOrEqual(2);
		expect(report.filesUnchanged).toBeGreaterThanOrEqual(2);
	});
});

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __derivative_writer_internal__, type DerivativeWriteInput, writeDerivativeTree } from './derivative-writer.ts';
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
		expect(manifest.kind).toBe('cfr');
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
		// Wave 2: each section entry carries its owning Subpart letter so
		// the seeder can attach the section row under the right Subpart row.
		expect(entry.subpart_id).toBe('b');
	});

	it('manifest carries per-Part subparts with section ownership (Wave 2)', () => {
		writeDerivativeTree(buildInput());
		const manifest = JSON.parse(readFileSync(join(tmpRoot, 'cfr-14/2026-01-01/manifest.json'), 'utf-8'));
		expect(manifest.parts).toHaveLength(1);
		const part91 = manifest.parts[0];
		expect(part91.number).toBe('91');
		expect(part91.subparts).toHaveLength(1);
		expect(part91.subparts[0].id).toBe('b');
		expect(part91.subparts[0].ordinal).toBe(0);
		expect(part91.subparts[0].title).toContain('Flight Rules');
		expect(part91.subparts[0].sections).toEqual(['91.103']);
	});

	it('second run with identical input is a no-op', () => {
		writeDerivativeTree(buildInput());
		const second = writeDerivativeTree(buildInput());
		expect(second.filesWritten).toBe(0);
		expect(second.filesUnchanged).toBeGreaterThan(0);
	});

	it('manifest includes a `sources` array when multi-source input is supplied', () => {
		const input = buildInput();
		const multi: DerivativeWriteInput = {
			...input,
			manifest: {
				...input.manifest,
				sources: [
					{ url: 'file:///tmp/part-830.xml', sha256: 'aa' },
					{ url: 'file:///tmp/part-1552.xml', sha256: 'bb' },
				],
			},
		};
		writeDerivativeTree(multi);
		const manifest = JSON.parse(readFileSync(join(tmpRoot, 'cfr-14/2026-01-01/manifest.json'), 'utf-8'));
		expect(manifest.sources).toHaveLength(2);
		expect(manifest.sources[0]).toEqual({ url: 'file:///tmp/part-830.xml', sha256: 'aa' });
	});

	it('manifest omits the `sources` field for single-source titles', () => {
		writeDerivativeTree(buildInput());
		const manifest = JSON.parse(readFileSync(join(tmpRoot, 'cfr-14/2026-01-01/manifest.json'), 'utf-8'));
		expect(manifest.sources).toBeUndefined();
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

describe('writeIfChanged (ADR 021 atomicity)', () => {
	it('happy path -- writes the file and leaves no .tmp sibling', () => {
		const target = join(tmpRoot, 'sub', 'happy.md');
		const result = __derivative_writer_internal__.writeIfChanged(target, '# hello\n');
		expect(result.wrote).toBe(true);
		expect(readFileSync(target, 'utf-8')).toBe('# hello\n');
		expect(existsSync(`${target}.tmp`)).toBe(false);
	});

	it('mid-write failure -- canonical path is never partially written', () => {
		// Force renameSync to fail by planting a non-empty directory at the
		// canonical path. The writer must throw and leave the directory
		// untouched -- never replace it with a partial file.
		const target = join(tmpRoot, 'sub', 'blocked.md');
		mkdirSync(dirname(target), { recursive: true });
		mkdirSync(target);
		writeFileSync(join(target, 'sentinel'), 'block', 'utf-8');

		expect(() => __derivative_writer_internal__.writeIfChanged(target, 'should not land')).toThrow();
		expect(statSync(target).isDirectory()).toBe(true);
		expect(existsSync(join(target, 'sentinel'))).toBe(true);
	});

	it('existing dest replaced atomically -- prior content fully overwritten', () => {
		const target = join(tmpRoot, 'sub', 'replaced.md');
		__derivative_writer_internal__.writeIfChanged(target, 'first');
		expect(readFileSync(target, 'utf-8')).toBe('first');
		__derivative_writer_internal__.writeIfChanged(target, 'second');
		expect(readFileSync(target, 'utf-8')).toBe('second');
		expect(existsSync(`${target}.tmp`)).toBe(false);
	});

	it('skips the write entirely when content is unchanged (no .tmp produced)', () => {
		const target = join(tmpRoot, 'sub', 'idempotent.md');
		__derivative_writer_internal__.writeIfChanged(target, 'hello');
		const second = __derivative_writer_internal__.writeIfChanged(target, 'hello');
		expect(second.wrote).toBe(false);
		expect(existsSync(`${target}.tmp`)).toBe(false);
	});
});

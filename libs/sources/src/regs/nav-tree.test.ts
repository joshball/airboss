/**
 * CFR navigation tree -- writer / loader / URL builder.
 *
 * Coverage:
 *   - URL builder per structural level (title / chapter / subchapter / part / section).
 *   - Round-trip: synthetic XML -> walker -> writeCfrNavTree -> getCfrNavTree
 *     yields the expected chapter / subchapter / part shape.
 *   - findChapterForPart returns the right context AND falls back to null
 *     when the part is not represented.
 *   - logUnmappedParts emits one warn line listing every unmapped part.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	__nav_tree_internal__,
	buildEcfrUrl,
	buildPartUrl,
	buildSectionUrl,
	findChapterForPart,
	getCfrNavTree,
	logUnmappedParts,
} from './nav-tree';
import { toYamlShape, writeCfrNavTree } from './nav-tree-writer';
import { walkRegsXml } from './xml-walker';

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

describe('buildEcfrUrl', () => {
	it('title only', () => {
		expect(buildEcfrUrl(14, {})).toBe('https://www.ecfr.gov/current/title-14');
	});

	it('title + chapter', () => {
		expect(buildEcfrUrl(14, { chapter: 'I' })).toBe('https://www.ecfr.gov/current/title-14/chapter-I');
	});

	it('title + chapter + subchapter', () => {
		expect(buildEcfrUrl(14, { chapter: 'I', subchapter: 'F' })).toBe(
			'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F',
		);
	});

	it('title + chapter + subchapter + part', () => {
		expect(buildEcfrUrl(14, { chapter: 'I', subchapter: 'F', part: '91' })).toBe(
			'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91',
		);
	});

	it('title + chapter + subchapter + part + section', () => {
		expect(buildEcfrUrl(14, { chapter: 'I', subchapter: 'F', part: '91', section: '91.103' })).toBe(
			'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/section-91.103',
		);
	});

	it('shortcut form -- part with no chapter context', () => {
		expect(buildEcfrUrl(14, { part: '91' })).toBe('https://www.ecfr.gov/current/title-14/part-91');
	});
});

// ---------------------------------------------------------------------------
// Round-trip via synthetic XML + tmpdir
// ---------------------------------------------------------------------------

const SYNTHETIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ECFR>
  <DIV1 N="14" TYPE="TITLE">
    <HEAD>Title 14 - Aeronautics and Space</HEAD>
    <DIV3 N="I" TYPE="CHAPTER">
      <HEAD>CHAPTER I - FEDERAL AVIATION ADMINISTRATION</HEAD>
      <DIV4 N="A" TYPE="SUBCHAP">
        <HEAD>SUBCHAPTER A - DEFINITIONS AND GENERAL REQUIREMENTS</HEAD>
        <DIV5 N="1" TYPE="PART">
          <HEAD>PART 1 - DEFINITIONS</HEAD>
          <DIV8 N="1.1" TYPE="SECTION"><HEAD>§ 1.1 General definitions.</HEAD><P>Body.</P></DIV8>
        </DIV5>
      </DIV4>
      <DIV4 N="F" TYPE="SUBCHAP">
        <HEAD>SUBCHAPTER F - AIR TRAFFIC AND GENERAL OPERATING RULES</HEAD>
        <DIV5 N="91" TYPE="PART">
          <HEAD>PART 91 - GENERAL OPERATING AND FLIGHT RULES</HEAD>
          <DIV8 N="91.103" TYPE="SECTION"><HEAD>§ 91.103 Preflight action.</HEAD><P>Body.</P></DIV8>
        </DIV5>
      </DIV4>
    </DIV3>
  </DIV1>
</ECFR>
`;

describe('walker -> writer -> loader round-trip', () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), 'nav-tree-'));
		process.env.AIRBOSS_REGS_ROOT = tmpRoot;
		__nav_tree_internal__.clearCache();
	});

	afterEach(() => {
		delete process.env.AIRBOSS_REGS_ROOT;
		__nav_tree_internal__.clearCache();
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it('walks synthetic XML, emits YAML, reloads it, and returns the right shape', async () => {
		const tree = walkRegsXml(SYNTHETIC_XML, { title: '14' });
		expect(tree.navTree).not.toBeNull();
		const raw = tree.navTree;
		if (raw === null) throw new Error('expected nav tree');
		mkdirSync(join(tmpRoot, 'cfr-14', '2026-04-22'), { recursive: true });
		const result = await writeCfrNavTree({
			title: 14,
			editionDate: '2026-04-22',
			outRoot: tmpRoot,
			raw,
		});
		expect(result.wrote).toBe(true);
		const yaml = readFileSync(result.path, 'utf8');
		expect(yaml).toContain('title: 14');
		expect(yaml).toContain('chapter');

		const loaded = getCfrNavTree(14, '2026-04-22');
		expect(loaded).not.toBeNull();
		if (loaded === null) throw new Error('expected loaded tree');
		expect(loaded.title).toBe(14);
		expect(loaded.chapters).toHaveLength(1);
		const chapter = loaded.chapters[0];
		if (!chapter) throw new Error('expected chapter');
		expect(chapter.id).toBe('I');
		expect(chapter.subchapters.map((s) => s.id).sort()).toEqual(['A', 'F']);
	});

	it('findChapterForPart returns the matched chapter / subchapter', async () => {
		const tree = walkRegsXml(SYNTHETIC_XML, { title: '14' });
		if (tree.navTree === null) throw new Error('expected nav tree');
		mkdirSync(join(tmpRoot, 'cfr-14', '2026-04-22'), { recursive: true });
		await writeCfrNavTree({ title: 14, editionDate: '2026-04-22', outRoot: tmpRoot, raw: tree.navTree });

		const loc91 = findChapterForPart(14, '91');
		expect(loc91).not.toBeNull();
		expect(loc91?.chapter.id).toBe('I');
		expect(loc91?.subchapter?.id).toBe('F');

		const loc1 = findChapterForPart(14, '1');
		expect(loc1?.subchapter?.id).toBe('A');

		expect(findChapterForPart(14, '999')).toBeNull();
	});

	it('buildPartUrl uses nav-tree context when available; shortcut otherwise', async () => {
		const tree = walkRegsXml(SYNTHETIC_XML, { title: '14' });
		if (tree.navTree === null) throw new Error('expected nav tree');
		mkdirSync(join(tmpRoot, 'cfr-14', '2026-04-22'), { recursive: true });
		await writeCfrNavTree({ title: 14, editionDate: '2026-04-22', outRoot: tmpRoot, raw: tree.navTree });

		expect(buildPartUrl(14, '91')).toBe('https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91');
		expect(buildPartUrl(14, '999')).toBe('https://www.ecfr.gov/current/title-14/part-999');
	});

	it('buildSectionUrl appends section segment with chapter context', async () => {
		const tree = walkRegsXml(SYNTHETIC_XML, { title: '14' });
		if (tree.navTree === null) throw new Error('expected nav tree');
		mkdirSync(join(tmpRoot, 'cfr-14', '2026-04-22'), { recursive: true });
		await writeCfrNavTree({ title: 14, editionDate: '2026-04-22', outRoot: tmpRoot, raw: tree.navTree });

		expect(buildSectionUrl(14, '91', '91.103')).toBe(
			'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/section-91.103',
		);
		// short-form section code (without part prefix) gets dotted with the part.
		expect(buildSectionUrl(14, '91', '103')).toBe(
			'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/section-91.103',
		);
	});

	it('logUnmappedParts emits one warn listing parts without chapter mapping', async () => {
		const tree = walkRegsXml(SYNTHETIC_XML, { title: '14' });
		if (tree.navTree === null) throw new Error('expected nav tree');
		mkdirSync(join(tmpRoot, 'cfr-14', '2026-04-22'), { recursive: true });
		await writeCfrNavTree({ title: 14, editionDate: '2026-04-22', outRoot: tmpRoot, raw: tree.navTree });

		const messages: string[] = [];
		logUnmappedParts(
			[
				{ title: 14, part: '91' },
				{ title: 14, part: '999' },
				{ title: 14, part: '888' },
			],
			{ warn: (m) => messages.push(m) },
		);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('999');
		expect(messages[0]).toContain('888');
		expect(messages[0]).not.toContain('Part 91,');
	});

	it('writer is idempotent -- second run with same input does not rewrite', async () => {
		const tree = walkRegsXml(SYNTHETIC_XML, { title: '14' });
		if (tree.navTree === null) throw new Error('expected nav tree');
		mkdirSync(join(tmpRoot, 'cfr-14', '2026-04-22'), { recursive: true });
		const first = await writeCfrNavTree({ title: 14, editionDate: '2026-04-22', outRoot: tmpRoot, raw: tree.navTree });
		expect(first.wrote).toBe(true);
		const second = await writeCfrNavTree({ title: 14, editionDate: '2026-04-22', outRoot: tmpRoot, raw: tree.navTree });
		expect(second.wrote).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// YAML shape
// ---------------------------------------------------------------------------

describe('YAML shape', () => {
	it('toYamlShape uses kebab-case keys', () => {
		const shape = toYamlShape(
			{
				title: '14',
				titleName: 'Aeronautics and Space',
				chapters: [
					{
						id: 'I',
						name: 'FAA',
						subchapters: [{ id: 'A', name: 'Definitions', parts: ['1'] }],
						directParts: [],
					},
				],
			},
			'2026-04-22',
		);
		expect(shape).toMatchObject({
			title: 14,
			'title-name': 'Aeronautics and Space',
			'edition-date': '2026-04-22',
		});
		expect(shape.chapters[0]?.subchapters?.[0]?.parts).toEqual(['1']);
	});

	it('fromYamlShape parses kebab-case keys back', () => {
		const parsed = __nav_tree_internal__.fromYamlShape(
			{
				title: 14,
				'title-name': 'Aeronautics',
				'edition-date': '2026-04-22',
				chapters: [{ id: 'I', name: 'FAA', subchapters: [{ id: 'F', name: 'Air Traffic', parts: ['91'] }] }],
			},
			14,
		);
		expect(parsed?.title).toBe(14);
		expect(parsed?.chapters[0]?.subchapters[0]?.parts).toEqual(['91']);
	});
});

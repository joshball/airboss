import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { __xml_walker_internal__, walkRegsXml } from './xml-walker.ts';

const FIXTURE_PATH = join(process.cwd(), 'tests/fixtures/cfr/title-14-2026-fixture.xml');

function loadFixture(): string {
	return readFileSync(FIXTURE_PATH, 'utf-8');
}

describe('walkRegsXml against title-14 fixture', () => {
	it('emits expected Parts', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const partNumbers = tree.parts.map((p) => p.part).sort();
		expect(partNumbers).toEqual(['61', '91']);
	});

	it('Part heads are title-cased', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const part91 = tree.parts.find((p) => p.part === '91');
		expect(part91?.headTitle).toBe('General Operating and Flight Rules');
	});

	it('emits expected subparts', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const part91Subs = tree.subparts
			.filter((s) => s.part === '91')
			.map((s) => s.subpart)
			.sort();
		expect(part91Subs).toEqual(['a', 'b']);
	});

	it('subpart heads strip the prefix', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const subB = tree.subparts.find((s) => s.part === '91' && s.subpart === 'b');
		expect(subB?.headTitle).toBe('Flight Rules');
	});

	it('emits expected sections', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const sectionIds = tree.sections.map((s) => `${s.part}.${s.section}`).sort();
		expect(sectionIds).toEqual(['61.3', '61.5', '91.1', '91.103', '91.149']);
	});

	it('extracts section title from HEAD', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const sec = tree.sections.find((s) => s.part === '91' && s.section === '103');
		expect(sec?.headTitle).toBe('Preflight action');
	});

	it('concatenates paragraph bodies with blank-line separators', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const sec = tree.sections.find((s) => s.part === '91' && s.section === '103');
		expect(sec?.bodyText).toMatch(/Each pilot in command shall/);
		expect(sec?.bodyText).toMatch(/\n\n\(a\)/);
		expect(sec?.bodyText).toMatch(/\n\n\(b\)/);
	});

	it('extracts last-amended date from CITA', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const sec = tree.sections.find((s) => s.part === '91' && s.section === '103');
		expect(sec?.amendedDate).toBe('2008-09-05');
	});

	it('parents sections under their subpart', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const sec = tree.sections.find((s) => s.part === '91' && s.section === '103');
		expect(sec?.subpart).toBe('b');
	});

	it('flags reserved sections', () => {
		const tree = walkRegsXml(loadFixture(), { title: '14' });
		const reserved = tree.sections.find((s) => s.section === '149');
		expect(reserved?.reserved).toBe(true);
		expect(reserved?.headTitle).toBe('[Reserved]');
	});
});

describe('partFilter', () => {
	it('keeps only parts in the filter set', () => {
		const tree = walkRegsXml(loadFixture(), {
			title: '14',
			partFilter: new Set(['91']),
		});
		expect(tree.parts.map((p) => p.part)).toEqual(['91']);
		expect(tree.sections.every((s) => s.part === '91')).toBe(true);
	});
});

describe('extractAmendedDate', () => {
	it('finds month-day-year format', () => {
		const date = __xml_walker_internal__.extractAmendedDate('[Doc. No. FAA, 74 FR 42551, Aug. 21, 2009]');
		expect(date).toBe('2009-08-21');
	});

	it('finds an ISO date if present', () => {
		const date = __xml_walker_internal__.extractAmendedDate('Effective 2024-09-15.');
		expect(date).toBe('2024-09-15');
	});

	it('returns null when no date present', () => {
		const date = __xml_walker_internal__.extractAmendedDate('No date here.');
		expect(date).toBeNull();
	});

	it('returns null on empty input', () => {
		expect(__xml_walker_internal__.extractAmendedDate('')).toBeNull();
	});
});

describe('extractSectionTitle', () => {
	it('strips section number and trailing period', () => {
		const t = __xml_walker_internal__.extractSectionTitle('§ 91.103 Preflight action.');
		expect(t).toBe('Preflight action');
	});

	it('handles em-dash separators', () => {
		const t = __xml_walker_internal__.extractSectionTitle('§ 91.103   Preflight action.');
		expect(t).toBe('Preflight action');
	});

	it('handles bare numbers', () => {
		const t = __xml_walker_internal__.extractSectionTitle('§ 5 NTSB notification.');
		expect(t).toBe('NTSB notification');
	});
});

describe('titleCase', () => {
	it('only re-cases all-uppercase input', () => {
		expect(__xml_walker_internal__.titleCase('GENERAL OPERATING AND FLIGHT RULES')).toBe(
			'General Operating and Flight Rules',
		);
	});

	it('leaves mixed-case unchanged', () => {
		expect(__xml_walker_internal__.titleCase('Already Mixed Case')).toBe('Already Mixed Case');
	});
});

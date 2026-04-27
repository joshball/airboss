import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	bodyPathForSection,
	locatorToManifestCode,
	manifestSectionForLocator,
	readManifest,
} from './derivative-reader.ts';
import { parseHandbooksLocator } from './locator.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/handbooks/phak-fixture');

function parseHandbook(loc: string) {
	const result = parseHandbooksLocator(loc);
	if (result.kind !== 'ok' || result.handbooks === undefined) {
		throw new Error(`expected ok, got: ${JSON.stringify(result)}`);
	}
	return result.handbooks;
}

describe('readManifest', () => {
	it('reads and validates the fixture manifest', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		expect(m.document_slug).toBe('phak');
		expect(m.edition).toBe('FAA-H-8083-25C');
		expect(m.sections).toHaveLength(4);
	});

	it('throws when manifest is missing', () => {
		expect(() => readManifest('FAA-H-NOPE', FIXTURE_ROOT, 'phak')).toThrow(/not found/);
	});
});

describe('locatorToManifestCode', () => {
	it('maps chapter-only', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/12'))).toBe('12');
	});

	it('maps chapter + section', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/12/3'))).toBe('12.3');
	});

	it('maps chapter + section + subsection', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/1/2/2'))).toBe('1.2.2');
	});

	it('maps paragraph to its section', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/12/3/para-2'))).toBe('12.3');
	});

	it('maps intro to its chapter', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/12/intro'))).toBe('12');
	});

	it('returns null for figure', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/fig-12-7'))).toBeNull();
	});

	it('returns null for table', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C/tbl-12-3'))).toBeNull();
	});

	it('returns null for whole-handbook', () => {
		expect(locatorToManifestCode(parseHandbook('phak/8083-25C'))).toBeNull();
	});
});

describe('manifestSectionForLocator', () => {
	it('finds a chapter', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		const section = manifestSectionForLocator(m, parseHandbook('phak/8083-25C/1'));
		expect(section).not.toBeNull();
		expect(section?.code).toBe('1');
		expect(section?.level).toBe('chapter');
	});

	it('finds a section', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		const section = manifestSectionForLocator(m, parseHandbook('phak/8083-25C/1/2'));
		expect(section).not.toBeNull();
		expect(section?.code).toBe('1.2');
		expect(section?.title).toBe('History of Flight');
	});

	it('finds a subsection', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		const section = manifestSectionForLocator(m, parseHandbook('phak/8083-25C/1/2/1'));
		expect(section).not.toBeNull();
		expect(section?.code).toBe('1.2.1');
	});

	it('returns null for an unknown code', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		const section = manifestSectionForLocator(m, parseHandbook('phak/8083-25C/99/9'));
		expect(section).toBeNull();
	});

	it('returns null for a figure', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		const section = manifestSectionForLocator(m, parseHandbook('phak/8083-25C/fig-12-7'));
		expect(section).toBeNull();
	});
});

describe('bodyPathForSection', () => {
	it('strips the leading handbooks/ prefix', () => {
		const m = readManifest('FAA-H-8083-25C', FIXTURE_ROOT, 'phak');
		const section = manifestSectionForLocator(m, parseHandbook('phak/8083-25C/1/2'));
		if (section === null) throw new Error('expected section');
		const path = bodyPathForSection(section, FIXTURE_ROOT);
		expect(path).toBe(join(FIXTURE_ROOT, 'phak/FAA-H-8083-25C/01/02-history-of-flight.md'));
	});
});

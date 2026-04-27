import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bodyPathForEntry, locatorToManifestCode, manifestEntryForLocator, readManifest } from './derivative-reader.ts';
import { parseAimLocator } from './locator.ts';

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/aim/aim-fixture/aim');

function parseAim(loc: string) {
	const result = parseAimLocator(loc);
	if (result.kind !== 'ok' || result.aim === undefined) {
		throw new Error(`expected ok, got: ${JSON.stringify(result)}`);
	}
	return result.aim;
}

describe('readManifest', () => {
	it('reads and validates the fixture manifest', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		expect(m.edition).toBe('2026-09');
		expect(m.kind).toBe('aim');
		expect(m.entries).toHaveLength(6);
	});

	it('throws when manifest is missing', () => {
		expect(() => readManifest('1999-01', FIXTURE_ROOT)).toThrow(/not found/);
	});
});

describe('locatorToManifestCode', () => {
	it('maps a chapter', () => {
		expect(locatorToManifestCode(parseAim('5'))).toBe('5');
	});

	it('maps a section', () => {
		expect(locatorToManifestCode(parseAim('5-1'))).toBe('5-1');
	});

	it('maps a paragraph', () => {
		expect(locatorToManifestCode(parseAim('5-1-7'))).toBe('5-1-7');
	});

	it('maps a glossary entry', () => {
		expect(locatorToManifestCode(parseAim('glossary/pilot-in-command'))).toBe('glossary/pilot-in-command');
	});

	it('maps an appendix', () => {
		expect(locatorToManifestCode(parseAim('appendix-1'))).toBe('appendix-1');
	});
});

describe('manifestEntryForLocator', () => {
	it('finds a chapter', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('5'));
		expect(entry).not.toBeNull();
		expect(entry?.code).toBe('5');
		expect(entry?.kind).toBe('chapter');
	});

	it('finds a section', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('5-1'));
		expect(entry).not.toBeNull();
		expect(entry?.code).toBe('5-1');
		expect(entry?.title).toBe('Preflight');
	});

	it('finds a paragraph', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('5-1-7'));
		expect(entry).not.toBeNull();
		expect(entry?.code).toBe('5-1-7');
		expect(entry?.title).toBe('Pilot Responsibility upon Clearance Issuance');
	});

	it('finds a glossary entry', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('glossary/pilot-in-command'));
		expect(entry).not.toBeNull();
		expect(entry?.code).toBe('glossary/pilot-in-command');
		expect(entry?.kind).toBe('glossary');
	});

	it('finds an appendix', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('appendix-1'));
		expect(entry).not.toBeNull();
		expect(entry?.code).toBe('appendix-1');
		expect(entry?.kind).toBe('appendix');
	});

	it('returns null for an unknown code', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('99-9-9'));
		expect(entry).toBeNull();
	});
});

describe('bodyPathForEntry', () => {
	it('strips the leading aim/ prefix and joins to the root', () => {
		const m = readManifest('2026-09', FIXTURE_ROOT);
		const entry = manifestEntryForLocator(m, parseAim('5-1-7'));
		if (entry === null) throw new Error('expected entry');
		const path = bodyPathForEntry(entry, FIXTURE_ROOT);
		expect(path).toBe(join(FIXTURE_ROOT, '2026-09/chapter-5/section-1/paragraph-7.md'));
	});

	it('handles a body_path that does not start with aim/', () => {
		const path = bodyPathForEntry(
			{
				kind: 'paragraph',
				code: '5-1-7',
				title: 'Pilot Responsibility upon Clearance Issuance',
				body_path: 'absolute/elsewhere.md',
				content_hash: 'abc',
			},
			FIXTURE_ROOT,
		);
		expect(path).toBe(join(FIXTURE_ROOT, 'absolute/elsewhere.md'));
	});
});

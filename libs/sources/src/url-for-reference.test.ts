import { ROUTES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { SourceId } from './types.ts';
import { urlForReference } from './url-for-reference.ts';

const id = (s: string): SourceId => s as SourceId;

describe('urlForReference -- handbooks', () => {
	it('maps a section-depth handbook URI to FLIGHTBAG_HANDBOOK_SECTION', () => {
		expect(urlForReference(id('airboss-ref:handbooks/phak/8083-25C/2/3'))).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '2', '3'),
		);
	});

	it('maps a chapter-depth handbook URI to FLIGHTBAG_HANDBOOK_CHAPTER', () => {
		expect(urlForReference(id('airboss-ref:handbooks/phak/8083-25C/2'))).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '2'),
		);
	});

	it('maps a whole-doc handbook URI to FLIGHTBAG_HANDBOOK', () => {
		expect(urlForReference(id('airboss-ref:handbooks/phak/8083-25C'))).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'),
		);
	});

	it('strips the ?at= pin before mapping', () => {
		expect(urlForReference(id('airboss-ref:handbooks/phak/8083-25C/2/3?at=8083-25C'))).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '2', '3'),
		);
	});

	it('falls back to home for malformed handbook locators', () => {
		expect(urlForReference(id('airboss-ref:handbooks/phak'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- aim', () => {
	it('maps an AIM paragraph URI to FLIGHTBAG_AIM_PARAGRAPH', () => {
		expect(urlForReference(id('airboss-ref:aim/5-1-7'))).toBe(ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7'));
	});

	it('falls back to home for chapter-only AIM URIs (no leaf route yet)', () => {
		expect(urlForReference(id('airboss-ref:aim/5'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to home for AIM glossary entries (no leaf route yet)', () => {
		expect(urlForReference(id('airboss-ref:aim/glossary/pilot-in-command'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- regs (CFR)', () => {
	it('maps a Title 14 section URI to FLIGHTBAG_CFR_SECTION', () => {
		expect(urlForReference(id('airboss-ref:regs/cfr-14/91/103'))).toBe(ROUTES.FLIGHTBAG_CFR_SECTION('14', '91', '103'));
	});

	it('maps a Title 49 section URI to FLIGHTBAG_CFR_SECTION', () => {
		expect(urlForReference(id('airboss-ref:regs/cfr-49/830/5'))).toBe(ROUTES.FLIGHTBAG_CFR_SECTION('49', '830', '5'));
	});

	it('maps a paragraph-depth CFR URI to the parent section', () => {
		expect(urlForReference(id('airboss-ref:regs/cfr-14/91/103/a/1'))).toBe(
			ROUTES.FLIGHTBAG_CFR_SECTION('14', '91', '103'),
		);
	});

	it('falls back to home for whole-Part CFR URIs (no leaf route yet)', () => {
		expect(urlForReference(id('airboss-ref:regs/cfr-14/91'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- ac', () => {
	it('maps an AC revision URI to FLIGHTBAG_AC', () => {
		expect(urlForReference(id('airboss-ref:ac/61-65/j'))).toBe(ROUTES.FLIGHTBAG_AC('61-65', 'j'));
	});

	it('handles dotted AC doc numbers', () => {
		expect(urlForReference(id('airboss-ref:ac/91-21.1/d'))).toBe(ROUTES.FLIGHTBAG_AC('91-21.1', 'd'));
	});

	it('section / change AC URIs resolve to the parent revision', () => {
		expect(urlForReference(id('airboss-ref:ac/61-65/j/section-3'))).toBe(ROUTES.FLIGHTBAG_AC('61-65', 'j'));
	});
});

describe('urlForReference -- acs', () => {
	it('maps an ACS task URI to FLIGHTBAG_ACS_TASK', () => {
		expect(urlForReference(id('airboss-ref:acs/ppl-airplane-6c/area-01/task-a'))).toBe(
			ROUTES.FLIGHTBAG_ACS_TASK('ppl-airplane-6c', '01', 'a'),
		);
	});

	it('element-depth ACS URI resolves to the parent task', () => {
		expect(urlForReference(id('airboss-ref:acs/ppl-airplane-6c/area-01/task-a/elem-k01'))).toBe(
			ROUTES.FLIGHTBAG_ACS_TASK('ppl-airplane-6c', '01', 'a'),
		);
	});

	it('falls back to home for whole-publication ACS URIs (no leaf route yet)', () => {
		expect(urlForReference(id('airboss-ref:acs/ppl-airplane-6c'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- error cases', () => {
	it('returns FLIGHTBAG_HOME for non-airboss-ref strings', () => {
		expect(urlForReference(id('https://example.com/foo'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('returns FLIGHTBAG_HOME for unknown corpora', () => {
		expect(urlForReference(id('airboss-ref:safo/23004'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

import { ROUTES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { SourceId } from './types.ts';
import { type ReferenceRowFields, urlForReference, urlForReferenceRow } from './url-for-reference.ts';

const id = (s: string): SourceId => s as SourceId;

/** Build a `ReferenceRowFields` literal for the row-shaped helper tests. */
function makeRow(overrides: Partial<ReferenceRowFields>): ReferenceRowFields {
	const base: ReferenceRowFields = {
		kind: 'handbook',
		documentSlug: 'phak',
		edition: '8083-25C',
	};
	return { ...base, ...overrides };
}

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

	it('normalises a full FAA edition designation in the URI to the short-edition URL', () => {
		// `study.reference_section.airboss_ref` persists the full designation
		// (`FAA-H-8083-16B`); the help loaders pass that URI verbatim.
		expect(urlForReference(id('airboss-ref:handbooks/iph/FAA-H-8083-16B/4'))).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('iph', '8083-16B', '4'),
		);
	});

	it('normalises a full-edition whole-doc handbook URI', () => {
		expect(urlForReference(id('airboss-ref:handbooks/iph/FAA-H-8083-16B'))).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK('iph', '8083-16B'),
		);
	});
});

describe('urlForReference -- aim', () => {
	it('maps an AIM paragraph URI to FLIGHTBAG_AIM_PARAGRAPH', () => {
		expect(urlForReference(id('airboss-ref:aim/5-1-7'))).toBe(ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7'));
	});

	it('maps an AIM chapter URI to FLIGHTBAG_AIM_CHAPTER', () => {
		expect(urlForReference(id('airboss-ref:aim/5'))).toBe(ROUTES.FLIGHTBAG_AIM_CHAPTER('5'));
	});

	it('maps an AIM section URI to FLIGHTBAG_AIM_SECTION', () => {
		expect(urlForReference(id('airboss-ref:aim/5-1'))).toBe(ROUTES.FLIGHTBAG_AIM_SECTION('5', '1'));
	});

	it('falls back to AIM landing for AIM glossary entries (no leaf route yet)', () => {
		expect(urlForReference(id('airboss-ref:aim/glossary/pilot-in-command'))).toBe(ROUTES.FLIGHTBAG_AIM);
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

	it('maps a whole-Part CFR URI to the Part landing', () => {
		expect(urlForReference(id('airboss-ref:regs/cfr-14/91'))).toBe(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
	});
});

describe('urlForReference -- ac', () => {
	it('maps an AC revision URI to FLIGHTBAG_AC', () => {
		expect(urlForReference(id('airboss-ref:ac/61-65/j'))).toBe(ROUTES.FLIGHTBAG_AC('61-65', 'j'));
	});

	it('handles dotted AC doc numbers', () => {
		expect(urlForReference(id('airboss-ref:ac/91-21.1/d'))).toBe(ROUTES.FLIGHTBAG_AC('91-21.1', 'd'));
	});

	it('section AC URIs resolve to the chapter view', () => {
		expect(urlForReference(id('airboss-ref:ac/61-65/j/section-3'))).toBe(
			ROUTES.FLIGHTBAG_AC_CHAPTER('61-65', 'j', '3'),
		);
	});

	it('change AC URIs resolve to the parent AC landing', () => {
		expect(urlForReference(id('airboss-ref:ac/61-65/j/change-1'))).toBe(ROUTES.FLIGHTBAG_AC('61-65', 'j'));
	});
});

describe('urlForReference -- acs', () => {
	it('maps an ACS task URI to FLIGHTBAG_ACS_TASK', () => {
		expect(urlForReference(id('airboss-ref:acs/ppl-airplane-acs-6c/area-01/task-a'))).toBe(
			ROUTES.FLIGHTBAG_ACS_TASK('ppl-airplane-acs-6c', '01', 'a'),
		);
	});

	it('element-depth ACS URI resolves to the parent task', () => {
		expect(urlForReference(id('airboss-ref:acs/ppl-airplane-acs-6c/area-01/task-a/elem-k01'))).toBe(
			ROUTES.FLIGHTBAG_ACS_TASK('ppl-airplane-acs-6c', '01', 'a'),
		);
	});

	it('whole-publication ACS URI maps to the publication landing', () => {
		expect(urlForReference(id('airboss-ref:acs/ppl-airplane-acs-6c'))).toBe(
			ROUTES.FLIGHTBAG_ACS('ppl-airplane-acs-6c'),
		);
	});
});

describe('urlForReference -- ntsb-alj', () => {
	it('parsable NTSB-ALJ URIs fall through to home until the route lands', () => {
		// `/ntsb-alj/[caseNumber]` is not implemented in the flightbag yet;
		// returning the would-be route would 404. Falling through to home
		// keeps the chip clickable.
		expect(urlForReference(id('airboss-ref:ntsb-alj/ea-5567'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('section-depth NTSB-ALJ URIs also fall through to home', () => {
		expect(urlForReference(id('airboss-ref:ntsb-alj/ea-5567/findings-of-fact'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to home for a malformed locator', () => {
		expect(urlForReference(id('airboss-ref:ntsb-alj/xy-1234'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- safo', () => {
	it('parsable SAFO URIs fall through to home until the route lands', () => {
		expect(urlForReference(id('airboss-ref:safo/23001'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('strips the ?at= pin before mapping', () => {
		expect(urlForReference(id('airboss-ref:safo/23004?at=2023'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to home for malformed SAFO locators', () => {
		expect(urlForReference(id('airboss-ref:safo/abcde'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- info', () => {
	it('parsable InFO URIs fall through to home until the route lands', () => {
		expect(urlForReference(id('airboss-ref:info/23006'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('strips the ?at= pin before mapping', () => {
		expect(urlForReference(id('airboss-ref:info/22008?at=2022'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to home for malformed InFO locators', () => {
		expect(urlForReference(id('airboss-ref:info/abc'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReference -- error cases', () => {
	it('returns FLIGHTBAG_HOME for non-airboss-ref strings', () => {
		expect(urlForReference(id('https://example.com/foo'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('returns FLIGHTBAG_HOME for unknown corpora (e.g. asrs)', () => {
		expect(urlForReference(id('airboss-ref:asrs/1234567'))).toBe(ROUTES.FLIGHTBAG_HOME);
	});
});

describe('urlForReferenceRow', () => {
	it('maps a handbook row to FLIGHTBAG_HANDBOOK(slug, edition)', () => {
		const row = makeRow({ kind: 'handbook', documentSlug: 'phak', edition: '8083-25C' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'));
	});

	it('maps an AFH handbook row carrying the full FAA edition label to the short-edition URL', () => {
		// `study.reference.edition` is the full designation `FAA-H-8083-3C`;
		// the flightbag handbook route + locator grammar use the short form.
		const row = makeRow({ kind: 'handbook', documentSlug: 'afh', edition: 'FAA-H-8083-3C' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HANDBOOK('afh', '8083-3C'));
	});

	it('maps a Title 14 CFR row to FLIGHTBAG_CFR_PART(title, part)', () => {
		const row = makeRow({ kind: 'cfr', documentSlug: '14cfr91', edition: '2024' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
	});

	it('maps a Title 49 CFR row to FLIGHTBAG_CFR_PART', () => {
		const row = makeRow({ kind: 'cfr', documentSlug: '49cfr830', edition: '2024' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_CFR_PART('49', '830'));
	});

	it('maps an AIM row to FLIGHTBAG_AIM', () => {
		const row = makeRow({ kind: 'aim', documentSlug: 'aim', edition: '2024' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_AIM);
	});

	it('maps a PCG row to FLIGHTBAG_AIM', () => {
		const row = makeRow({ kind: 'pcg', documentSlug: 'pcg', edition: '2024' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_AIM);
	});

	it('maps an AC row carrying the full FAA edition label to FLIGHTBAG_AC(doc, rev)', () => {
		const row = makeRow({ kind: 'ac', documentSlug: 'ac-61-65', edition: 'AC 61-65J' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_AC('61-65', 'j'));
	});

	it('falls back to FLIGHTBAG_HOME for an AC row with no revision letter', () => {
		const row = makeRow({ kind: 'ac', documentSlug: 'ac-60-22', edition: 'AC 60-22' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('maps an ACS row to FLIGHTBAG_ACS(slug)', () => {
		const row = makeRow({ kind: 'acs', documentSlug: 'ppl-airplane-acs-6c', edition: '6C' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_ACS('ppl-airplane-acs-6c'));
	});

	it('falls back to FLIGHTBAG_HOME for a PTS row (PTS slugs are not registered ACS publications)', () => {
		const row = makeRow({ kind: 'pts', documentSlug: 'cfi-airplane-pts', edition: '2023' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to FLIGHTBAG_HOME for a POH row (no per-aircraft reader yet)', () => {
		const row = makeRow({ kind: 'poh', documentSlug: 'c172n', edition: '1978' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to FLIGHTBAG_HOME for SAFO / INFO / NTSB / OTHER rows', () => {
		for (const kind of ['safo', 'info', 'ntsb', 'other'] as const) {
			const row = makeRow({ kind, documentSlug: 'doc-x', edition: '2024' });
			expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HOME);
		}
	});

	it('falls back to FLIGHTBAG_HOME for a handbook row with an empty edition', () => {
		const row = makeRow({ kind: 'handbook', documentSlug: 'phak', edition: '' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('falls back to FLIGHTBAG_HOME for a CFR row with a malformed documentSlug', () => {
		const row = makeRow({ kind: 'cfr', documentSlug: 'not-a-cfr-slug', edition: '2024' });
		expect(urlForReferenceRow(row)).toBe(ROUTES.FLIGHTBAG_HOME);
	});

	it('does not throw on any kind', () => {
		const row = makeRow({ kind: 'handbook', documentSlug: 'phak', edition: '' });
		expect(() => urlForReferenceRow(row)).not.toThrow();
	});
});

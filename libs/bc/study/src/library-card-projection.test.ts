/**
 * Library-card projection tests.
 *
 * Pure-function unit tests over `projectReferenceToLibraryCard`. The
 * function takes a `ReferenceRow` and a precomputed `isReadable` flag and
 * returns a discriminated `LibraryCardPayload`. No DB access -- no fixtures
 * required beyond synthesised row literals.
 */

import { CERT_APPLICABILITIES, REFERENCE_KINDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { projectReferenceToLibraryCard } from './library-card-projection';
import type { ReferenceRow } from './schema';

function makeRow(overrides: Partial<ReferenceRow>): ReferenceRow {
	const base: ReferenceRow = {
		id: 'ref_TEST',
		kind: REFERENCE_KINDS.HANDBOOK,
		documentSlug: 'test-doc',
		edition: '2024',
		title: 'Test Title',
		publisher: 'Test Publisher',
		url: null,
		primaryCert: CERT_APPLICABILITIES.PRIVATE,
		subjects: [],
		sectionSchema: {},
		metadata: {},
		seedOrigin: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	return { ...base, ...overrides };
}

describe('projectReferenceToLibraryCard', () => {
	it('handbook -> HandbookCard with flightbag-direct reader href when readable', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'phak',
			title: "Pilot's Handbook of Aeronautical Knowledge",
			publisher: 'FAA',
			edition: 'FAA-H-8083-25C',
			subjects: ['weather', 'aerodynamics'],
			metadata: { description: 'desc', whyItMatters: 'why' },
		});
		const payload = projectReferenceToLibraryCard(row, true);
		expect(payload.variant).toBe('HandbookCard');
		if (payload.variant !== 'HandbookCard') return;
		expect(payload.props.shortSlug).toBe('phak');
		// Flightbag-direct path; the full FAA edition is shortened to the
		// form the flightbag handbook route expects.
		expect(payload.props.href).toBe('/handbook/phak/8083-25C');
		expect(payload.props.publisher).toBe('FAA');
		expect(payload.props.description).toBe('desc');
		expect(payload.props.whyItMatters).toBe('why');
		expect(payload.props.topics.map((t) => t.value)).toEqual(['weather', 'aerodynamics']);
	});

	it('handbook -> HandbookCard falls back to the flightbag landing when not readable', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'phak',
			edition: 'FAA-H-8083-25C',
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('HandbookCard');
		if (payload.variant !== 'HandbookCard') return;
		expect(payload.props.href).toBe('/');
	});

	it('cfr part slug -> CfrPartCard with eCFR external + part-derived href', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.CFR,
			documentSlug: '14cfr91',
			title: '14 CFR Part 91',
			publisher: 'FAA',
			metadata: { officialTitle: 'General Operating and Flight Rules', topics: ['airspace'] },
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('CfrPartCard');
		if (payload.variant !== 'CfrPartCard') return;
		expect(payload.props.titleNumber).toBe(14);
		expect(payload.props.partNumber).toBe('91');
		expect(payload.props.partTitle).toBe('General Operating and Flight Rules');
		expect(payload.props.external.url).toContain('title-14');
		expect(payload.props.href).toBe(payload.props.external.url);
		expect(payload.props.topics.map((t) => t.value)).toEqual(['airspace']);
	});

	it('acs -> AcsCard with edition + subjects-as-topics', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.ACS,
			documentSlug: 'acs-private',
			title: 'Private Pilot ACS',
			edition: 'FAA-S-ACS-6B',
			subjects: ['areas-of-operation'],
			metadata: { description: 'desc' },
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('AcsCard');
		if (payload.variant !== 'AcsCard') return;
		expect(payload.props.slug).toBe('acs-private');
		expect(payload.props.edition).toBe('FAA-S-ACS-6B');
		expect(payload.props.topics.map((t) => t.value)).toEqual(['areas-of-operation']);
	});

	it('aim -> AimCorpusCard with kindBadge AIM and edition coerced from "-"', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.AIM,
			edition: '-',
			metadata: { description: 'desc', whyItMatters: 'why' },
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('AimCorpusCard');
		if (payload.variant !== 'AimCorpusCard') return;
		expect(payload.props.kindBadge).toBe('AIM');
		expect(payload.props.edition).toBeNull();
	});

	it('pcg -> AimCorpusCard with kindBadge PCG', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.PCG,
			edition: '2024',
			metadata: { description: 'd', whyItMatters: 'w' },
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('AimCorpusCard');
		if (payload.variant !== 'AimCorpusCard') return;
		expect(payload.props.kindBadge).toBe('PCG');
	});

	it('ac -> AcCard strips ac- prefix from documentSlug for acNumber', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.AC,
			documentSlug: 'ac-61-83k',
			title: 'CFI Refresher',
			edition: 'K',
			url: 'https://faa.gov/whatever',
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('AcCard');
		if (payload.variant !== 'AcCard') return;
		expect(payload.props.acNumber).toBe('61-83k');
		expect(payload.props.external?.url).toBe('https://faa.gov/whatever');
	});

	it('ntsb -> NtsbCard surfaces date from metadata', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.NTSB,
			documentSlug: 'aar-23-04',
			title: 'Some Crash',
			metadata: { description: 'summary', date: '2023-01-01' },
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('NtsbCard');
		if (payload.variant !== 'NtsbCard') return;
		expect(payload.props.reportNumber).toBe('aar-23-04');
		expect(payload.props.date).toBe('2023-01-01');
		expect(payload.props.summary).toBe('summary');
	});

	it('poh -> PohCard uses metadata.aircraftModel/manufacturer when present', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.POH,
			documentSlug: 'cessna-172s-phak',
			title: 'C172S POH',
			edition: '5',
			publisher: 'Cessna',
			metadata: {
				aircraftModel: 'C172S',
				manufacturer: 'Cessna',
				description: 'd',
				whyItMatters: 'w',
				topics: ['systems'],
			},
			url: 'https://cessna.example/poh',
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('PohCard');
		if (payload.variant !== 'PohCard') return;
		expect(payload.props.aircraftModel).toBe('C172S');
		expect(payload.props.manufacturer).toBe('Cessna');
		// Chrome-only: no flightbag per-aircraft reader yet, so the POH card
		// body is not a link. The manufacturer external link is preserved.
		expect(payload.props.href).toBeNull();
		expect(payload.props.external?.label).toBe('Cessna');
		expect(payload.props.topics.map((t) => t.value)).toEqual(['systems']);
	});

	it('poh -> PohCard always emits href: null (chrome-only)', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.POH,
			documentSlug: 'piper-pa28-poh',
			title: 'PA-28 POH',
			edition: '3',
			publisher: 'Piper',
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('PohCard');
		if (payload.variant !== 'PohCard') return;
		expect(payload.props.href).toBeNull();
	});

	it('safo + info -> Safo/InfoCard with audience + date', () => {
		const safo = projectReferenceToLibraryCard(
			makeRow({
				kind: REFERENCE_KINDS.SAFO,
				documentSlug: '23001',
				title: 'Stall Awareness',
				metadata: { description: 'sum', date: '2023-04-01', audience: 'CFI' },
			}),
			false,
		);
		expect(safo.variant).toBe('SafoCard');
		if (safo.variant === 'SafoCard') {
			expect(safo.props.safoNumber).toBe('23001');
			expect(safo.props.audience).toBe('CFI');
		}

		const info = projectReferenceToLibraryCard(
			makeRow({
				kind: REFERENCE_KINDS.INFO,
				documentSlug: '23002',
				title: 'Info Bulletin',
				metadata: { description: 'sum', date: '2023-05-01', audience: 'all' },
			}),
			false,
		);
		expect(info.variant).toBe('InfoCard');
		if (info.variant === 'InfoCard') {
			expect(info.props.infoNumber).toBe('23002');
			expect(info.props.audience).toBe('all');
		}
	});

	it('other -> UmbrellaCard with edition as identifier when authored', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.OTHER,
			edition: 'v3',
			title: 'Misc',
			metadata: { description: 'd', whyItMatters: 'w' },
		});
		const payload = projectReferenceToLibraryCard(row, false);
		expect(payload.variant).toBe('UmbrellaCard');
		if (payload.variant !== 'UmbrellaCard') return;
		expect(payload.props.identifier).toBe('v3');
	});

	it('treats empty-string metadata fields as missing', () => {
		const row = makeRow({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'phak',
			metadata: { description: '', whyItMatters: '   ' },
		});
		const payload = projectReferenceToLibraryCard(row, true);
		if (payload.variant !== 'HandbookCard') throw new Error('expected HandbookCard');
		expect(payload.props.description).toBeNull();
		expect(payload.props.whyItMatters).toBeNull();
	});
});

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { HelpPage } from './schema/help-page';
import { validateHelpPages } from './validation';

function makePage(overrides: Partial<HelpPage>): HelpPage {
	return {
		id: 'page-1',
		title: 'Sample',
		summary: 'A sample help page.',
		tags: {
			appSurface: [APP_SURFACES.GLOBAL],
			helpKind: HELP_KINDS.CONCEPT,
		},
		sections: [{ id: 'lede', title: 'Overview', body: 'Body text.' }],
		...overrides,
	};
}

const noAviation = { hasAviationReference: () => false };

describe('validateHelpPages - required tag axes', () => {
	it('passes on a well-formed page', () => {
		const { errors } = validateHelpPages([makePage({})], noAviation);
		expect(errors).toHaveLength(0);
	});

	it('errors when appSurface is missing', () => {
		const page = makePage({
			tags: { appSurface: [] as never, helpKind: HELP_KINDS.CONCEPT },
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('appSurface'))).toBe(true);
	});

	it('errors when appSurface contains an invalid enum value', () => {
		const page = makePage({
			tags: { appSurface: ['made-up'] as never, helpKind: HELP_KINDS.CONCEPT },
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes("invalid appSurface 'made-up'"))).toBe(true);
	});

	it('errors when helpKind is invalid', () => {
		const page = makePage({
			tags: { appSurface: [APP_SURFACES.GLOBAL], helpKind: 'bogus' as never },
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('invalid helpKind'))).toBe(true);
	});

	it('errors on > APP_SURFACE_MAX surfaces', () => {
		const page = makePage({
			tags: {
				appSurface: [APP_SURFACES.DASHBOARD, APP_SURFACES.MEMORY, APP_SURFACES.REPS, APP_SURFACES.SESSION],
				helpKind: HELP_KINDS.CONCEPT,
			},
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('appSurface entries'))).toBe(true);
	});

	it('errors on duplicate appSurface', () => {
		const page = makePage({
			tags: { appSurface: [APP_SURFACES.GLOBAL, APP_SURFACES.GLOBAL], helpKind: HELP_KINDS.CONCEPT },
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('duplicate appSurface'))).toBe(true);
	});
});

describe('validateHelpPages - uniqueness', () => {
	it('errors on duplicate page ids', () => {
		const pages = [makePage({ id: 'dup' }), makePage({ id: 'dup', title: 'Another' })];
		const { errors } = validateHelpPages(pages, noAviation);
		expect(errors.some((e) => e.message.includes("Duplicate help-page id 'dup'"))).toBe(true);
	});

	it('errors on duplicate section ids within a page', () => {
		const page = makePage({
			sections: [
				{ id: 'lede', title: 'A', body: 'x' },
				{ id: 'lede', title: 'B', body: 'y' },
			],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes("duplicate section id 'lede'"))).toBe(true);
	});
});

describe('validateHelpPages - documents path shape', () => {
	it('errors when documents does not start with /', () => {
		const page = makePage({ documents: 'calibration' });
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('invalid documents path'))).toBe(true);
	});

	it('accepts a documents path starting with /', () => {
		const page = makePage({ documents: '/calibration' });
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors).toHaveLength(0);
	});
});

describe('validateHelpPages - related resolution', () => {
	it('errors when related id resolves to nothing', () => {
		const page = makePage({ related: ['missing-id'] });
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes("'missing-id'"))).toBe(true);
	});

	it('accepts related id resolving to another help page', () => {
		const a = makePage({ id: 'a', related: ['b'] });
		const b = makePage({ id: 'b', related: ['a'] });
		const { errors } = validateHelpPages([a, b], noAviation);
		expect(errors).toHaveLength(0);
	});

	it('accepts related id resolving to an aviation reference', () => {
		const page = makePage({ related: ['term-metar'] });
		const { errors } = validateHelpPages([page], { hasAviationReference: (id) => id === 'term-metar' });
		expect(errors).toHaveLength(0);
	});
});

describe('validateHelpPages - wiki-link gates', () => {
	it('errors on unknown wiki-link id in body', () => {
		const page = makePage({
			sections: [{ id: 'lede', title: 'Lede', body: 'See [[X::bogus-id]] for more.' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes("unknown id 'bogus-id'"))).toBe(true);
	});

	it('accepts wiki-link to aviation reference', () => {
		const page = makePage({
			sections: [{ id: 'lede', title: 'Lede', body: 'See [[METAR::term-metar]] for more.' }],
		});
		const { errors } = validateHelpPages([page], { hasAviationReference: (id) => id === 'term-metar' });
		expect(errors).toHaveLength(0);
	});

	it('accepts wiki-link to another help page', () => {
		const target = makePage({ id: 'target' });
		const source = makePage({
			id: 'source',
			sections: [{ id: 'lede', title: 'Lede', body: 'See [[Target::target]] for more.' }],
		});
		const { errors } = validateHelpPages([source, target], noAviation);
		expect(errors).toHaveLength(0);
	});

	it('TBD-id wiki-link does not error', () => {
		const page = makePage({
			sections: [{ id: 'lede', title: 'Lede', body: 'Soon: [[TBD term::]].' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors).toHaveLength(0);
	});
});

describe('validateHelpPages - keyword gates', () => {
	it('errors on banned keyword', () => {
		const page = makePage({
			tags: {
				appSurface: [APP_SURFACES.GLOBAL],
				helpKind: HELP_KINDS.CONCEPT,
				keywords: ['cfi-knowledge'],
			},
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('banned zombie keyword'))).toBe(true);
	});

	it('errors on overly long keyword', () => {
		const page = makePage({
			tags: {
				appSurface: [APP_SURFACES.GLOBAL],
				helpKind: HELP_KINDS.CONCEPT,
				keywords: ['x'.repeat(41)],
			},
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('exceeds'))).toBe(true);
	});
});

describe('validateHelpPages - externalRefs', () => {
	it('errors on missing title', () => {
		const page = makePage({
			externalRefs: [{ title: '', url: 'https://example.org', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('missing title'))).toBe(true);
	});

	it('errors on missing url', () => {
		const page = makePage({
			externalRefs: [{ title: 'Sample', url: '', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('missing url'))).toBe(true);
	});

	it('errors on invalid source enum', () => {
		const page = makePage({
			externalRefs: [{ title: 'Sample', url: 'https://example.org', source: 'blog' as never }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes("invalid source 'blog'"))).toBe(true);
	});

	it('errors on unparseable url', () => {
		const page = makePage({
			externalRefs: [{ title: 'Sample', url: 'not a url', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('unparseable url'))).toBe(true);
	});

	it('errors on non-http(s) protocol', () => {
		const page = makePage({
			externalRefs: [{ title: 'Sample', url: 'ftp://example.org/x', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('must use http or https'))).toBe(true);
	});

	it('warns when url is http (not https)', () => {
		const page = makePage({
			externalRefs: [{ title: 'Sample', url: 'http://example.org/x', source: 'other' }],
		});
		const { warnings } = validateHelpPages([page], noAviation);
		expect(warnings.some((w) => w.message.includes('uses http (not https)'))).toBe(true);
	});

	it('errors on localhost host', () => {
		const page = makePage({
			externalRefs: [{ title: 'Local', url: 'https://localhost:9600/x', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('private-network host'))).toBe(true);
	});

	it('errors on RFC1918 10.x host', () => {
		const page = makePage({
			externalRefs: [{ title: 'Local', url: 'https://10.0.0.5/x', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('private-network host'))).toBe(true);
	});

	it('errors on RFC1918 192.168.x host', () => {
		const page = makePage({
			externalRefs: [{ title: 'Local', url: 'https://192.168.1.1/x', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('private-network host'))).toBe(true);
	});

	it('errors on 127.x host', () => {
		const page = makePage({
			externalRefs: [{ title: 'Local', url: 'https://127.0.0.1/x', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('private-network host'))).toBe(true);
	});

	it('errors on *.local hostname', () => {
		const page = makePage({
			externalRefs: [{ title: 'Local', url: 'https://box.local/x', source: 'other' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('private-network host'))).toBe(true);
	});

	it('accepts a well-formed https external reference', () => {
		const page = makePage({
			externalRefs: [{ title: 'Wikipedia FSRS', url: 'https://en.wikipedia.org/wiki/FSRS', source: 'wikipedia' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors).toHaveLength(0);
	});
});

describe('validateHelpPages - concept / helpKind consistency', () => {
	it('errors when concept: true but helpKind is not concept', () => {
		const page = makePage({
			concept: true,
			tags: { appSurface: [APP_SURFACES.GLOBAL], helpKind: HELP_KINDS.REFERENCE },
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('concept: true'))).toBe(true);
	});

	it('warns when concept: true but no externalRefs', () => {
		const page = makePage({ concept: true });
		const { warnings } = validateHelpPages([page], noAviation);
		expect(warnings.some((w) => w.message.includes('no externalRefs'))).toBe(true);
	});

	it('does not warn about externalRefs when concept has at least one', () => {
		const page = makePage({
			concept: true,
			externalRefs: [{ title: 'Wiki', url: 'https://wikipedia.org/x', source: 'wikipedia' }],
		});
		const { warnings } = validateHelpPages([page], noAviation);
		expect(warnings.some((w) => w.message.includes('no externalRefs'))).toBe(false);
	});
});

describe('validateHelpPages - callout variants', () => {
	it('errors on unknown callout variant', () => {
		const page = makePage({
			sections: [{ id: 'lede', title: 'Lede', body: ':::mystery\nBody.\n:::' }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes("unknown callout variant ':::mystery'"))).toBe(true);
	});

	it('accepts all known callout variants', () => {
		const body = [
			':::tip',
			'A tip.',
			':::',
			':::note',
			'A note.',
			':::',
			':::warn',
			'A warn.',
			':::',
			':::danger',
			'A danger.',
			':::',
			':::howto',
			'A howto.',
			':::',
			':::example',
			'An example.',
			':::',
		].join('\n');
		const page = makePage({
			sections: [{ id: 'lede', title: 'Lede', body }],
		});
		const { errors } = validateHelpPages([page], noAviation);
		expect(errors.some((e) => e.message.includes('unknown callout variant'))).toBe(false);
	});
});

describe('validateHelpPages - warnings', () => {
	it('warns on orphan pages', () => {
		const orphan = makePage({ id: 'orphan' });
		const { warnings } = validateHelpPages([orphan], noAviation);
		expect(warnings.some((w) => w.message.includes('orphan'))).toBe(true);
	});

	it('warns on empty section body', () => {
		const page = makePage({
			sections: [{ id: 'lede', title: 'Lede', body: '' }],
		});
		const { warnings } = validateHelpPages([page], noAviation);
		expect(warnings.some((w) => w.message.includes('empty body'))).toBe(true);
	});

	it('warns on stale reviewedAt', () => {
		const page = makePage({ reviewedAt: '2020-01-01' });
		const { warnings } = validateHelpPages([page], noAviation);
		expect(warnings.some((w) => w.message.includes('> 12 months'))).toBe(true);
	});
});

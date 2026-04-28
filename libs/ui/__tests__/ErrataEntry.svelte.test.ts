/**
 * ErrataEntry DOM contract -- header citation metadata, anchor line,
 * per-patch-kind body (added / appended / replaced + word diff).
 */

import { HANDBOOK_ERRATA_PATCH_KINDS } from '@ab/constants';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ErrataEntry, { type ErrataEntryDisplay } from '../src/handbooks/ErrataEntry.svelte';

afterEach(() => {
	cleanup();
});

const baseEntry: ErrataEntryDisplay = {
	id: 'hbe_01',
	errataId: 'mosaic',
	publishedAt: '2025-10-22',
	appliedAt: '2025-11-01T12:00:00.000Z',
	sourceUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
	patchKind: HANDBOOK_ERRATA_PATCH_KINDS.ADD_SUBSECTION,
	targetAnchor: 'Light-sport aircraft',
	targetPage: '2-9',
	originalText: null,
	replacementText: 'New subsection text added by MOSAIC.',
};

describe('ErrataEntry -- header', () => {
	it('renders the errata id, published date, and source link', () => {
		const { container } = render(ErrataEntry, { entry: baseEntry });
		const article = container.querySelector('article.errata-entry');
		expect(article).toBeTruthy();
		expect(article?.textContent).toContain('mosaic');
		expect(article?.textContent).toContain('Oct 22, 2025');
		const link = article?.querySelector('a.source-link');
		expect(link?.getAttribute('href')).toBe(baseEntry.sourceUrl);
		expect(link?.getAttribute('target')).toBe('_blank');
	});

	it('renders the patch-kind label from constants', () => {
		const { container } = render(ErrataEntry, { entry: baseEntry });
		const label = container.querySelector('.patch-kind');
		expect(label?.textContent?.trim()).toBe('Subsection added');
	});

	it('passes patchKind through as a data attribute', () => {
		const { container } = render(ErrataEntry, { entry: baseEntry });
		expect(container.querySelector('article.errata-entry')?.getAttribute('data-patch-kind')).toBe('add_subsection');
	});
});

describe('ErrataEntry -- anchor line', () => {
	it('renders the targetAnchor when present', () => {
		const { container } = render(ErrataEntry, { entry: baseEntry });
		const anchor = container.querySelector('.anchor');
		expect(anchor?.textContent).toContain('Light-sport aircraft');
		expect(anchor?.textContent).toContain('2-9');
	});

	it('falls back to "Page <page>" when targetAnchor is null', () => {
		const { container } = render(ErrataEntry, { entry: { ...baseEntry, targetAnchor: null } });
		const anchor = container.querySelector('.anchor');
		expect(anchor?.textContent?.trim()).toBe('Page 2-9');
	});
});

describe('ErrataEntry -- per-kind body', () => {
	it('add_subsection: renders an "Added" framed block with replacement text', () => {
		const { container } = render(ErrataEntry, { entry: baseEntry });
		const body = container.querySelector('.body.added');
		expect(body).toBeTruthy();
		expect(body?.textContent).toContain('Added');
		expect(body?.textContent).toContain('New subsection text added by MOSAIC.');
	});

	it('append_paragraph: renders an "Appended" framed block', () => {
		const { container } = render(ErrataEntry, {
			entry: {
				...baseEntry,
				patchKind: HANDBOOK_ERRATA_PATCH_KINDS.APPEND_PARAGRAPH,
				replacementText: 'New paragraph appended.',
			},
		});
		const body = container.querySelector('.body.appended');
		expect(body).toBeTruthy();
		expect(body?.textContent).toContain('Appended');
		expect(body?.textContent).toContain('New paragraph appended.');
	});

	it('replace_paragraph: renders a diff with <del> and <ins> for changed words', () => {
		const { container } = render(ErrataEntry, {
			entry: {
				...baseEntry,
				patchKind: HANDBOOK_ERRATA_PATCH_KINDS.REPLACE_PARAGRAPH,
				originalText: 'The old wording stands here.',
				replacementText: 'The new wording stands here.',
			},
		});
		const body = container.querySelector('.body.replaced');
		expect(body).toBeTruthy();
		expect(body?.textContent).toContain('Revised');
		const dels = body?.querySelectorAll('del') ?? [];
		const ins = body?.querySelectorAll('ins') ?? [];
		expect(dels.length).toBeGreaterThan(0);
		expect(ins.length).toBeGreaterThan(0);
		const delText = Array.from(dels)
			.map((n) => n.textContent ?? '')
			.join('');
		const insText = Array.from(ins)
			.map((n) => n.textContent ?? '')
			.join('');
		expect(delText).toContain('old');
		expect(insText).toContain('new');
	});

	it('replace_paragraph with null originalText: bails on diff (no body)', () => {
		// Defensive: validator forbids null originalText for replace_paragraph,
		// but the component must not crash if it ever sees one.
		const { container } = render(ErrataEntry, {
			entry: {
				...baseEntry,
				patchKind: HANDBOOK_ERRATA_PATCH_KINDS.REPLACE_PARAGRAPH,
				originalText: null,
				replacementText: 'replacement',
			},
		});
		// The replaced body still renders because the template branches on
		// patchKind, but the diff inside is empty -- no <del>/<ins> at all.
		const body = container.querySelector('.body.replaced');
		expect(body).toBeTruthy();
		expect(body?.querySelectorAll('del').length).toBe(0);
		expect(body?.querySelectorAll('ins').length).toBe(0);
	});
});

describe('ErrataEntry -- date formatting', () => {
	it('formats ISO yyyy-mm-dd as "Mon D, YYYY"', () => {
		const { container } = render(ErrataEntry, { entry: { ...baseEntry, publishedAt: '2026-01-05' } });
		expect(container.querySelector('.published')?.textContent).toBe('Jan 5, 2026');
	});

	it('falls back to the raw string for unparseable input', () => {
		const { container } = render(ErrataEntry, { entry: { ...baseEntry, publishedAt: '2026' } });
		expect(container.querySelector('.published')?.textContent).toBe('2026');
	});
});

/**
 * AmendmentPanel DOM contract -- empty entries renders nothing, populated
 * entries shows badge + count, click toggles the panel body, ErrataEntry
 * rows mount inside.
 */

import { HANDBOOK_AMENDMENT_BADGE_LABEL, HANDBOOK_ERRATA_PATCH_KINDS } from '@ab/constants';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ErrataEntryDisplay } from '../src/handbooks/ErrataEntry.svelte';
import AmendmentPanel from '../src/handbooks/AmendmentPanel.svelte';

afterEach(() => {
	cleanup();
});

const sampleEntry: ErrataEntryDisplay = {
	id: 'hbe_01',
	errataId: 'mosaic',
	publishedAt: '2025-10-22',
	appliedAt: '2025-11-01T12:00:00.000Z',
	sourceUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf',
	patchKind: HANDBOOK_ERRATA_PATCH_KINDS.APPEND_PARAGRAPH,
	targetAnchor: null,
	targetPage: '2-9',
	originalText: null,
	replacementText: 'Added paragraph.',
};

describe('AmendmentPanel -- empty', () => {
	it('renders nothing when entries is empty', () => {
		const { container } = render(AmendmentPanel, { entries: [] });
		expect(container.querySelector('[data-testid="amendment-panel"]')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});
});

describe('AmendmentPanel -- populated', () => {
	it('renders the badge with the configured label and count', () => {
		render(AmendmentPanel, { entries: [sampleEntry] });
		const badge = screen.getByTestId('amendment-panel-badge');
		expect(badge.textContent).toContain(HANDBOOK_AMENDMENT_BADGE_LABEL);
		expect(badge.textContent).toContain('1');
	});

	it('badge is a button with aria-expanded=false by default', () => {
		render(AmendmentPanel, { entries: [sampleEntry] });
		const badge = screen.getByTestId('amendment-panel-badge');
		expect(badge.tagName).toBe('BUTTON');
		expect(badge.getAttribute('aria-expanded')).toBe('false');
	});

	it('does not render the panel body before click', () => {
		render(AmendmentPanel, { entries: [sampleEntry] });
		expect(screen.queryByTestId('amendment-panel-body')).toBeNull();
	});

	it('renders panel body and child ErrataEntry rows after click', async () => {
		render(AmendmentPanel, { entries: [sampleEntry] });
		const badge = screen.getByTestId('amendment-panel-badge');
		await fireEvent.click(badge);
		const body = screen.getByTestId('amendment-panel-body');
		expect(body).toBeTruthy();
		expect(badge.getAttribute('aria-expanded')).toBe('true');
		// ErrataEntry mounted inside.
		expect(body.querySelector('article.errata-entry')).toBeTruthy();
		expect(body.textContent).toContain(HANDBOOK_AMENDMENT_BADGE_LABEL === 'Amended' ? 'Paragraph added' : '');
	});

	it('toggles closed on a second click', async () => {
		render(AmendmentPanel, { entries: [sampleEntry] });
		const badge = screen.getByTestId('amendment-panel-badge');
		await fireEvent.click(badge);
		expect(screen.getByTestId('amendment-panel-body')).toBeTruthy();
		await fireEvent.click(badge);
		expect(screen.queryByTestId('amendment-panel-body')).toBeNull();
		expect(badge.getAttribute('aria-expanded')).toBe('false');
	});

	it('honors initiallyOpen=true', () => {
		render(AmendmentPanel, { entries: [sampleEntry], initiallyOpen: true });
		expect(screen.getByTestId('amendment-panel-body')).toBeTruthy();
		expect(screen.getByTestId('amendment-panel-badge').getAttribute('aria-expanded')).toBe('true');
	});

	it('renders one ErrataEntry per row', async () => {
		const entries: ErrataEntryDisplay[] = [
			{ ...sampleEntry, id: 'hbe_a', errataId: 'mosaic' },
			{ ...sampleEntry, id: 'hbe_b', errataId: 'rev2' },
			{ ...sampleEntry, id: 'hbe_c', errataId: 'rev3' },
		];
		render(AmendmentPanel, { entries, initiallyOpen: true });
		const rows = screen.getByTestId('amendment-panel-body').querySelectorAll('article.errata-entry');
		expect(rows.length).toBe(3);
	});
});

/**
 * HelpLayout DOM contract -- title, summary, sidebar TOC, sections rendered.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HelpLayout from '../src/ui/HelpLayout.svelte';

const page = {
	id: 'overview-help',
	title: 'Overview',
	summary: 'A help page summary.',
	documents: 'AC 61-83K',
	sections: [
		{ id: 'intro', title: 'Intro', body: 'Plain intro text.' },
		{ id: 'usage', title: 'Usage', body: 'Plain usage text.' },
	],
	externalRefs: undefined,
} as const;

afterEach(() => {
	cleanup();
});

describe('HelpLayout', () => {
	it('renders root article with title and summary', () => {
		render(HelpLayout, { page });
		expect(screen.getByTestId('helplayout-root').tagName).toBe('ARTICLE');
		expect(screen.getByTestId('helplayout-title').textContent).toBe('Overview');
		expect(screen.getByTestId('helplayout-summary').textContent).toBe('A help page summary.');
	});

	it('renders a TOC link per section', () => {
		render(HelpLayout, { page });
		expect(screen.getByTestId('helptoc-link-intro')).toBeTruthy();
		expect(screen.getByTestId('helptoc-link-usage')).toBeTruthy();
	});

	it('renders documents block when page.documents is set', () => {
		render(HelpLayout, { page });
		expect(screen.getByTestId('helplayout-documents').textContent).toContain('AC 61-83K');
	});

	it('renders one HelpSection per page.sections', () => {
		render(HelpLayout, { page });
		const sections = document.querySelectorAll('[data-testid="helpsection-root"]');
		expect(sections.length).toBe(2);
	});
});

/**
 * HelpTOC DOM contract -- one link per section, active reflects activeId.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HelpTOC from '../src/ui/HelpTOC.svelte';

const sections = [
	{ id: 'overview', title: 'Overview', body: 'b' },
	{ id: 'usage', title: 'Usage', body: 'b' },
];

afterEach(() => {
	cleanup();
});

describe('HelpTOC', () => {
	it('renders one link per section with hash href', () => {
		render(HelpTOC, { sections });
		expect(screen.getByTestId('helptoc-link-overview').getAttribute('href')).toBe('#overview');
		expect(screen.getByTestId('helptoc-link-usage').getAttribute('href')).toBe('#usage');
	});

	it('aria-current and data-state reflect activeId', () => {
		render(HelpTOC, { sections, activeId: 'usage' });
		expect(screen.getByTestId('helptoc-link-usage').getAttribute('aria-current')).toBe('true');
		expect(screen.getByTestId('helptoc-link-usage').getAttribute('data-state')).toBe('active');
		expect(screen.getByTestId('helptoc-link-overview').getAttribute('data-state')).toBe('idle');
	});

	it('nav has aria-label "Table of contents"', () => {
		render(HelpTOC, { sections });
		expect(screen.getByTestId('helptoc-root').getAttribute('aria-label')).toBe('Table of contents');
	});
});

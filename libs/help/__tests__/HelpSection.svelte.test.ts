/**
 * HelpSection DOM contract -- toggleable, heading optional, body content.
 *
 * Body uses ReferenceText fallback (no `nodes` prop) which only resolves
 * wikilinks. We pass plain prose so no wikilink resolution is needed.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HelpSection from '../src/ui/HelpSection.svelte';

const section = { id: 'overview', title: 'Overview', body: 'Plain section body.' };

afterEach(() => {
	cleanup();
});

describe('HelpSection -- rendering', () => {
	it('renders root section with the section id', () => {
		render(HelpSection, { section });
		const root = screen.getByTestId('helpsection-root');
		expect(root.tagName).toBe('SECTION');
		expect(root.id).toBe('overview');
	});

	it('renders the heading and toggle when showHeading=true', () => {
		render(HelpSection, { section });
		expect(screen.getByTestId('helpsection-toggle')).toBeTruthy();
		expect(screen.getByTestId('helpsection-title').textContent).toBe('Overview');
	});

	it('omits the heading toggle when showHeading=false (lede pattern)', () => {
		render(HelpSection, { section, showHeading: false });
		expect(screen.queryByTestId('helpsection-toggle')).toBeNull();
		expect(screen.getByTestId('helpsection-body')).toBeTruthy();
	});

	it('starts expanded by default', () => {
		render(HelpSection, { section });
		expect(screen.getByTestId('helpsection-root').getAttribute('data-state')).toBe('expanded');
		expect(screen.getByTestId('helpsection-toggle').getAttribute('aria-expanded')).toBe('true');
	});

	it('starts collapsed when startExpanded=false', () => {
		render(HelpSection, { section, startExpanded: false });
		expect(screen.getByTestId('helpsection-root').getAttribute('data-state')).toBe('collapsed');
		expect(screen.queryByTestId('helpsection-body')).toBeNull();
	});
});

describe('HelpSection -- toggle', () => {
	it('clicking the toggle button collapses an expanded section', async () => {
		render(HelpSection, { section });
		(screen.getByTestId('helpsection-toggle') as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.getByTestId('helpsection-root').getAttribute('data-state')).toBe('collapsed');
		expect(screen.queryByTestId('helpsection-body')).toBeNull();
	});

	it('clicking the toggle on a collapsed section expands it', async () => {
		render(HelpSection, { section, startExpanded: false });
		(screen.getByTestId('helpsection-toggle') as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.getByTestId('helpsection-root').getAttribute('data-state')).toBe('expanded');
	});
});

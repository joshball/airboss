/**
 * HelpCard DOM contract -- variant + optional title + body snippet.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import HelpCardHarness from './harnesses/HelpCardHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('HelpCard', () => {
	it('renders root <aside> with role=note', () => {
		render(HelpCardHarness, { body: 'b' });
		const root = screen.getByTestId('helpcard-root');
		expect(root.tagName).toBe('ASIDE');
		expect(root.getAttribute('role')).toBe('note');
	});

	it('default variant is tip', () => {
		render(HelpCardHarness, {});
		const root = screen.getByTestId('helpcard-root');
		expect(root.getAttribute('data-variant')).toBe('tip');
		expect(root.classList.contains('tip')).toBe(true);
	});

	it('variant=warn reflects on data-variant and class', () => {
		render(HelpCardHarness, { variant: 'warn' });
		const root = screen.getByTestId('helpcard-root');
		expect(root.getAttribute('data-variant')).toBe('warn');
		expect(root.classList.contains('warn')).toBe(true);
	});

	it('renders title when provided', () => {
		render(HelpCardHarness, { title: 'Heads up' });
		expect(screen.getByTestId('helpcard-title').textContent).toBe('Heads up');
	});

	it('omits title when not provided', () => {
		render(HelpCardHarness);
		expect(screen.queryByTestId('helpcard-title')).toBeNull();
	});

	it('renders the body snippet content', () => {
		render(HelpCardHarness, { body: 'inner content' });
		expect(screen.getByTestId('harness-helpcard-body').textContent).toBe('inner content');
	});
});

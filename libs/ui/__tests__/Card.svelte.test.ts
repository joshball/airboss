/**
 * Card DOM contract -- header / body / footer snippet rendering, variant.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CardHarness from './harnesses/CardHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Card -- rendering', () => {
	it('renders root <article> with body content only by default', () => {
		render(CardHarness, { body: 'hello' });
		const root = screen.getByTestId('card-root');
		expect(root.tagName).toBe('ARTICLE');
		expect(screen.getByTestId('card-body').textContent?.trim()).toBe('hello');
		expect(screen.queryByTestId('card-header')).toBeNull();
		expect(screen.queryByTestId('card-footer')).toBeNull();
	});

	it('renders header when withHeader=true', () => {
		render(CardHarness, { withHeader: true, headerText: 'Title' });
		expect(screen.getByTestId('card-header')).toBeTruthy();
		expect(screen.getByTestId('harness-header-content').textContent).toBe('Title');
	});

	it('renders footer when withFooter=true', () => {
		render(CardHarness, { withFooter: true, footerText: 'Save' });
		expect(screen.getByTestId('card-footer')).toBeTruthy();
		expect(screen.getByTestId('harness-footer-content').textContent).toBe('Save');
	});
});

describe('Card -- variant', () => {
	it('default variant=raised', () => {
		render(CardHarness, {});
		expect(screen.getByTestId('card-root').getAttribute('data-variant')).toBe('raised');
		expect(screen.getByTestId('card-root').classList.contains('v-raised')).toBe(true);
	});

	it('variant=muted reflects on data-variant and class', () => {
		render(CardHarness, { variant: 'muted' });
		expect(screen.getByTestId('card-root').getAttribute('data-variant')).toBe('muted');
		expect(screen.getByTestId('card-root').classList.contains('v-muted')).toBe(true);
	});
});

describe('Card -- a11y', () => {
	it('passes ariaLabelledby through', () => {
		render(CardHarness, { ariaLabelledby: 'my-title' });
		expect(screen.getByTestId('card-root').getAttribute('aria-labelledby')).toBe('my-title');
	});
});

/**
 * FormStack DOM contract -- div vs form rendering, gap propagation.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FormStackHarness from './harnesses/FormStackHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('FormStack', () => {
	it('renders a <div> by default', () => {
		render(FormStackHarness);
		expect(screen.getByTestId('formstack-root').tagName).toBe('DIV');
		expect(screen.getByTestId('formstack-root').getAttribute('data-as')).toBe('div');
	});

	it('renders a <form> with method/action when as=form', () => {
		render(FormStackHarness, { as: 'form', method: 'POST', action: '/save' });
		const root = screen.getByTestId('formstack-root') as HTMLFormElement;
		expect(root.tagName).toBe('FORM');
		expect(root.method.toUpperCase()).toBe('POST');
		expect(root.getAttribute('action')).toBe('/save');
	});

	it('reflects gap on data-gap and class', () => {
		render(FormStackHarness, { gap: 'lg' });
		const root = screen.getByTestId('formstack-root');
		expect(root.getAttribute('data-gap')).toBe('lg');
		expect(root.classList.contains('gap-lg')).toBe(true);
	});

	it('renders children content', () => {
		render(FormStackHarness, { body: 'fields' });
		expect(screen.getByTestId('harness-formstack-body').textContent).toBe('fields');
	});

	it('forwards aria-label', () => {
		render(FormStackHarness, { ariaLabel: 'Edit form' });
		expect(screen.getByTestId('formstack-root').getAttribute('aria-label')).toBe('Edit form');
	});
});

/**
 * Toast DOM contract -- transient status notification with role/live
 * region semantics, two shapes, tone-driven background, and an optional
 * actions snippet for the `card` shape.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ToastHarness from './harnesses/ToastHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Toast -- rendering', () => {
	it('renders the body content inside the toast root', () => {
		render(ToastHarness, { body: 'Card saved.' });
		expect(screen.getByTestId('toast-root')).toBeInTheDocument();
		expect(screen.getByTestId('harness-toast-body').textContent).toBe('Card saved.');
	});

	it('uses role="status" for screen-reader announcement', () => {
		render(ToastHarness, { body: 'b' });
		expect(screen.getByTestId('toast-root').getAttribute('role')).toBe('status');
	});

	it('defaults aria-live to polite', () => {
		render(ToastHarness, { body: 'b' });
		expect(screen.getByTestId('toast-root').getAttribute('aria-live')).toBe('polite');
	});

	it('passes aria-live=assertive through when set', () => {
		render(ToastHarness, { body: 'b', live: 'assertive' });
		expect(screen.getByTestId('toast-root').getAttribute('aria-live')).toBe('assertive');
	});

	it('passes ariaLabel through to the toast region', () => {
		render(ToastHarness, { body: 'b', ariaLabel: 'Save status' });
		expect(screen.getByTestId('toast-root').getAttribute('aria-label')).toBe('Save status');
	});
});

describe('Toast -- tone', () => {
	it('default tone is success', () => {
		render(ToastHarness, { body: 'b' });
		const root = screen.getByTestId('toast-root');
		expect(root.getAttribute('data-tone')).toBe('success');
		expect(root.classList.contains('t-success')).toBe(true);
	});

	it('reflects each tone via data-tone + class', () => {
		const tones = ['default', 'info', 'warning', 'danger', 'muted', 'featured', 'accent'] as const;
		for (const tone of tones) {
			cleanup();
			render(ToastHarness, { body: 'b', tone });
			const root = screen.getByTestId('toast-root');
			expect(root.getAttribute('data-tone')).toBe(tone);
			expect(root.classList.contains(`t-${tone}`)).toBe(true);
		}
	});
});

describe('Toast -- shape', () => {
	it('default shape is pill', () => {
		render(ToastHarness, { body: 'b' });
		const root = screen.getByTestId('toast-root');
		expect(root.getAttribute('data-shape')).toBe('pill');
		expect(root.classList.contains('s-pill')).toBe(true);
	});

	it('shape=card reflects on data-shape and class', () => {
		render(ToastHarness, { body: 'b', shape: 'card' });
		const root = screen.getByTestId('toast-root');
		expect(root.getAttribute('data-shape')).toBe('card');
		expect(root.classList.contains('s-card')).toBe(true);
	});
});

describe('Toast -- actions slot', () => {
	it('does not render the actions wrapper on pill shape even when provided', () => {
		render(ToastHarness, { body: 'b', shape: 'pill', withActions: true });
		expect(screen.queryByTestId('toast-actions')).toBeNull();
	});

	it('renders actions snippet on card shape when provided', () => {
		render(ToastHarness, { body: 'b', shape: 'card', withActions: true, actionLabel: 'Undo' });
		expect(screen.getByTestId('toast-actions')).toBeInTheDocument();
		expect(screen.getByTestId('harness-toast-action').textContent).toBe('Undo');
	});

	it('omits the actions wrapper on card shape when no snippet provided', () => {
		render(ToastHarness, { body: 'b', shape: 'card', withActions: false });
		expect(screen.queryByTestId('toast-actions')).toBeNull();
	});
});

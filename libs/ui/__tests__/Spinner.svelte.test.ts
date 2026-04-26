/**
 * Spinner DOM contract -- role=status, aria-label, size + tone reflected.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Spinner from '../src/components/Spinner.svelte';

afterEach(() => {
	cleanup();
});

describe('Spinner', () => {
	it('renders root with role=status and default Loading aria-label', () => {
		render(Spinner);
		const root = screen.getByTestId('spinner-root');
		expect(root.getAttribute('role')).toBe('status');
		expect(root.getAttribute('aria-label')).toBe('Loading');
	});

	it('overrides aria-label when ariaLabel is set', () => {
		render(Spinner, { ariaLabel: 'Submitting' });
		expect(screen.getByTestId('spinner-root').getAttribute('aria-label')).toBe('Submitting');
	});

	it('size + tone reflect on data attributes and classes', () => {
		render(Spinner, { size: 'lg', tone: 'inverse' });
		const root = screen.getByTestId('spinner-root');
		expect(root.getAttribute('data-size')).toBe('lg');
		expect(root.getAttribute('data-tone')).toBe('inverse');
		expect(root.classList.contains('s-lg')).toBe(true);
		expect(root.classList.contains('t-inverse')).toBe(true);
	});

	it('contains an aria-hidden svg so the a11y tree only sees the status', () => {
		render(Spinner);
		const svg = screen.getByTestId('spinner-root').querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
	});
});

/**
 * Divider DOM contract -- semantic separator with orientation + inset.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Divider from '../src/components/Divider.svelte';

afterEach(() => {
	cleanup();
});

describe('Divider', () => {
	it('renders role=separator with horizontal orientation by default', () => {
		render(Divider);
		const root = screen.getByTestId('divider-root');
		expect(root.getAttribute('role')).toBe('separator');
		expect(root.getAttribute('aria-orientation')).toBe('horizontal');
		expect(root.getAttribute('data-orientation')).toBe('horizontal');
	});

	it('orientation=vertical reflects on aria-orientation and data-orientation', () => {
		render(Divider, { orientation: 'vertical' });
		const root = screen.getByTestId('divider-root');
		expect(root.getAttribute('aria-orientation')).toBe('vertical');
		expect(root.getAttribute('data-orientation')).toBe('vertical');
	});

	it('inset=true adds the inset class', () => {
		render(Divider, { inset: true });
		expect(screen.getByTestId('divider-root').classList.contains('inset')).toBe(true);
	});

	it('passes ariaLabel through', () => {
		render(Divider, { ariaLabel: 'Section break' });
		expect(screen.getByTestId('divider-root').getAttribute('aria-label')).toBe('Section break');
	});
});

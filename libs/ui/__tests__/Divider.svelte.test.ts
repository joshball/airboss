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
	it('renders a native <hr> for horizontal orientation by default', () => {
		render(Divider);
		const root = screen.getByTestId('divider-root');
		// Horizontal renders as native <hr>: separator semantics come from the
		// platform, no role attribute required.
		expect(root.tagName).toBe('HR');
		expect(root.getAttribute('data-orientation')).toBe('horizontal');
	});

	it('orientation=vertical falls back to role="separator" with aria-orientation', () => {
		render(Divider, { orientation: 'vertical' });
		const root = screen.getByTestId('divider-root');
		expect(root.tagName).toBe('DIV');
		expect(root.getAttribute('role')).toBe('separator');
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

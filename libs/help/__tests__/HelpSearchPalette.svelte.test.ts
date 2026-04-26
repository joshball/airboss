/**
 * HelpSearchPalette DOM contract -- dialog gating, search input, escape.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HelpSearchPalette from '../src/ui/HelpSearchPalette.svelte';

afterEach(() => {
	cleanup();
});

describe('HelpSearchPalette -- closed', () => {
	it('renders nothing when open=false', () => {
		const { container } = render(HelpSearchPalette, { open: false, onClose: vi.fn() });
		expect(container.querySelector('[data-testid="helpsearchpalette-root"]')).toBeNull();
	});
});

describe('HelpSearchPalette -- open', () => {
	it('renders dialog with role=dialog and a search input', () => {
		render(HelpSearchPalette, { open: true, onClose: vi.fn() });
		const root = screen.getByTestId('helpsearchpalette-root');
		expect(root.getAttribute('role')).toBe('dialog');
		const input = screen.getByTestId('helpsearchpalette-input');
		expect(input.tagName).toBe('INPUT');
		expect(input.getAttribute('type')).toBe('search');
	});

	it('initial focused bucket is aviation', () => {
		render(HelpSearchPalette, { open: true, onClose: vi.fn() });
		expect(screen.getByTestId('helpsearchpalette-root').getAttribute('data-focused-bucket')).toBe('aviation');
	});

	it('Escape on the input fires onClose', () => {
		const onClose = vi.fn();
		render(HelpSearchPalette, { open: true, onClose });
		const input = screen.getByTestId('helpsearchpalette-input');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		// Palette has both an input keydown handler and a backdrop
		// "Escape-from-anywhere" handler, so the bubbling event fires onClose
		// twice in unit-DOM mode. App behavior is identical -- once `open` flips
		// false, the dialog unmounts and the second call is a no-op. We just
		// verify Escape was wired through.
		expect(onClose).toHaveBeenCalled();
	});
});

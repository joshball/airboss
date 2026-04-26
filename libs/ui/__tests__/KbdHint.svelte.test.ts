/**
 * KbdHint DOM contract -- renders a <kbd> with the children label.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import KbdHintHarness from './harnesses/KbdHintHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('KbdHint', () => {
	it('renders a <kbd> with the label text', () => {
		render(KbdHintHarness, { label: 'Space' });
		const root = screen.getByTestId('kbdhint-root');
		expect(root.tagName).toBe('KBD');
		expect(root.textContent?.trim()).toBe('Space');
	});

	it('passes ariaLabel through', () => {
		render(KbdHintHarness, { label: '↵', ariaLabel: 'Return key' });
		expect(screen.getByTestId('kbdhint-root').getAttribute('aria-label')).toBe('Return key');
	});
});

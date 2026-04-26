/**
 * ThemeProvider DOM contract -- writes data-theme / data-appearance /
 * data-layout on a transparent wrapper that uses `display: contents`.
 */

import '../core/defaults/airboss-default/index';
import '../study/sectional/index';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, DEFAULT_THEME, THEMES } from '../resolve';
import ThemeProviderHarness from './harnesses/ThemeProviderHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('ThemeProvider', () => {
	it('renders the children inside the wrapper', () => {
		render(ThemeProviderHarness, { body: 'hello' });
		expect(screen.getByTestId('harness-themeprovider-body').textContent).toBe('hello');
	});

	it('defaults theme + appearance to DEFAULT_*; layout defaults to "reading"', () => {
		render(ThemeProviderHarness);
		const root = screen.getByTestId('themeprovider-root');
		expect(root.getAttribute('data-theme')).toBe(DEFAULT_THEME);
		expect(root.getAttribute('data-appearance')).toBe(DEFAULT_APPEARANCE);
		expect(root.getAttribute('data-layout')).toBe('reading');
	});

	it('reflects passed theme + appearance on the wrapper', () => {
		render(ThemeProviderHarness, {
			theme: THEMES.STUDY_SECTIONAL,
			appearance: 'dark',
			layout: 'flightdeck',
		});
		const root = screen.getByTestId('themeprovider-root');
		expect(root.getAttribute('data-theme')).toBe(THEMES.STUDY_SECTIONAL);
		expect(root.getAttribute('data-appearance')).toBe('dark');
		expect(root.getAttribute('data-layout')).toBe('flightdeck');
	});

	it('uses display: contents (carries .ab-theme class so the layout-neutral CSS rule applies)', () => {
		render(ThemeProviderHarness);
		expect(screen.getByTestId('themeprovider-root').classList.contains('ab-theme')).toBe(true);
	});
});

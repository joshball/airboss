/**
 * Badge DOM contract -- tone + size reflect on data attributes and classes.
 *
 * Glyph contract: every tone renders a leading decorative glyph
 * (aria-hidden) so the badge meaning carries on monochrome / color-blind
 * displays. Required for WCAG 1.4.1 (Use of Color).
 */

import type { Tone } from '@ab/themes';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BADGE_TONE_GLYPHS } from '../src/components/Badge.svelte';
import BadgeHarness from './harnesses/BadgeHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Badge', () => {
	it('renders with the children label', () => {
		render(BadgeHarness, { label: 'New' });
		// Children label is in textContent alongside the leading glyph; assert
		// the label is present rather than that it is the entire text.
		expect(screen.getByTestId('badge-root').textContent ?? '').toContain('New');
	});

	it('default tone + size reflect as default + md', () => {
		render(BadgeHarness, { label: 'New' });
		const root = screen.getByTestId('badge-root');
		expect(root.getAttribute('data-tone')).toBe('default');
		expect(root.getAttribute('data-size')).toBe('md');
	});

	it('tone=success size=lg reflects on attributes and classes', () => {
		render(BadgeHarness, { label: 'OK', tone: 'success', size: 'lg' });
		const root = screen.getByTestId('badge-root');
		expect(root.getAttribute('data-tone')).toBe('success');
		expect(root.getAttribute('data-size')).toBe('lg');
		expect(root.classList.contains('v-success')).toBe(true);
		expect(root.classList.contains('s-lg')).toBe(true);
	});

	it('passes ariaLabel through', () => {
		render(BadgeHarness, { label: '7', ariaLabel: '7 unread' });
		expect(screen.getByTestId('badge-root').getAttribute('aria-label')).toBe('7 unread');
	});

	describe('glyph (WCAG 1.4.1 non-color cue)', () => {
		const tones = Object.keys(BADGE_TONE_GLYPHS) as Tone[];

		it.each(tones)('tone=%s renders the expected leading glyph', (tone) => {
			render(BadgeHarness, { label: 'Status', tone });
			const glyph = screen.getByTestId('badge-glyph');
			expect(glyph.textContent?.trim()).toBe(BADGE_TONE_GLYPHS[tone]);
		});

		it.each(tones)('tone=%s glyph is aria-hidden so SR does not double-announce', (tone) => {
			render(BadgeHarness, { label: 'Status', tone });
			const glyph = screen.getByTestId('badge-glyph');
			expect(glyph.getAttribute('aria-hidden')).toBe('true');
		});

		it('glyph={false} suppresses the glyph for callers who provide their own icon', () => {
			render(BadgeHarness, { label: 'Custom', tone: 'success', glyph: false });
			expect(screen.queryByTestId('badge-glyph')).toBeNull();
		});

		it('every Tone has a distinct glyph (no two tones collapse to the same shape)', () => {
			const glyphs = Object.values(BADGE_TONE_GLYPHS);
			const unique = new Set(glyphs);
			expect(unique.size).toBe(glyphs.length);
		});
	});
});

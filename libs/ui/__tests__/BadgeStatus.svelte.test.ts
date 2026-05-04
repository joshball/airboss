/**
 * BadgeStatus DOM contract -- pill-style status indicator paired to a
 * lifecycle state (active / idle / archived / pending). Distinct from the
 * generic Badge primitive: glyph-free, solid-fill on active, semantic
 * `state` axis instead of `tone`.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { BadgeStatusState } from '../src/components/BadgeStatus.svelte';
import BadgeStatusHarness from './harnesses/BadgeStatusHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('BadgeStatus -- rendering', () => {
	it('renders the children label', () => {
		render(BadgeStatusHarness, { body: 'Active' });
		expect(screen.getByTestId('harness-badge-body').textContent).toBe('Active');
	});

	it('default state is idle', () => {
		render(BadgeStatusHarness, { body: 'Idle' });
		const root = screen.getByTestId('badge-status-root');
		expect(root.getAttribute('data-state')).toBe('idle');
		expect(root.classList.contains('s-idle')).toBe(true);
	});

	it('reflects each state on data-state and class', () => {
		const states: BadgeStatusState[] = ['active', 'idle', 'archived', 'pending'];
		for (const state of states) {
			cleanup();
			render(BadgeStatusHarness, { state, body: state });
			const root = screen.getByTestId('badge-status-root');
			expect(root.getAttribute('data-state')).toBe(state);
			expect(root.classList.contains(`s-${state}`)).toBe(true);
		}
	});

	it('passes ariaLabel through', () => {
		render(BadgeStatusHarness, { state: 'active', ariaLabel: 'Plan is active', body: 'Active' });
		expect(screen.getByTestId('badge-status-root').getAttribute('aria-label')).toBe('Plan is active');
	});

	it('renders without a leading glyph (glyph-free, distinct from Badge)', () => {
		render(BadgeStatusHarness, { state: 'active', body: 'Active' });
		// BadgeStatus must NOT emit a badge-glyph testid; that belongs to the
		// generic Badge primitive (which uses glyphs for tone signalling).
		expect(screen.queryByTestId('badge-glyph')).toBeNull();
	});
});

/**
 * BadgeStatus DOM contract -- pill-shaped lifecycle indicator. Glyph-free,
 * state-driven background+ink, used for plan / session / area lifecycle
 * pills. Distinct axis from `Badge` (which is tone-driven and carries a
 * leading glyph for inline metadata).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { BadgeStatusState } from '../src/components/BadgeStatus.svelte';
import BadgeStatusHarness from './harnesses/BadgeStatusHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('BadgeStatus -- rendering', () => {
	it('renders the children body inside the root', () => {
		render(BadgeStatusHarness, { body: 'Active' });
		expect(screen.getByTestId('badge-status-root')).toBeInTheDocument();
		expect(screen.getByTestId('harness-badge-body').textContent).toBe('Active');
	});

	it('passes ariaLabel through to the root element', () => {
		render(BadgeStatusHarness, { body: 'A', ariaLabel: 'Plan status: active' });
		expect(screen.getByTestId('badge-status-root').getAttribute('aria-label')).toBe('Plan status: active');
	});
});

describe('BadgeStatus -- state', () => {
	it('default state is idle', () => {
		render(BadgeStatusHarness, { body: 'b' });
		const root = screen.getByTestId('badge-status-root');
		expect(root.getAttribute('data-state')).toBe('idle');
		expect(root.classList.contains('s-idle')).toBe(true);
	});

	it('reflects each state via data-state + class', () => {
		const states: readonly BadgeStatusState[] = ['active', 'idle', 'archived', 'pending'];
		for (const state of states) {
			cleanup();
			render(BadgeStatusHarness, { body: 'b', state });
			const root = screen.getByTestId('badge-status-root');
			expect(root.getAttribute('data-state')).toBe(state);
			expect(root.classList.contains(`s-${state}`)).toBe(true);
		}
	});
});

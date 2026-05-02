/**
 * PfdKeyboardLegend DOM contract -- dialog gating, header / footer
 * structure, close-on-button.
 *
 * The legend was migrated onto the shared `Dialog` primitive so role,
 * focus-trap, ESC, scrim-click, and the close glyph all come from there;
 * this test only covers the bits that are unique to the legend (binding
 * rows, "Got it" footer, onClose contract).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PfdKeyboardLegend from '../src/pfd/PfdKeyboardLegend.svelte';
import { PFD_INPUT_KEYS } from '../src/pfd/pfd-types';

const bindings = [
	{
		key: PFD_INPUT_KEYS.PITCH,
		label: 'Pitch',
		unitLabel: 'deg',
		min: -25,
		max: 25,
		step: 0.5,
		default: 0,
		decKeys: ['s'],
		incKeys: ['w'],
		keyStep: 1,
		requiresShift: false,
	},
];

afterEach(() => {
	cleanup();
});

describe('PfdKeyboardLegend -- closed', () => {
	it('renders nothing when open=false', () => {
		const { container } = render(PfdKeyboardLegend, {
			open: false,
			bindings,
			onClose: vi.fn(),
		});
		expect(container.querySelector('[data-testid="dialog-panel"]')).toBeNull();
		expect(container.querySelector('[data-testid="pfdkeyboardlegend-bindings"]')).toBeNull();
	});
});

describe('PfdKeyboardLegend -- open', () => {
	it('renders the shared Dialog primitive with role=dialog and aria-modal', () => {
		render(PfdKeyboardLegend, { open: true, bindings, onClose: vi.fn() });
		const panel = screen.getByTestId('dialog-panel');
		expect(panel.getAttribute('role')).toBe('dialog');
		expect(panel.getAttribute('aria-modal')).toBe('true');
		expect(panel.getAttribute('aria-label')).toBe('PFD keyboard shortcuts');
	});

	it('renders one binding entry per supplied binding plus reset / panel rows', () => {
		render(PfdKeyboardLegend, { open: true, bindings, onClose: vi.fn() });
		const list = screen.getByTestId('pfdkeyboardlegend-bindings');
		// One supplied binding + Reset + This panel = 3 dt rows.
		expect(list.querySelectorAll('dt').length).toBe(3);
	});

	it('clicking the "Got it" footer button calls onClose', () => {
		const onClose = vi.fn();
		render(PfdKeyboardLegend, { open: true, bindings, onClose });
		(screen.getByTestId('pfdkeyboardlegend-ok') as HTMLElement).click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('clicking the shared Dialog close button calls onClose', () => {
		const onClose = vi.fn();
		render(PfdKeyboardLegend, { open: true, bindings, onClose });
		(screen.getByTestId('dialog-close') as HTMLButtonElement).click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

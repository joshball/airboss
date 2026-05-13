/**
 * `PaletteTypeNav` -- vertical bucket nav with counts, App Help hidden
 * by default (R8).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TypeBucket } from '../src/schema/type-buckets';
import PaletteTypeNav from '../src/ui/PaletteTypeNav.svelte';

afterEach(() => {
	cleanup();
});

function zeroCounts(): Record<TypeBucket, number> {
	return {
		handbooks: 0,
		cfrs: 0,
		aim: 0,
		ac: 0,
		acs: 0,
		knowledge: 0,
		courses: 0,
		glossary: 0,
		mine: 0,
		tools: 0,
		'app-help': 0,
	};
}

describe('PaletteTypeNav', () => {
	it('renders every non-hidden bucket even when its count is zero (so long as some other bucket has hits)', () => {
		const counts = zeroCounts();
		counts.handbooks = 5;
		render(PaletteTypeNav, {
			counts,
			selected: 'handbooks',
			onSelect: vi.fn(),
		});
		const buttons = screen.getAllByTestId('palette-type-nav-button');
		// 11 buckets total; App Help is hidden by default when empty -> 10.
		expect(buttons.length).toBe(10);
		const buckets = buttons.map((b) => b.getAttribute('data-bucket'));
		expect(buckets).not.toContain('app-help');
		expect(buckets).toContain('handbooks');
		expect(buckets).toContain('glossary');
	});

	it('surfaces App Help when it has hits', () => {
		const counts = zeroCounts();
		counts.handbooks = 3;
		counts['app-help'] = 1;
		render(PaletteTypeNav, { counts, selected: 'handbooks', onSelect: vi.fn() });
		const buckets = screen
			.getAllByTestId('palette-type-nav-button')
			.map((b) => b.getAttribute('data-bucket'));
		expect(buckets).toContain('app-help');
	});

	it('surfaces App Help when it is the selected bucket even with zero hits', () => {
		render(PaletteTypeNav, {
			counts: zeroCounts(),
			selected: 'app-help',
			onSelect: vi.fn(),
		});
		const buckets = screen
			.getAllByTestId('palette-type-nav-button')
			.map((b) => b.getAttribute('data-bucket'));
		expect(buckets).toContain('app-help');
	});

	it('surfaces App Help when every other bucket is also empty (last-resort surface)', () => {
		render(PaletteTypeNav, {
			counts: zeroCounts(),
			selected: 'handbooks',
			onSelect: vi.fn(),
		});
		// totalNonHidden is 0 -> the last-resort branch fires -> app-help included.
		const buckets = screen
			.getAllByTestId('palette-type-nav-button')
			.map((b) => b.getAttribute('data-bucket'));
		expect(buckets).toContain('app-help');
	});

	it('marks the selected bucket', () => {
		const counts = zeroCounts();
		counts.cfrs = 5;
		render(PaletteTypeNav, { counts, selected: 'cfrs', onSelect: vi.fn() });
		const buttons = screen.getAllByTestId('palette-type-nav-button');
		const cfr = buttons.find((b) => b.getAttribute('data-bucket') === 'cfrs');
		expect(cfr?.getAttribute('aria-pressed')).toBe('true');
		expect(cfr?.classList.contains('selected')).toBe(true);
	});

	it('renders per-bucket counts', () => {
		const counts = zeroCounts();
		counts.handbooks = 7;
		counts.cfrs = 38;
		render(PaletteTypeNav, { counts, selected: 'handbooks', onSelect: vi.fn() });
		const buttons = screen.getAllByTestId('palette-type-nav-button');
		const cfr = buttons.find((b) => b.getAttribute('data-bucket') === 'cfrs');
		expect(cfr?.textContent ?? '').toMatch(/38/);
	});

	it('fires onSelect when a bucket button is clicked', async () => {
		const onSelect = vi.fn();
		const counts = zeroCounts();
		counts.cfrs = 3;
		render(PaletteTypeNav, { counts, selected: 'handbooks', onSelect });
		const cfr = screen.getAllByTestId('palette-type-nav-button').find((b) => b.getAttribute('data-bucket') === 'cfrs');
		expect(cfr).toBeDefined();
		await fireEvent.click(cfr as Element);
		expect(onSelect).toHaveBeenCalledWith('cfrs');
	});
});

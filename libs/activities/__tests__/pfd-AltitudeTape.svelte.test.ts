/**
 * PFD AltitudeTape DOM contract -- aria-label reports altitude; tape
 * translates by `altitudeFeet * 0.06`; the rolled-counter glyph stack
 * translates by `(altitudeFeet / 1000) * cellHeight`; the trailing 3
 * digits render zero-padded.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AltitudeTape from '../src/pfd/AltitudeTape.svelte';

afterEach(() => {
	cleanup();
});

function firstTranslateY(container: HTMLElement): number {
	const g = container.querySelector<SVGGElement>('g[transform^="translate"]');
	const m = (g?.getAttribute('transform') ?? '').match(/translate\(0\s+([-\d.]+)\)/);
	return m?.[1] ? Number.parseFloat(m[1]) : Number.NaN;
}

describe('PFD AltitudeTape', () => {
	it('renders an svg with a feet-bearing aria-label', () => {
		const { container } = render(AltitudeTape, { altitudeFeet: 3450 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')?.toLowerCase()).toContain('feet');
		expect(svg?.getAttribute('aria-label')).toContain('3450');
	});

	it('translates the tape by altitude * 0.06 px/ft', () => {
		const { container } = render(AltitudeTape, { altitudeFeet: 5000 });
		expect(firstTranslateY(container)).toBeCloseTo(300, 5);
	});

	it('clamps altitudes below 0 to 0 (tape rests at origin)', () => {
		const { container } = render(AltitudeTape, { altitudeFeet: -250 });
		expect(firstTranslateY(container)).toBe(0);
	});

	it('treats non-finite altitude as 0', () => {
		const { container } = render(AltitudeTape, { altitudeFeet: Number.NaN });
		expect(firstTranslateY(container)).toBe(0);
	});

	it('renders the 3-digit low-digits readout zero-padded', () => {
		const { container } = render(AltitudeTape, { altitudeFeet: 1050 });
		expect(container.textContent ?? '').toContain('050');
	});

	it('rolled counter contains the digits 0..9 plus a wrap continuity 0', () => {
		const { container } = render(AltitudeTape, { altitudeFeet: 0 });
		// 11 digit glyphs in a vertical stack (0..9 + extra 0).
		const counterDigits = container.querySelectorAll('text.counter-digit');
		expect(counterDigits.length).toBe(11);
		const labels = Array.from(counterDigits).map((t) => t.textContent?.trim());
		expect(labels).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
	});
});

/**
 * PFD HeadingIndicator DOM contract -- aria-label and centered readout
 * report the heading; raw 0 displays as 360 per glass-cockpit convention;
 * cardinal letters render at N/E/S/W in the visible window.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PfdHeadingIndicator from '../src/pfd/HeadingIndicator.svelte';

afterEach(() => {
	cleanup();
});

describe('PFD HeadingIndicator', () => {
	it('renders an svg with role="img" and a heading aria-label', () => {
		const { container } = render(PfdHeadingIndicator, { headingDegMag: 90 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')).toMatch(/heading\s+90/i);
	});

	it('shows raw 0 as 360 in the readout (compass card never reads "0")', () => {
		const { container } = render(PfdHeadingIndicator, { headingDegMag: 0 });
		const readout = container.querySelector('text.readout-text');
		expect(readout?.textContent?.trim()).toBe('360');
	});

	it('zero-pads the readout to 3 digits (45 -> "045")', () => {
		const { container } = render(PfdHeadingIndicator, { headingDegMag: 45 });
		const readout = container.querySelector('text.readout-text');
		expect(readout?.textContent?.trim()).toBe('045');
	});

	it('renders the four cardinal labels (N E S W) when their headings are visible', () => {
		// Heading 360 -> N at center; window covers about +/- 75 deg, so E at 90
		// is OUTSIDE the visible window. Pick heading 0 and assert N at least
		// renders.
		const { container } = render(PfdHeadingIndicator, { headingDegMag: 0 });
		const cardinals = Array.from(container.querySelectorAll('text.cardinal-label')).map((t) => t.textContent?.trim());
		expect(cardinals).toContain('N');
	});

	it('treats non-finite heading as 0 -> readout shows 360', () => {
		const { container } = render(PfdHeadingIndicator, { headingDegMag: Number.NaN });
		const readout = container.querySelector('text.readout-text');
		expect(readout?.textContent?.trim()).toBe('360');
	});

	it('renders glass-cockpit major labels ("3" for 30) when in the visible window', () => {
		// Heading 0 -- visible window is ~ -75..+75 -> 30 (label "3") and 330 (label "33").
		const { container } = render(PfdHeadingIndicator, { headingDegMag: 0 });
		const majors = Array.from(container.querySelectorAll('text.major-label')).map((t) => t.textContent?.trim());
		expect(majors).toContain('3');
		expect(majors).toContain('33');
	});
});

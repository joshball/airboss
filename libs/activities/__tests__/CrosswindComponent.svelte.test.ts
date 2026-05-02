/**
 * CrosswindComponent DOM contract -- the activity mounts as a
 * `role="application"` SVG (interactive widget), shows the runway / wind
 * readouts derived from the props, and exposes a keyboard handler that
 * nudges the wind direction with arrow keys.
 *
 * The numeric mappings (compass / runway-relative geometry) are covered by
 * `crosswind-math.test.ts`; this file pins the DOM-side contract only.
 */

import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CrosswindComponent from '../src/crosswind-component/CrosswindComponent.svelte';

afterEach(() => {
	cleanup();
});

describe('CrosswindComponent', () => {
	it('mounts an interactive SVG with role="application" and a descriptive aria-label', () => {
		const { container } = render(CrosswindComponent, {
			runwayHeading: 10,
			initialWindDirection: 30,
			initialWindSpeed: 15,
		});
		const svg = container.querySelector('svg.compass');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('role')).toBe('application');
		expect(svg?.getAttribute('aria-label')).toMatch(/crosswind/i);
		expect(svg?.getAttribute('tabindex')).toBe('0');
	});

	it('shows the runway heading formatted with leading zeros (010 not 10)', () => {
		const { container } = render(CrosswindComponent, {
			runwayHeading: 10,
			initialWindDirection: 30,
			initialWindSpeed: 15,
		});
		expect(container.textContent ?? '').toContain('010');
	});

	it('shows the wind direction formatted as 3-digit and the speed', () => {
		const { container } = render(CrosswindComponent, {
			runwayHeading: 10,
			initialWindDirection: 30,
			initialWindSpeed: 15,
		});
		const text = container.textContent ?? '';
		expect(text).toContain('030');
		expect(text).toContain('15 kt');
	});

	it('arrow-right nudges wind direction by 5 degrees and updates the readout', async () => {
		const { container } = render(CrosswindComponent, {
			runwayHeading: 10,
			initialWindDirection: 30,
			initialWindSpeed: 15,
		});
		const svg = container.querySelector('svg.compass') as SVGSVGElement;
		await fireEvent.keyDown(svg, { key: 'ArrowRight' });
		// 030 -> 035 after one ArrowRight (5-degree step).
		expect(container.textContent ?? '').toContain('035');
	});

	it('arrow-right with shift nudges by 1 degree (fine adjust)', async () => {
		const { container } = render(CrosswindComponent, {
			runwayHeading: 10,
			initialWindDirection: 30,
			initialWindSpeed: 15,
		});
		const svg = container.querySelector('svg.compass') as SVGSVGElement;
		await fireEvent.keyDown(svg, { key: 'ArrowRight', shiftKey: true });
		expect(container.textContent ?? '').toContain('031');
	});

	it('renders the four cardinal labels (N E S W)', () => {
		const { container } = render(CrosswindComponent, {});
		const text = container.textContent ?? '';
		expect(text).toContain('N');
		expect(text).toContain('E');
		expect(text).toContain('S');
		expect(text).toContain('W');
	});
});

/**
 * `<LegLabel>` rendering tests.
 *
 * The placeholder shape renders distance + course; the full performance
 * shape renders fuel + ETE + wind; the click handler fires.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-22, XC-45.
 */

import type { LegPerformance, LegPlaceholder } from '@ab/spatial-engine';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LegLabel from '../LegLabel.svelte';

afterEach(cleanup);

const placeholder: LegPlaceholder = {
	from: 'wp-a',
	to: 'wp-b',
	distanceNm: 57.3,
	trueCourse: 58,
};

const fullLeg: LegPerformance = {
	from: 'wp-a',
	to: 'wp-b',
	distanceNm: 57.3,
	trueCourse: 58,
	magneticHeading: 59,
	altitudeFtMsl: 4500,
	groundSpeedKt: 136,
	eteMin: 25,
	fuelGal: 3.4,
	windFromDeg: 230,
	windKt: 26,
};

const midpoint = { x: 200, y: 150 };

describe('<LegLabel>', () => {
	it('renders the geometry line for a placeholder leg', () => {
		const { container } = render(LegLabel, { leg: placeholder, midpoint });
		const text = container.textContent ?? '';
		expect(text).toContain('57 nm');
		expect(text).toContain('58');
	});

	it('renders only the geometry line for a placeholder (no fuel)', () => {
		const { container } = render(LegLabel, { leg: placeholder, midpoint });
		expect(container.textContent).not.toContain('gal');
	});

	it('renders fuel + ETE + wind for a full performance leg', () => {
		const { container } = render(LegLabel, { leg: fullLeg, midpoint });
		const text = container.textContent ?? '';
		expect(text).toContain('3.4 gal');
		expect(text).toContain('25 min');
		expect(text).toContain('230');
		expect(text).toContain('26 kt');
	});

	it('tags the label with the from/to waypoint ids', () => {
		const { container } = render(LegLabel, { leg: fullLeg, midpoint });
		const label = container.querySelector('[data-testid="leg-label"]');
		expect(label?.getAttribute('data-leg-from')).toBe('wp-a');
		expect(label?.getAttribute('data-leg-to')).toBe('wp-b');
	});

	it('fires the leg-click handler with the leg object', async () => {
		const onlegclick = vi.fn();
		const { container } = render(LegLabel, { leg: fullLeg, midpoint, onlegclick });
		const label = container.querySelector('[data-testid="leg-label"]');
		expect(label).not.toBeNull();
		if (label) await fireEvent.click(label);
		expect(onlegclick).toHaveBeenCalledTimes(1);
		expect(onlegclick.mock.calls[0][0].from).toBe('wp-a');
	});
});

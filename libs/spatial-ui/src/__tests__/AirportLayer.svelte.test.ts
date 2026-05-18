/**
 * `<AirportLayer>` rendering tests.
 *
 * A synthetic two-airport input renders one symbol per airport; the
 * hard-surface field is filled, the soft-surface field is open.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-12.
 */

import { regionalLambertProjection } from '@ab/spatial-engine';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AirportLayer from '../AirportLayer.svelte';
import { fixtureAirports } from './fixtures';

afterEach(cleanup);

const projection = regionalLambertProjection('memphis', { width: 800, height: 600 });

describe('<AirportLayer>', () => {
	it('renders one symbol per airport', () => {
		const { container } = render(AirportLayer, { airports: fixtureAirports, projection });
		expect(container.querySelectorAll('.airport-symbol').length).toBe(2);
	});

	it('marks the hard-surface field hard and the soft-surface field soft', () => {
		const { container } = render(AirportLayer, { airports: fixtureAirports, projection });
		expect(container.querySelector('[data-icao="KTST"]')?.classList.contains('airport-hard')).toBe(true);
		expect(container.querySelector('[data-icao="KSFT"]')?.classList.contains('airport-soft')).toBe(true);
	});

	it('renders an attended ring only for the attended field', () => {
		const { container } = render(AirportLayer, { airports: fixtureAirports, projection });
		const ktst = container.querySelector('[data-icao="KTST"]');
		const ksft = container.querySelector('[data-icao="KSFT"]');
		expect(ktst?.querySelector('.airport-attended-ring')).not.toBeNull();
		expect(ksft?.querySelector('.airport-attended-ring')).toBeNull();
	});

	it('fires the click handler with the airport record', async () => {
		const onairportclick = vi.fn();
		const { container } = render(AirportLayer, { airports: fixtureAirports, projection, onairportclick });
		const symbol = container.querySelector('[data-icao="KTST"]');
		expect(symbol).not.toBeNull();
		if (symbol) await fireEvent.click(symbol);
		expect(onairportclick).toHaveBeenCalledTimes(1);
		expect(onairportclick.mock.calls[0][0].icao).toBe('KTST');
	});
});

/**
 * `<AirmetPolygon>` rendering tests.
 *
 * The polygon renders a ring path with the per-family class; the click
 * handler fires with the AIRMET view.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-32, XC-33.
 */

import { regionalLambertProjection } from '@ab/spatial-engine';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AirmetPolygon from '../AirmetPolygon.svelte';
import { fixtureAirmets } from './fixtures';

afterEach(cleanup);

const projection = regionalLambertProjection('memphis', { width: 800, height: 600 });
const [sierra, tango, zulu] = fixtureAirmets;

describe('<AirmetPolygon>', () => {
	it('renders a ring path', () => {
		const { container } = render(AirmetPolygon, { airmet: sierra, projection });
		expect(container.querySelector('.airmet-ring')).not.toBeNull();
	});

	it('applies the per-family class', () => {
		const sierraR = render(AirmetPolygon, { airmet: sierra, projection });
		expect(sierraR.container.querySelector('.airmet-sierra')).not.toBeNull();
		cleanup();
		const tangoR = render(AirmetPolygon, { airmet: tango, projection });
		expect(tangoR.container.querySelector('.airmet-tango')).not.toBeNull();
		cleanup();
		const zuluR = render(AirmetPolygon, { airmet: zulu, projection });
		expect(zuluR.container.querySelector('.airmet-zulu')).not.toBeNull();
	});

	it('tags the polygon with its id + family', () => {
		const { container } = render(AirmetPolygon, { airmet: sierra, projection });
		const poly = container.querySelector('[data-testid="airmet-polygon"]');
		expect(poly?.getAttribute('data-airmet-id')).toBe('airmet-sierra-test');
		expect(poly?.getAttribute('data-airmet-family')).toBe('airmet-sierra');
	});

	it('fires the airmet-click handler with the AIRMET view', async () => {
		const onairmetclick = vi.fn();
		const { container } = render(AirmetPolygon, { airmet: tango, projection, onairmetclick });
		const poly = container.querySelector('[data-testid="airmet-polygon"]');
		expect(poly).not.toBeNull();
		if (poly) await fireEvent.click(poly);
		expect(onairmetclick).toHaveBeenCalledTimes(1);
		expect(onairmetclick.mock.calls[0][0].id).toBe('airmet-tango-test');
	});
});

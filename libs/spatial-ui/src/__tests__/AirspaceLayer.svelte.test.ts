/**
 * `<AirspaceLayer>` rendering tests.
 *
 * A synthetic three-polygon input (one B, one D, one MOA) renders the
 * expected per-class group structure.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-11.
 */

import { regionalLambertProjection } from '@ab/spatial-engine';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AirspaceLayer from '../AirspaceLayer.svelte';
import { fixtureAirspace } from './fixtures';

afterEach(cleanup);

const projection = regionalLambertProjection('memphis', { width: 800, height: 600 });

describe('<AirspaceLayer>', () => {
	it('renders one group per airspace class present', () => {
		const { container } = render(AirspaceLayer, { airspace: fixtureAirspace, projection });
		expect(container.querySelector('.airspace-b')).not.toBeNull();
		expect(container.querySelector('.airspace-d')).not.toBeNull();
		expect(container.querySelector('.airspace-moa')).not.toBeNull();
	});

	it('renders one path per airspace polygon', () => {
		const { container } = render(AirspaceLayer, { airspace: fixtureAirspace, projection });
		expect(container.querySelectorAll('.airspace-poly').length).toBe(3);
	});

	it('tags each airspace path with its source id', () => {
		const { container } = render(AirspaceLayer, { airspace: fixtureAirspace, projection });
		expect(container.querySelector('[data-airspace-id="asp-b"]')).not.toBeNull();
		expect(container.querySelector('[data-airspace-id="asp-d"]')).not.toBeNull();
	});

	it('honors an activeClasses filter', () => {
		const { container } = render(AirspaceLayer, {
			airspace: fixtureAirspace,
			projection,
			activeClasses: ['D'],
		});
		expect(container.querySelector('.airspace-d')).not.toBeNull();
		expect(container.querySelector('.airspace-b')).toBeNull();
		expect(container.querySelector('.airspace-moa')).toBeNull();
	});
});

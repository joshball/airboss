/**
 * `<NavaidLayer>` rendering tests.
 *
 * A synthetic VOR + NDB + fix input renders the expected per-kind symbol.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-13.
 */

import { regionalLambertProjection } from '@ab/spatial-engine';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NavaidLayer from '../NavaidLayer.svelte';
import { fixtureNavaids } from './fixtures';

afterEach(cleanup);

const projection = regionalLambertProjection('memphis', { width: 800, height: 600 });

describe('<NavaidLayer>', () => {
	it('renders one symbol per navaid', () => {
		const { container } = render(NavaidLayer, { navaids: fixtureNavaids, projection });
		expect(container.querySelectorAll('.navaid-symbol').length).toBe(3);
	});

	it('renders a star polygon for the VOR family', () => {
		const { container } = render(NavaidLayer, { navaids: fixtureNavaids, projection });
		expect(container.querySelector('.navaid-vortac .navaid-vor')).not.toBeNull();
	});

	it('renders a dotted ring for the NDB', () => {
		const { container } = render(NavaidLayer, { navaids: fixtureNavaids, projection });
		expect(container.querySelector('.navaid-ndb .navaid-ndb')).not.toBeNull();
	});

	it('renders a triangle for the fix', () => {
		const { container } = render(NavaidLayer, { navaids: fixtureNavaids, projection });
		expect(container.querySelector('.navaid-fix .navaid-fix')).not.toBeNull();
	});
});

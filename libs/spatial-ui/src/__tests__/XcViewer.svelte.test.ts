/**
 * `<XcViewer>` Phase B rendering tests.
 *
 * The viewer renders the layer-1 sectional (basemap + airspace + airports
 * + navaids) plus the pan/zoom + layer-toggle chrome against a synthetic
 * bundle, with no hydration errors.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-10, XC-15.
 */

import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import XcViewer from '../XcViewer.svelte';
import { fixtureBundle } from './fixtures';

afterEach(cleanup);

describe('<XcViewer> (Phase B sectional)', () => {
	it('renders the viewer shell with an SVG canvas', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="xc-viewer"]')).not.toBeNull();
		expect(container.querySelector('.xc-canvas')).not.toBeNull();
	});

	it('renders the basemap, airspace, navaid, and airport layers', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="basemap-layer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="airspace-layer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="navaid-layer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="airport-layer"]')).not.toBeNull();
	});

	it('renders the pan/zoom + layer-toggle chrome', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="zoom-pan-controls"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="layer-toggle"]')).not.toBeNull();
	});

	it('hides a layer when its toggle is unchecked', async () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		const airspaceToggle = container.querySelector<HTMLInputElement>('[data-layer-key="airspace"]');
		expect(airspaceToggle).not.toBeNull();
		expect(container.querySelector('[data-testid="airspace-layer"]')).not.toBeNull();
		if (airspaceToggle) await fireEvent.click(airspaceToggle);
		expect(container.querySelector('[data-testid="airspace-layer"]')).toBeNull();
	});

	it('renders one airport symbol per region airport', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelectorAll('.airport-symbol').length).toBe(fixtureBundle.geography.airports.length);
	});
});

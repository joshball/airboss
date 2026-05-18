/**
 * `<LegDetailDrawer>` tests.
 *
 * The drawer shows the full leg payload + cumulative fuel; closes on the
 * close button and Esc.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-47.
 */

import type { LegPerformance } from '@ab/spatial-engine';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LegDetailDrawer from '../LegDetailDrawer.svelte';
import { fixtureBundleWithPerformance } from './fixtures';

afterEach(cleanup);

const leg: LegPerformance = fixtureBundleWithPerformance.performance.legs[0];
const { performance } = fixtureBundleWithPerformance;

describe('<LegDetailDrawer>', () => {
	it('renders nothing when closed', () => {
		const { container } = render(LegDetailDrawer, { open: false, leg, performance, onclose: () => {} });
		expect(container.querySelector('[data-testid="leg-drawer"]')).toBeNull();
	});

	it('renders the full leg payload when open', () => {
		const { container } = render(LegDetailDrawer, { open: true, leg, performance, onclose: () => {} });
		const text = container.textContent ?? '';
		expect(text).toContain('61.1 nm');
		expect(text).toContain('57°');
		expect(text).toContain('51°');
		expect(text).toContain('127 kt');
		expect(text).toContain('3.9 gal');
	});

	it('shows the cumulative fuel up to the leg', () => {
		const { container } = render(LegDetailDrawer, { open: true, leg, performance, onclose: () => {} });
		expect(container.querySelector('[data-testid="leg-cumulative-fuel"]')?.textContent).toContain('3.9');
	});

	it('fires onclose when the close button is clicked', async () => {
		const onclose = vi.fn();
		const { container } = render(LegDetailDrawer, { open: true, leg, performance, onclose });
		const btn = container.querySelector('.drawer-close');
		if (btn) await fireEvent.click(btn);
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('fires onclose on Escape', async () => {
		const onclose = vi.fn();
		render(LegDetailDrawer, { open: true, leg, performance, onclose });
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onclose).toHaveBeenCalledTimes(1);
	});
});

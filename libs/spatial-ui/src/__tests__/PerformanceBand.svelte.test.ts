/**
 * `<PerformanceBand>` rendering tests.
 *
 * The band shows total fuel, reserve, ETE, and a CG-envelope graph;
 * colors the reserve by safety state.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-46.
 */

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PerformanceBand from '../PerformanceBand.svelte';
import { fixtureBundleWithPerformance } from './fixtures';

afterEach(cleanup);

const { performance, flight } = fixtureBundleWithPerformance;

describe('<PerformanceBand>', () => {
	it('renders total fuel, reserve, and ETE', () => {
		const { container } = render(PerformanceBand, { performance, aircraft: flight.aircraft });
		expect(container.querySelector('[data-testid="perf-total-fuel"]')?.textContent).toContain('3.9');
		expect(container.querySelector('[data-testid="perf-reserve"]')?.textContent).toContain('36.1');
		expect(container.querySelector('[data-testid="perf-ete"]')?.textContent).toContain('29 min');
	});

	it('renders the CG envelope graph', () => {
		const { container } = render(PerformanceBand, { performance, aircraft: flight.aircraft });
		expect(container.querySelector('.wb-envelope')).not.toBeNull();
		expect(container.querySelector('.wb-marker')).not.toBeNull();
	});

	it('marks a comfortable reserve as ok (green)', () => {
		const { container } = render(PerformanceBand, { performance, aircraft: flight.aircraft });
		expect(container.querySelector('.performance-ok')).not.toBeNull();
	});

	it('marks a thin reserve as low', () => {
		const thin = { ...performance, reserveGal: 5 };
		const { container } = render(PerformanceBand, { performance: thin, aircraft: flight.aircraft });
		expect(container.querySelector('.performance-low')).not.toBeNull();
	});

	it('marks a sub-30-minute reserve as critical', () => {
		const critical = { ...performance, reserveGal: 1 };
		const { container } = render(PerformanceBand, { performance: critical, aircraft: flight.aircraft });
		expect(container.querySelector('.performance-critical')).not.toBeNull();
	});
});

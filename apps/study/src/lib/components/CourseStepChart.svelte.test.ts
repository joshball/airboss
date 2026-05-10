/**
 * CourseStepChart placeholder behavior (course-reader-and-editor WP, Phase 8).
 *
 * The chart stub renders a bordered container with the slug visible in
 * dev mode, an empty wrapper in prod. Real chart rendering ships in a
 * follow-on WP; this test pins the placeholder contract so the follow-on
 * has a stable shape to swap.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CourseStepChart from './CourseStepChart.svelte';

afterEach(() => {
	cleanup();
});

describe('CourseStepChart', () => {
	it('renders a placeholder container with role figure', () => {
		render(CourseStepChart, { props: { slug: 'test-chart-slug' } });
		const figure = screen.getByLabelText('Chart placeholder');
		expect(figure).toBeInTheDocument();
		expect(figure.tagName.toLowerCase()).toBe('figure');
	});

	it('shows the slug in dev mode', () => {
		// vitest's `dev` flag from $app/environment is true by default in tests
		// (unless the test env overrides it), so the dev-mode caption appears.
		render(CourseStepChart, { props: { slug: 'sfc-analysis-2026-05-09' } });
		expect(screen.getByText(/sfc-analysis-2026-05-09/)).toBeInTheDocument();
	});
});

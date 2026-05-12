/**
 * CourseStepChart rendering behavior.
 *
 * The component embeds a chart SVG via `/api/charts/<slug>/chart.svg`.
 * These tests pin the rendered shape (figure + img + dev caption) without
 * exercising the network call -- the route's own tests cover the byte path.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CourseStepChart from './CourseStepChart.svelte';

afterEach(() => {
	cleanup();
});

describe('CourseStepChart', () => {
	it('renders a figure containing an <img> pointing at the /api/charts route', () => {
		const slug = 'wx-scenarios/frontal-xc-march/surface-analysis';
		render(CourseStepChart, { props: { slug } });
		const figure = screen.getByLabelText(`Chart: ${slug}`);
		expect(figure).toBeInTheDocument();
		expect(figure.tagName.toLowerCase()).toBe('figure');

		const img = screen.getByAltText(`Chart ${slug}`);
		expect(img.tagName.toLowerCase()).toBe('img');
		expect(img.getAttribute('src')).toBe(`/api/charts/${slug}/chart.svg`);
		expect(img.getAttribute('loading')).toBe('lazy');
	});

	it('shows the slug in dev mode', () => {
		// vitest's `import.meta.env.DEV` is true by default in tests, so the
		// dev-mode caption appears beneath the chart.
		render(CourseStepChart, { props: { slug: 'wx-scenarios/frontal-xc-march/cva' } });
		expect(screen.getByText(/wx-scenarios\/frontal-xc-march\/cva/)).toBeInTheDocument();
	});

	it('builds the URL from the slug without manual encoding', () => {
		// Slugs contain slashes; SvelteKit's `[...slug]` catch-all consumes them
		// transparently on the server side. Verify we don't pre-encode.
		const slug = 'reference-fixtures/wx-surface-analysis-2024-12-23-12z';
		render(CourseStepChart, { props: { slug } });
		const img = screen.getByAltText(`Chart ${slug}`);
		expect(img.getAttribute('src')).toBe(`/api/charts/${slug}/chart.svg`);
	});
});

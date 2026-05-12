/**
 * CourseStepMarkdown contract -- pins the directive-aware course-step body
 * renderer.
 *
 * Three behaviours are load-bearing:
 *
 *   1. Plain markdown (paragraphs, headings, lists) renders the standard
 *      `<MarkdownBody>` output without surprises.
 *   2. A `:::chart slug="..."` directive mounts `<CourseStepChart>`, which
 *      paints an `<img>` whose src points at `/api/charts/<slug>/chart.svg`.
 *   3. A `:::scenario slug="..."` directive mounts `<ScenarioPanel>`, which
 *      renders its aria-labelled briefing section.
 *
 * Parse errors render an inline error card with the failing message; an
 * unauthored body just produces no output.
 *
 * Runs under happy-dom via the `unit-dom` vitest project.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CourseStepMarkdown from './CourseStepMarkdown.svelte';

beforeEach(() => {
	// ScenarioPanel triggers a `fetch('/api/scenarios/<slug>/bundle.json')`
	// in `$effect` on mount. Under happy-dom there's no server, so absent a
	// stub the resulting unhandled rejection prints a noisy stack trace.
	// We don't care about the panel's loaded state in these tests -- only
	// that the directive routes to the component -- so a sentinel response
	// keeps the effect quiet.
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('null', { status: 404, statusText: 'Not Found' })),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

describe('CourseStepMarkdown', () => {
	it('renders standard markdown blocks via MarkdownBody', () => {
		render(CourseStepMarkdown, { props: { bodyMd: '## Heading\n\nA paragraph of text.' } });
		expect(screen.getByRole('heading', { level: 2, name: 'Heading' })).toBeInTheDocument();
		expect(screen.getByText(/A paragraph of text/)).toBeInTheDocument();
	});

	it('mounts <CourseStepChart> for a :::chart directive', () => {
		const body = ':::chart slug="wx-scenarios/frontal-xc-march/surface-analysis"\n:::';
		const { container } = render(CourseStepMarkdown, { props: { bodyMd: body } });
		const img = container.querySelector('img.chart-image');
		expect(img).not.toBeNull();
		expect(img?.getAttribute('src')).toBe('/api/charts/wx-scenarios/frontal-xc-march/surface-analysis/chart.svg');
	});

	it('mounts <ScenarioPanel> for a :::scenario directive', () => {
		render(CourseStepMarkdown, { props: { bodyMd: ':::scenario slug="frontal-xc-march"\n:::' } });
		// Panel exposes itself via an aria-label naming the scenario.
		const panel = screen.getByLabelText(/Scenario briefing:/);
		expect(panel).toBeInTheDocument();
	});

	it('renders an inline error for malformed directives', () => {
		render(CourseStepMarkdown, { props: { bodyMd: ':::chart slug="bogus"\n:::' } });
		expect(screen.getByText(/Markdown parse error/)).toBeInTheDocument();
	});

	it('renders both prose and a directive in document order', () => {
		const body = [
			'A pre-paragraph.',
			'',
			':::chart slug="wx-scenarios/frontal-xc-march/cva"',
			':::',
			'',
			'A post-paragraph.',
		].join('\n');
		const { container } = render(CourseStepMarkdown, { props: { bodyMd: body } });
		expect(screen.getByText('A pre-paragraph.')).toBeInTheDocument();
		expect(screen.getByText('A post-paragraph.')).toBeInTheDocument();
		expect(container.querySelector('img.chart-image')).not.toBeNull();
	});
});

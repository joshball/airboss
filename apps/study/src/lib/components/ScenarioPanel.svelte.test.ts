/**
 * ScenarioPanel contract -- three states the panel must render correctly:
 *
 *   - loading (no fetch resolution yet) -- the "Loading scenario ..." copy
 *   - error (fetch rejects or non-2xx) -- the error-card with the message
 *   - ready (fetch resolves with a bundle) -- header narrative, charts,
 *     product accordions, and grouped commentary
 *
 * Uses `vi.stubGlobal('fetch', ...)` to control the bundle the panel sees
 * without needing the server route. Runs under happy-dom via the
 * `unit-dom` vitest project.
 */

import { WX_SCENARIOS } from '@ab/constants';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScenarioPanel from './ScenarioPanel.svelte';

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

function stubFetchOk(bundle: unknown): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(JSON.stringify(bundle), { status: 200, headers: { 'Content-Type': 'application/json' } }),
		),
	);
}

function stubFetchError(status: number, statusText: string): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('null', { status, statusText })),
	);
}

describe('ScenarioPanel', () => {
	it('renders an error card when the bundle endpoint 404s', async () => {
		stubFetchError(404, 'Not Found');
		render(ScenarioPanel, { props: { slug: WX_SCENARIOS.FRONTAL_XC_MARCH } });

		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Scenario unavailable');
		expect(screen.getByRole('alert')).toHaveTextContent('404');
	});

	it('renders header, charts, products, and grouped commentary on success', async () => {
		const bundle = {
			scenarioId: WX_SCENARIOS.FRONTAL_XC_MARCH,
			truth: {
				scenarioId: WX_SCENARIOS.FRONTAL_XC_MARCH,
				validAt: '2026-03-19T19:00:00Z',
				primaryTimeZone: 'America/Chicago',
				narrative: 'Cold front, mid-west XC.',
			},
			commentary: [
				{
					id: 'cmt-1',
					target: { kind: 'metar', elementId: 'KSPI' },
					question: 'What changed at KSPI?',
					observation: 'KSPI is now post-frontal.',
					reason: 'The cold front crossed.',
					knowledgeNodeIds: ['wx-airmasses-and-fronts'],
					mode: 'socratic' as const,
				},
				{
					id: 'cmt-2',
					target: { kind: 'taf-period', elementId: 'KORD' },
					question: 'When does KORD shift?',
					observation: 'TAF carries an FM21Z.',
					reason: 'Frontal passage projected at 21Z.',
					knowledgeNodeIds: ['wx-reading-tafs'],
					mode: 'socratic' as const,
				},
			],
			products: {
				'metars.json': [{ station: 'KSTL' }],
				'tafs.json': null,
				'airmets.json': null,
				'pireps.json': null,
				'fb-bulletin.json': null,
			},
			chartSlugs: ['wx-scenarios/frontal-xc-march/surface-analysis'],
		};
		stubFetchOk(bundle);

		render(ScenarioPanel, { props: { slug: WX_SCENARIOS.FRONTAL_XC_MARCH } });

		await waitFor(() => {
			expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
		});
		// Header narrative and the slug chip
		expect(screen.getByText('Cold front, mid-west XC.')).toBeInTheDocument();
		expect(screen.getByText(WX_SCENARIOS.FRONTAL_XC_MARCH)).toBeInTheDocument();
		// Chart caption surfaces the chart kind extracted from the slug
		expect(screen.getByText('surface-analysis')).toBeInTheDocument();
		// Product summaries are keyed by filename minus the .json suffix
		expect(screen.getByText('metars')).toBeInTheDocument();
		// Commentary kinds get their own headers (`metar` and `taf-period`)
		expect(screen.getByText('metar')).toBeInTheDocument();
		expect(screen.getByText('taf-period')).toBeInTheDocument();
		// Socratic question text renders prominently
		expect(screen.getByText('What changed at KSPI?')).toBeInTheDocument();
	});

	it('asks the bundle endpoint for the correct slug', async () => {
		const fetchSpy = vi.fn(async () => new Response('null', { status: 404 }));
		vi.stubGlobal('fetch', fetchSpy);
		render(ScenarioPanel, { props: { slug: WX_SCENARIOS.MARINE_STRATUS_PACIFIC_NW } });

		await waitFor(() => {
			expect(fetchSpy).toHaveBeenCalled();
		});
		expect(fetchSpy).toHaveBeenCalledWith(`/api/scenarios/${WX_SCENARIOS.MARINE_STRATUS_PACIFIC_NW}/bundle.json`);
	});
});

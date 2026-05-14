/**
 * IA flow -- wide existence sweep.
 *
 * Walks the canonical study top-level routes and asserts each one renders
 * without console errors and exposes a `data-testid="page-anchor"`. The
 * flow is the proof-of-existence net; deep behavior tests live in their
 * own focused specs.
 *
 * Phase 4 (per study-app-ia-cleanup tasks.md 4.2 + 4.3): final FLOW
 * locked. Includes the new `/study/learn` index, every Learn sub-section
 * (Cards / Reps / Read), every Insights child, every Reference child,
 * and every Program tab. The Phase 4 CI guard relies on this being the
 * complete top-level route map -- if you add a new top-level route, add
 * it here and assert its page-anchor.
 */

import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

interface Stop {
	label: string;
	path: string;
	subAnchors?: ReadonlyArray<string>;
}

const FLOW: ReadonlyArray<Stop> = [
	{ label: 'home', path: ROUTES.STUDY },
	// Learn section -- consolidated Cards / Reps / Read (Phase 4).
	// The Learn tab strip lives on every section index and exposes
	// `learn-tab-{name}` anchors; assert them on the index pages.
	{
		label: 'learn',
		path: ROUTES.LEARN,
		subAnchors: ['learn-tab-overview', 'learn-tab-cards', 'learn-tab-reps', 'learn-tab-read'],
	},
	{
		label: 'learn-cards',
		path: ROUTES.MEMORY,
		subAnchors: ['learn-tab-cards'],
	},
	{ label: 'learn-cards-browse', path: ROUTES.MEMORY_BROWSE },
	{ label: 'learn-cards-new', path: ROUTES.MEMORY_NEW },
	{
		label: 'learn-reps',
		path: ROUTES.REPS,
		subAnchors: ['learn-tab-reps'],
	},
	{ label: 'learn-reps-browse', path: ROUTES.REPS_BROWSE },
	// `/library` retired in the study app per ADR 023: the reader cut over
	// to the flightbag origin. The legacy URL is a 301 to flightbag (a
	// sibling origin), which trips `net::ERR_INVALID_REDIRECT` in the
	// study-baseURL sweep. The flightbag's own reader coverage lives in
	// `tests/e2e/flightbag/`.
	// Courses section -- instructor-authored courses index (course-primitive WP).
	{ label: 'courses', path: ROUTES.COURSES },
	// Program section -- Quals / Goal / Plan / Coverage (Phase 2).
	{
		label: 'program',
		path: ROUTES.PROGRAM,
		// `/program` redirects to the active sub-tab; the sub-tab anchors
		// live in the `/program/+layout.svelte` strip and stay visible on
		// every child route.
		subAnchors: ['program-tab-quals', 'program-tab-goal', 'program-tab-plan', 'program-tab-coverage'],
	},
	// Insights section -- consolidated stats / calibration / lens (Phase 3).
	{ label: 'insights', path: ROUTES.INSIGHTS },
	{ label: 'insights-calibration', path: ROUTES.INSIGHTS_CALIBRATION },
	{ label: 'insights-lens-handbook', path: ROUTES.INSIGHTS_LENS_HANDBOOK },
	{ label: 'insights-lens-weakness', path: ROUTES.INSIGHTS_LENS_WEAKNESS },
	// Reference section -- knowledge graph / glossary (Phase 3).
	{ label: 'reference', path: ROUTES.REFERENCE },
	{ label: 'reference-knowledge', path: ROUTES.REFERENCE_KNOWLEDGE },
	{ label: 'reference-glossary', path: ROUTES.REFERENCE_GLOSSARY },
];

function attachErrorTrap(page: Page): { errors: string[] } {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(`pageerror: ${err}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
	});
	return { errors };
}

test.describe('IA flow -- existence sweep', () => {
	test('every top-level route renders without errors', async ({ page }) => {
		const { errors } = attachErrorTrap(page);
		for (const stop of FLOW) {
			const res = await page.goto(stop.path);
			expect(res?.status(), `expected 2xx for ${stop.path}`).toBeLessThan(400);
			await expect(page.getByTestId('page-anchor').first(), `page-anchor missing on ${stop.label}`).toBeVisible();
			for (const sub of stop.subAnchors ?? []) {
				await expect(page.getByTestId(sub), `sub-anchor ${sub} missing on ${stop.label}`).toBeVisible();
			}
		}
		expect(errors, `runtime errors during flow:\n${errors.join('\n')}`).toEqual([]);
	});

	// Phase 4 CI guard -- the locked top-nav testids are the contract. Any
	// regression that drops or renames a top-level nav entry without updating
	// this list (and the FLOW above) fails here. Adding a new entry requires
	// extending the list intentionally (e.g. `nav-courses` for the
	// course-primitive WP).
	test('top nav exposes the locked testids', async ({ page }) => {
		await page.goto(ROUTES.STUDY);
		const required = ['nav-home', 'nav-learn', 'nav-courses', 'nav-program', 'nav-insights', 'nav-reference'];
		for (const id of required) {
			await expect(page.getByTestId(id), `${id} missing from top nav`).toBeVisible();
		}
		// Old testids that lived on dropdown summaries / standalone links must
		// be gone after Phase 4. A leftover would mean the cleanup missed a
		// site.
		const removed = ['nav-memory', 'nav-reps', 'nav-flight', 'nav-help'];
		for (const id of removed) {
			await expect(page.getByTestId(id), `legacy nav id ${id} still present`).toHaveCount(0);
		}
	});
});

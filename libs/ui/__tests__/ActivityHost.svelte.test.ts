/**
 * ActivityHost DOM contract -- known activityId renders the registered
 * component inside a <figure>; unknown activityId renders an inert
 * "not yet registered" aside (no activity component in the tree).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ActivityHostHarness from './harnesses/ActivityHostHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('ActivityHost -- unknown activityId', () => {
	it('does not render the known-activity figure when activityId is not registered', () => {
		render(ActivityHostHarness, { activityId: 'not-a-real-activity' });
		expect(screen.queryByTestId('activity-host-known')).toBeNull();
	});

	it('renders the unknown-activity aside with role=note for unknown activityId', () => {
		render(ActivityHostHarness, { activityId: 'not-a-real-activity' });
		const unknown = screen.getByTestId('activity-host-unknown');
		expect(unknown).toBeInTheDocument();
		expect(unknown.getAttribute('role')).toBe('note');
	});

	it('echoes the unknown activityId via data-activity-id', () => {
		render(ActivityHostHarness, { activityId: 'mystery-id' });
		expect(screen.getByTestId('activity-host-unknown').getAttribute('data-activity-id')).toBe('mystery-id');
	});
});

describe('ActivityHost -- known activityId', () => {
	it('renders the known-activity <figure> for activityId="crosswind-component"', () => {
		render(ActivityHostHarness, { activityId: 'crosswind-component' });
		const known = screen.getByTestId('activity-host-known');
		expect(known).toBeInTheDocument();
		expect(known.tagName).toBe('FIGURE');
		expect(known.getAttribute('data-activity-id')).toBe('crosswind-component');
	});

	it('mounts the CrosswindComponent inside the figure', () => {
		const { container } = render(ActivityHostHarness, { activityId: 'crosswind-component' });
		// CrosswindComponent renders an svg.compass + a wind-handle group.
		// We use those as a stable existence check rather than asserting
		// the entire CrosswindComponent DOM here.
		expect(container.querySelector('[data-testid="activity-host-known"] svg.compass')).toBeInTheDocument();
	});

	it('does not render the unknown-activity aside when activityId is registered', () => {
		render(ActivityHostHarness, { activityId: 'crosswind-component' });
		expect(screen.queryByTestId('activity-host-unknown')).toBeNull();
	});

	it('renders a figcaption explaining the activity', () => {
		const { container } = render(ActivityHostHarness, { activityId: 'crosswind-component' });
		const caption = container.querySelector('[data-testid="activity-host-known"] figcaption');
		expect(caption).toBeInTheDocument();
		expect(caption?.textContent).toContain('crosswind');
	});
});

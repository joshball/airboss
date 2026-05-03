/**
 * Smoke tests for `<RenderedSection>`. Locks in the props contract so
 * follow-on rendering WPs can swap the implementation without breaking
 * flightbag consumers.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RenderedSection from '../src/RenderedSection.svelte';

afterEach(() => {
	cleanup();
});

describe('<RenderedSection>', () => {
	it('renders the title in a heading', () => {
		render(RenderedSection, {
			title: 'Forces in Flight',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: 'Lift opposes weight; thrust opposes drag.',
		});
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Forces in Flight');
	});

	it('renders the body when present', () => {
		render(RenderedSection, {
			title: 'Forces in Flight',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: 'Lift opposes weight; thrust opposes drag.',
		});
		expect(screen.getByTestId('rendered-section').textContent).toContain('Lift opposes weight');
	});

	it('shows the empty placeholder when body is empty', () => {
		render(RenderedSection, {
			title: 'Empty Section',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: '',
		});
		expect(screen.queryByTestId('rendered-section-empty')).not.toBeNull();
	});

	it('exposes the citable identifier on the root element', () => {
		render(RenderedSection, {
			title: 'Forces in Flight',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: 'body',
		});
		expect(screen.getByTestId('rendered-section').getAttribute('data-ref-id')).toBe(
			'airboss-ref:handbooks/phak/8083-25C/2/3',
		);
	});
});

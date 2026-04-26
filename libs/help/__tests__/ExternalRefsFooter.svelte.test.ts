/**
 * ExternalRefsFooter DOM contract -- per-ref title link, source badge,
 * optional note, hidden when refs empty/undefined.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ExternalRefsFooter from '../src/ui/ExternalRefsFooter.svelte';

afterEach(() => {
	cleanup();
});

describe('ExternalRefsFooter -- empty', () => {
	it('renders nothing when refs is undefined', () => {
		const { container } = render(ExternalRefsFooter, { refs: undefined });
		expect(container.querySelector('[data-testid="externalrefsfooter-root"]')).toBeNull();
	});

	it('renders nothing when refs is an empty array', () => {
		const { container } = render(ExternalRefsFooter, { refs: [] });
		expect(container.querySelector('[data-testid="externalrefsfooter-root"]')).toBeNull();
	});
});

describe('ExternalRefsFooter -- populated', () => {
	const refs = [
		{ url: 'https://faa.gov/x', title: 'Faa Reg X', source: 'faa' as const },
		{ url: 'https://other.example/y', title: 'Other doc', source: 'other' as const, note: 'A relevant note.' },
	];

	it('renders root section with the heading', () => {
		render(ExternalRefsFooter, { refs });
		expect(screen.getByTestId('externalrefsfooter-root')).toBeTruthy();
		expect(screen.getByTestId('externalrefsfooter-heading').textContent).toBe('External references');
	});

	it('renders one item per ref with the right title link and source badge', () => {
		render(ExternalRefsFooter, { refs });
		const title0 = screen.getByTestId('externalrefsfooter-title-0');
		expect(title0.tagName).toBe('A');
		expect(title0.getAttribute('href')).toBe('https://faa.gov/x');
		expect(title0.getAttribute('target')).toBe('_blank');
		expect(title0.getAttribute('rel')).toBe('noopener noreferrer');
		expect(screen.getByTestId('externalrefsfooter-source-0').textContent).toBe('faa');
		expect(screen.getByTestId('externalrefsfooter-source-1').textContent).toBe('other');
	});

	it('renders note when present, omits when absent', () => {
		render(ExternalRefsFooter, { refs });
		expect(screen.queryByTestId('externalrefsfooter-note-0')).toBeNull();
		expect(screen.getByTestId('externalrefsfooter-note-1').textContent).toBe('A relevant note.');
	});
});

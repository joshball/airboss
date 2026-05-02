/**
 * Breadcrumbs DOM contract -- list of crumbs with `/` separators, last
 * item carries `aria-current="page"` when its `href` is omitted, and the
 * wrapping `<nav>` exposes the breadcrumb pattern.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BreadcrumbsHarness from './harnesses/BreadcrumbsHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Breadcrumbs', () => {
	it('renders the wrapping <nav> with default aria-label', () => {
		render(BreadcrumbsHarness, { items: [{ label: 'Home', href: '/' }] });
		const nav = screen.getByTestId('breadcrumbs-root');
		expect(nav.tagName).toBe('NAV');
		expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
	});

	it('passes ariaLabel through', () => {
		render(BreadcrumbsHarness, { items: [{ label: 'Home', href: '/' }], ariaLabel: 'You are here' });
		expect(screen.getByTestId('breadcrumbs-root').getAttribute('aria-label')).toBe('You are here');
	});

	it('renders crumbs with hrefs as anchors', () => {
		render(BreadcrumbsHarness, {
			items: [
				{ label: 'Sources', href: '/sources' },
				{ label: 'Detail', href: '/sources/abc' },
			],
		});
		const anchors = screen.getAllByRole('link');
		expect(anchors).toHaveLength(2);
		expect(anchors[0].getAttribute('href')).toBe('/sources');
		expect(anchors[1].getAttribute('href')).toBe('/sources/abc');
	});

	it('renders the last hrefless item as the current page', () => {
		render(BreadcrumbsHarness, {
			items: [{ label: 'Sources', href: '/sources' }, { label: 'src_abc' }],
		});
		const anchors = screen.getAllByRole('link');
		expect(anchors).toHaveLength(1);
		const current = screen.getByText('src_abc');
		expect(current.getAttribute('aria-current')).toBe('page');
	});

	it('inserts a `/` separator between crumbs (n - 1 separators for n items)', () => {
		render(BreadcrumbsHarness, {
			items: [{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }, { label: 'C' }],
		});
		const root = screen.getByTestId('breadcrumbs-root');
		const seps = root.querySelectorAll('span[aria-hidden="true"]');
		expect(seps).toHaveLength(2);
		seps.forEach((sep) => {
			expect(sep.textContent).toBe('/');
		});
	});

	it('renders no separators for a single-item trail', () => {
		render(BreadcrumbsHarness, { items: [{ label: 'Solo' }] });
		const seps = screen.getByTestId('breadcrumbs-root').querySelectorAll('span[aria-hidden="true"]');
		expect(seps).toHaveLength(0);
	});

	it('applies the mono class when item.mono is true', () => {
		render(BreadcrumbsHarness, {
			items: [
				{ label: 'Sources', href: '/sources' },
				{ label: 'src_abc', mono: true },
			],
		});
		expect(screen.getByText('src_abc').classList.contains('mono')).toBe(true);
		expect(screen.getByText('Sources').classList.contains('mono')).toBe(false);
	});
});

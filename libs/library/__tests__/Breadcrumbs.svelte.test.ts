/**
 * Tests for `<Breadcrumbs>`. Covers the link/non-link split, screen-reader
 * surface (the current segment is `aria-current`), and edge cases (single
 * segment, all-current, all-linked).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Breadcrumbs from '../src/Breadcrumbs.svelte';

afterEach(() => {
	cleanup();
});

describe('<Breadcrumbs>', () => {
	it('renders ordered segments with links for non-final entries', () => {
		render(Breadcrumbs, {
			segments: [
				{ label: 'Flightbag', href: '/' },
				{ label: 'Handbooks', href: '/handbooks' },
				{ label: 'Instrument Flying Handbook', href: '/handbook/ifh/8083-15B' },
				{ label: 'Chapter 1', href: '/handbook/ifh/8083-15B/1' },
				{ label: '§1.2 Airspace', href: null },
			],
		});

		const flightbag = screen.getByRole('link', { name: 'Flightbag' });
		expect(flightbag.getAttribute('href')).toBe('/');
		expect(screen.getByRole('link', { name: 'Handbooks' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Instrument Flying Handbook' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Chapter 1' })).toBeInTheDocument();

		// Final segment is plain text, not a link.
		expect(screen.queryByRole('link', { name: '§1.2 Airspace' })).toBeNull();
		expect(screen.getByText('§1.2 Airspace')).toBeInTheDocument();
	});

	it('marks the current segment with aria-current="page"', () => {
		render(Breadcrumbs, {
			segments: [
				{ label: 'Flightbag', href: '/' },
				{ label: 'Current', href: null },
			],
		});

		const current = screen.getByText('Current');
		expect(current.getAttribute('aria-current')).toBe('page');
	});

	it('handles a single-segment trail (current page only)', () => {
		render(Breadcrumbs, {
			segments: [{ label: 'Flightbag', href: null }],
		});
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.getByText('Flightbag')).toBeInTheDocument();
	});

	it('handles all-linked segments (no current page)', () => {
		// Edge case -- callers should always end with a non-link, but the
		// component shouldn't crash if someone passes all-href.
		render(Breadcrumbs, {
			segments: [
				{ label: 'A', href: '/a' },
				{ label: 'B', href: '/b' },
			],
		});
		expect(screen.getByRole('link', { name: 'A' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'B' })).toBeInTheDocument();
	});

	it('exposes nav with aria-label="Breadcrumb"', () => {
		render(Breadcrumbs, {
			segments: [
				{ label: 'A', href: '/a' },
				{ label: 'B', href: null },
			],
		});
		expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
	});

	it('separator is hidden from assistive tech', () => {
		const { container } = render(Breadcrumbs, {
			segments: [
				{ label: 'A', href: '/a' },
				{ label: 'B', href: '/b' },
				{ label: 'C', href: null },
			],
		});
		const seps = container.querySelectorAll('.sep');
		// Two separators between three segments.
		expect(seps.length).toBe(2);
		seps.forEach((sep) => {
			expect(sep.getAttribute('aria-hidden')).toBe('true');
		});
	});
});

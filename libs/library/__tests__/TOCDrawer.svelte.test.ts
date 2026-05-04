/**
 * Tests for `<TOCDrawer>`. Covers:
 *   - entries render with correct hrefs / labels
 *   - the active entry is marked aria-current="page" + visually highlighted
 *   - readSet checkmarks render and screen-reader labels include "(read)"
 *   - mobile toggle exposes aria-expanded + aria-controls
 *   - heading link / non-link variant
 *   - minutes-to-read summary at the top + per-entry
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TOCDrawerEntry } from '../src/TOCDrawer.svelte';
import TOCDrawer from '../src/TOCDrawer.svelte';

afterEach(() => {
	cleanup();
});

const sampleEntries: TOCDrawerEntry[] = [
	{ sectionId: 'ch1', code: 'Ch 1', title: 'The NAS', depth: 0, href: '/h/1', minutesToRead: 5, isActive: false },
	{ sectionId: 's1.1', code: '§1.1', title: 'Intro', depth: 1, href: '/h/1/1', minutesToRead: 2, isActive: false },
	{ sectionId: 's1.2', code: '§1.2', title: 'Airspace', depth: 1, href: '/h/1/2', minutesToRead: 4, isActive: true },
	{ sectionId: 'ch2', code: 'Ch 2', title: 'Charts', depth: 0, href: '/h/2', minutesToRead: 8, isActive: false },
];

describe('<TOCDrawer>', () => {
	it('renders heading + every entry as a link', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'Instrument Flying Handbook',
		});

		expect(screen.getByText('Instrument Flying Handbook')).toBeInTheDocument();
		// Entries become links when href is supplied.
		expect(screen.getByRole('link', { name: /Ch 1.*The NAS/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /§1\.2.*Airspace/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Ch 2.*Charts/i })).toBeInTheDocument();
	});

	it('marks the active entry with aria-current="page"', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
		});

		const active = screen.getByRole('link', { name: /§1\.2.*Airspace/i });
		expect(active.getAttribute('aria-current')).toBe('page');

		const inactive = screen.getByRole('link', { name: /§1\.1.*Intro/i });
		expect(inactive.getAttribute('aria-current')).toBeNull();
	});

	it('renders a checkmark and "(read)" for entries in readSet', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
			readSet: new Set(['ch1', 's1.1']),
		});

		// "(read)" is part of the aria-label for readSet entries -- the
		// glyph itself is aria-hidden.
		const ch1Link = screen.getByRole('link', { name: /Ch 1.*The NAS.*\(read\)/i });
		expect(ch1Link).toBeInTheDocument();
		const s11Link = screen.getByRole('link', { name: /§1\.1.*Intro.*\(read\)/i });
		expect(s11Link).toBeInTheDocument();

		// Unread entries don't get the marker.
		const s12Link = screen.getByRole('link', { name: /§1\.2.*Airspace/i });
		expect(s12Link.getAttribute('aria-label')).not.toMatch(/\(read\)/);
	});

	it('renders entries without href as plain text', () => {
		render(TOCDrawer, {
			entries: [
				{ sectionId: 'x', code: 'X', title: 'No href', depth: 0, href: null, minutesToRead: 0, isActive: false },
			],
			heading: 'IFH',
		});

		expect(screen.queryByRole('link', { name: /No href/i })).toBeNull();
		expect(screen.getByText('No href')).toBeInTheDocument();
	});

	it('renders summary line under heading when supplied', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
			summary: 'Read 1 of 4 sections',
		});
		expect(screen.getByText('Read 1 of 4 sections')).toBeInTheDocument();
	});

	it('uses heading as a link when headingHref is supplied', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
			headingHref: '/handbook/ifh/8083-15B',
		});

		const headingLink = screen.getByRole('link', { name: 'IFH' });
		expect(headingLink.getAttribute('href')).toBe('/handbook/ifh/8083-15B');
	});

	it('renders headed section as a non-link <h2> when no headingHref', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
		});
		expect(screen.queryByRole('link', { name: 'IFH' })).toBeNull();
		expect(screen.getByRole('heading', { name: 'IFH', level: 2 })).toBeInTheDocument();
	});

	it('mobile toggle exposes aria-expanded + aria-controls and flips on click', async () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
		});

		const toggle = screen.getByRole('button', { name: /Contents/ });
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(toggle.getAttribute('aria-controls')).toBe('toc-drawer-list');

		await fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');

		await fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
	});

	it('mobile toggle reflects total minutes when present', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
		});
		// Ch 1 (5) + 1.1 (2) + 1.2 (4) + Ch 2 (8) = 19
		const toggle = screen.getByRole('button', { name: /Contents/ });
		expect(toggle.textContent).toMatch(/19 min/);
	});

	it('mobile toggle hides the minutes pill when total is zero', () => {
		render(TOCDrawer, {
			entries: [{ sectionId: 'a', code: 'A', title: 'A', depth: 0, href: '/a', minutesToRead: 0, isActive: false }],
			heading: 'IFH',
		});
		const toggle = screen.getByRole('button', { name: /Contents/ });
		expect(toggle.textContent).not.toMatch(/min/);
	});

	it('renders per-entry minutes when > 0', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
		});
		// Each entry's minutes appear inside the link.
		expect(screen.getByRole('link', { name: /Ch 1.*5 min/i })).toBeInTheDocument();
	});

	it('initiallyOpenOnMobile sets aria-expanded=true on first render', () => {
		render(TOCDrawer, {
			entries: sampleEntries,
			heading: 'IFH',
			initiallyOpenOnMobile: true,
		});
		const toggle = screen.getByRole('button', { name: /Contents/ });
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
	});
});

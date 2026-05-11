/**
 * Tests for `<ReaderEmptyState>`. Verifies the per-kind defaults render and
 * that callers can override badge/heading/note/external-label, plus that
 * `localPdfHref` and `externalUrl` produce action links only when provided.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ReaderEmptyState from '../src/ReaderEmptyState.svelte';

afterEach(() => {
	cleanup();
});

describe('<ReaderEmptyState>', () => {
	it('renders the sourced-only defaults', () => {
		const { container } = render(ReaderEmptyState, { kind: 'sourced-only' });
		const root = container.querySelector('[data-testid="reader-empty-state"]');
		expect(root?.getAttribute('data-kind')).toBe('sourced-only');
		expect(screen.getByText('Sourced only')).toBeInTheDocument();
		expect(screen.getByRole('heading')).toHaveTextContent("This document hasn't been ingested yet.");
	});

	it('renders the not-yet-ingested defaults', () => {
		render(ReaderEmptyState, { kind: 'not-yet-ingested' });
		expect(screen.getByText('Not yet ingested')).toBeInTheDocument();
		expect(screen.getByRole('heading')).toHaveTextContent("This section hasn't been ingested into the reader yet.");
	});

	it('renders the no-children defaults', () => {
		render(ReaderEmptyState, { kind: 'no-children' });
		expect(screen.getByText('Empty')).toBeInTheDocument();
		expect(screen.getByRole('heading')).toHaveTextContent('No entries to show yet.');
	});

	it('shows a local PDF link when localPdfHref is set', () => {
		render(ReaderEmptyState, {
			kind: 'sourced-only',
			localPdfHref: '/source-pdf/handbooks/phak/x.pdf',
		});
		const link = screen.getByRole('link', { name: 'Local PDF' });
		expect(link.getAttribute('href')).toBe('/source-pdf/handbooks/phak/x.pdf');
	});

	it('shows an external link when externalUrl is set', () => {
		render(ReaderEmptyState, {
			kind: 'not-yet-ingested',
			externalUrl: 'https://www.ecfr.gov/x',
		});
		const link = screen.getByRole('link', { name: /Online/ });
		expect(link.getAttribute('href')).toBe('https://www.ecfr.gov/x');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('honors the externalLabel prop', () => {
		render(ReaderEmptyState, {
			kind: 'not-yet-ingested',
			externalUrl: 'https://www.ecfr.gov/x',
			externalLabel: 'Open §91.107 on eCFR',
		});
		const link = screen.getByRole('link', { name: /Open §91\.107 on eCFR/ });
		expect(link).toBeInTheDocument();
	});

	it('renders neither action when both URLs are absent', () => {
		render(ReaderEmptyState, { kind: 'no-children' });
		expect(screen.queryAllByRole('link').length).toBe(0);
	});

	it('honors badge / heading / note overrides', () => {
		render(ReaderEmptyState, {
			kind: 'sourced-only',
			badge: 'Hello',
			heading: 'Header',
			note: 'Body copy.',
		});
		expect(screen.getByText('Hello')).toBeInTheDocument();
		expect(screen.getByRole('heading')).toHaveTextContent('Header');
		expect(screen.getByText('Body copy.')).toBeInTheDocument();
	});
});

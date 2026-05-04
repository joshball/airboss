/**
 * Smoke tests for `<SourceLinks>`. Covers the four states of the small
 * "Source" cluster: both links present, online-only (AIM/CFR), local-PDF
 * missing (fresh dev box), and the no-source-at-all path (no render).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SourceLinks from '../src/SourceLinks.svelte';

afterEach(() => {
	cleanup();
});

describe('<SourceLinks>', () => {
	it('renders both the local PDF link and the online source link when both are present', () => {
		render(SourceLinks, {
			localPdfHref: '/source-pdf/handbooks/ifh/FAA-H-8083-15B/FAA-H-8083-15B.pdf',
			onlineUrl: 'https://www.faa.gov/.../FAA-H-8083-15B.pdf',
		});
		const localLink = screen.getByRole('link', { name: /Local PDF/i });
		const onlineLink = screen.getByRole('link', { name: /Online source/i });
		expect(localLink).not.toBeNull();
		expect(onlineLink).not.toBeNull();
		expect(localLink.getAttribute('href')).toContain('/source-pdf/handbooks/ifh/');
		expect(onlineLink.getAttribute('href')).toContain('https://');
	});

	it('renders only the online source link when no local PDF exists', () => {
		render(SourceLinks, {
			localPdfHref: null,
			onlineUrl: 'https://www.ecfr.gov/current/title-14/part-91/section-91.103',
			localPdfMissing: false,
		});
		expect(screen.queryByRole('link', { name: /Local PDF/i })).toBeNull();
		expect(screen.getByRole('link', { name: /Online source/i })).not.toBeNull();
		expect(screen.queryByTestId('source-links-missing')).toBeNull();
	});

	it('shows a "not yet downloaded" hint when the corpus has a PDF but the cache is empty', () => {
		render(SourceLinks, {
			localPdfHref: null,
			onlineUrl: 'https://www.faa.gov/.../FAA-H-8083-15B.pdf',
			localPdfMissing: true,
		});
		const hint = screen.queryByTestId('source-links-missing');
		expect(hint).not.toBeNull();
		expect(hint?.textContent ?? '').toMatch(/not yet downloaded/i);
	});

	it('renders nothing when neither a local PDF nor an online URL is available', () => {
		const { container } = render(SourceLinks, {
			localPdfHref: null,
			onlineUrl: null,
			localPdfMissing: false,
		});
		expect(container.querySelector('[data-testid="source-links"]')).toBeNull();
	});
});

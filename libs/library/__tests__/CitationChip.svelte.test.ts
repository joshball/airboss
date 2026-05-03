/**
 * Smoke tests for `<CitationChip>`. Verifies the URI -> URL bridge wires
 * through `urlForReference` and the resulting anchor uses the right
 * flightbag path. Locks in the props contract for follow-on label-resolution
 * work.
 */

import { ROUTES } from '@ab/constants';
import type { SourceId } from '@ab/sources';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CitationChip from '../src/CitationChip.svelte';

afterEach(() => {
	cleanup();
});

const id = (s: string): SourceId => s as SourceId;

describe('<CitationChip>', () => {
	it('renders an anchor whose href routes through urlForReference', () => {
		render(CitationChip, { uri: id('airboss-ref:handbooks/phak/8083-25C/2/3') });
		const chip = screen.getByTestId('citation-chip');
		expect(chip.getAttribute('href')).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '2', '3'),
		);
	});

	it('falls back to the URI text when no label is supplied', () => {
		const uri = 'airboss-ref:regs/cfr-14/91/103';
		render(CitationChip, { uri: id(uri) });
		expect(screen.getByTestId('citation-chip').textContent?.trim()).toBe(uri);
	});

	it('uses the custom label when provided', () => {
		render(CitationChip, {
			uri: id('airboss-ref:regs/cfr-14/91/103'),
			label: '14 CFR 91.103',
		});
		expect(screen.getByTestId('citation-chip').textContent?.trim()).toBe('14 CFR 91.103');
	});

	it('preserves the URI on a data attribute for cross-cutting code', () => {
		const uri = 'airboss-ref:ac/61-65/j';
		render(CitationChip, { uri: id(uri) });
		expect(screen.getByTestId('citation-chip').getAttribute('data-ref-uri')).toBe(uri);
	});
});

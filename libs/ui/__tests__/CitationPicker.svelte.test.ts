/**
 * CitationPicker DOM contract -- dialog gating + tab structure when open.
 *
 * Deeper interactions (search debounce, external-ref form) reach into the
 * /api/citations/search endpoint and are out of scope for a DOM unit test.
 * They live in app-level e2e/integration tests instead.
 */

import { CITATION_TARGET_TYPES } from '@ab/constants';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CitationPicker from '../src/components/CitationPicker.svelte';

afterEach(() => {
	cleanup();
});

describe('CitationPicker -- closed', () => {
	it('renders nothing visible when open=false', () => {
		const { container } = render(CitationPicker, {
			open: false,
			targetTypes: [CITATION_TARGET_TYPES.REGULATION_NODE],
			onSelect: vi.fn(),
		});
		// Dialog wrapper itself may not render any panel content while closed.
		expect(container.querySelector('[data-testid="citationpicker-tabs"]')).toBeNull();
	});
});

describe('CitationPicker -- open', () => {
	it('reflects the active target type via data-active-type', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.REGULATION_NODE, CITATION_TARGET_TYPES.AC_REF],
			onSelect: vi.fn(),
		});
		expect(screen.getByTestId('citationpicker-body').getAttribute('data-active-type')).toBe(
			CITATION_TARGET_TYPES.REGULATION_NODE,
		);
	});

	it('renders one tab button per allowed target type when more than one is allowed', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.REGULATION_NODE, CITATION_TARGET_TYPES.AC_REF],
			onSelect: vi.fn(),
		});
		expect(screen.getByTestId(`citationpicker-tab-${CITATION_TARGET_TYPES.REGULATION_NODE}`)).toBeTruthy();
		expect(screen.getByTestId(`citationpicker-tab-${CITATION_TARGET_TYPES.AC_REF}`)).toBeTruthy();
	});

	it('omits the tab strip when only one target type is allowed', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.EXTERNAL_REF],
			onSelect: vi.fn(),
		});
		expect(screen.queryByTestId('citationpicker-tabs')).toBeNull();
	});
});

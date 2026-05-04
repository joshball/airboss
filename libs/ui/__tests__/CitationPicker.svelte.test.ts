/**
 * CitationPicker DOM contract -- dialog gating + tab structure when open.
 *
 * Deeper interactions (search debounce, external-ref form) reach into the
 * /api/citations/search endpoint and are out of scope for a DOM unit test.
 * They live in app-level e2e/integration tests instead.
 *
 * The "stuck-loading on tab swap" regression test below stubs `fetch` with
 * a never-resolving promise so we can flip tabs while the search is still
 * in flight and verify the spinner clears.
 */

import { CITATION_TARGET_TYPES } from '@ab/constants';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CitationPicker from '../src/components/CitationPicker.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

beforeEach(() => {
	// Default fetch stub: resolves to an empty result set so any background
	// search the picker fires off doesn't hang the test.
	vi.stubGlobal(
		'fetch',
		vi.fn(() =>
			Promise.resolve(
				new Response(JSON.stringify({ results: [] }), {
					headers: { 'content-type': 'application/json' },
				}),
			),
		),
	);
});

describe('CitationPicker -- closed', () => {
	it('renders nothing visible when open=false', () => {
		const { container } = render(CitationPicker, {
			open: false,
			targetTypes: [CITATION_TARGET_TYPES.REFERENCE_SECTION],
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
			targetTypes: [CITATION_TARGET_TYPES.REFERENCE_SECTION, CITATION_TARGET_TYPES.KNOWLEDGE_NODE],
			onSelect: vi.fn(),
		});
		expect(screen.getByTestId('citationpicker-body').getAttribute('data-active-type')).toBe(
			CITATION_TARGET_TYPES.REFERENCE_SECTION,
		);
	});

	it('renders one tab button per allowed target type when more than one is allowed', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.REFERENCE_SECTION, CITATION_TARGET_TYPES.KNOWLEDGE_NODE],
			onSelect: vi.fn(),
		});
		expect(screen.getByTestId(`citationpicker-tab-${CITATION_TARGET_TYPES.REFERENCE_SECTION}`)).toBeInTheDocument();
		expect(screen.getByTestId(`citationpicker-tab-${CITATION_TARGET_TYPES.KNOWLEDGE_NODE}`)).toBeInTheDocument();
	});

	it('omits the tab strip when only one target type is allowed', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.EXTERNAL_REF],
			onSelect: vi.fn(),
		});
		expect(screen.queryByTestId('citationpicker-tabs')).toBeNull();
	});

	it('uses Dialog primitive for chrome (role=dialog, dialog-close button present)', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.REFERENCE_SECTION],
			onSelect: vi.fn(),
		});
		const panel = screen.getByTestId('dialog-panel');
		expect(panel.getAttribute('role')).toBe('dialog');
		expect(panel.getAttribute('aria-modal')).toBe('true');
		expect(screen.getByTestId('dialog-close')).toBeInTheDocument();
	});

	it('uses Button primitive for footer Cancel + Submit actions', () => {
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.REFERENCE_SECTION],
			onSelect: vi.fn(),
		});
		expect(screen.getByTestId('citationpicker-cancel')).toBeInTheDocument();
		expect(screen.getByTestId('citationpicker-submit')).toBeInTheDocument();
	});
});

describe('CitationPicker -- stuck-loading regression', () => {
	it('clears the spinner when the user switches to External-Ref while a search is in flight', async () => {
		// fetch never resolves -- mirrors a user swapping tabs faster than
		// the network responds. Without the searchToken fix, `loading` would
		// stay true forever because `runSearch.finally` only cleared it
		// when targetType === activeType.
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise(() => {})),
		);
		render(CitationPicker, {
			open: true,
			targetTypes: [CITATION_TARGET_TYPES.REFERENCE_SECTION, CITATION_TARGET_TYPES.EXTERNAL_REF],
			onSelect: vi.fn(),
		});
		const search = screen.getByLabelText(/Search Reference section/i) as HTMLInputElement;
		// Trigger the debounced search.
		search.value = 'foo';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		// Let the 200ms debounce fire and `loading=true` flush.
		await new Promise((resolve) => setTimeout(resolve, 250));
		// Switch to External-Ref while the fetch is still pending.
		const externalTab = screen.getByTestId(`citationpicker-tab-${CITATION_TARGET_TYPES.EXTERNAL_REF}`);
		externalTab.click();
		// External-Ref renders the URL field; the search-results "Loading..."
		// state must not be visible after the swap.
		await waitFor(() => {
			expect(screen.queryByText('Loading...')).toBeNull();
		});
	});
});

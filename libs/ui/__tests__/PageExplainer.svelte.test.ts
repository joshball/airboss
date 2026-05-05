/**
 * PageExplainer DOM contract:
 *   - Open by default. Body + collapse button visible.
 *   - Collapse -> body hidden, `?` re-open button visible, dismissal
 *     persisted via a POST to `ROUTES.API_PAGE_EXPLAINER`.
 *   - Re-open via `?` -> peek mode (body shown without clearing
 *     dismissal; no POST).
 *   - `dismissed=true` prop -> initial state is collapsed.
 *   - `globallyHidden=true` -> default-collapsed regardless of stored state.
 *   - On a fetch failure, the optimistic UI rolls back to expanded.
 */

import { ROUTES } from '@ab/constants';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageExplainerHarness from './harnesses/PageExplainerHarness.svelte';

type FetchSpy = ReturnType<typeof vi.fn>;

function installFetch(ok: boolean): FetchSpy {
	const spy = vi.fn(async () => new Response(JSON.stringify({ ok }), { status: ok ? 200 : 500 }));
	vi.stubGlobal('fetch', spy);
	return spy;
}

beforeEach(() => {
	installFetch(true);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('PageExplainer', () => {
	it('renders body open by default with collapse control', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'Body text.' });
		expect(screen.getByTestId('page-explainer-body')).toBeInTheDocument();
		expect(screen.getByTestId('page-explainer-harness-body').textContent).toBe('Body text.');
		expect(screen.getByTestId('page-explainer-collapse')).toBeInTheDocument();
		expect(screen.queryByTestId('page-explainer-reopen')).toBeNull();
	});

	it('uses default title "Why am I here?"', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		expect(screen.getByText('Why am I here?')).toBeInTheDocument();
	});

	it('clicking collapse hides the body, shows the reopen button, and POSTs the dismissal', async () => {
		const fetchSpy = installFetch(true);
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		await fireEvent.click(screen.getByTestId('page-explainer-collapse'));
		await tick();
		expect(screen.queryByTestId('page-explainer-body')).toBeNull();
		expect(screen.getByTestId('page-explainer-reopen')).toBeInTheDocument();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0] ?? [];
		expect(url).toBe(ROUTES.API_PAGE_EXPLAINER);
		expect(init?.method).toBe('POST');
		expect(JSON.parse(init?.body as string)).toMatchObject({ pageKey: 'test-page', dismissed: true });
	});

	it('reads the initial dismissal from the `dismissed` prop', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b', dismissed: true });
		expect(screen.queryByTestId('page-explainer-body')).toBeNull();
		expect(screen.getByTestId('page-explainer-reopen')).toBeInTheDocument();
	});

	it('reopen button shows the body without re-posting (peek does not clear dismissal)', async () => {
		const fetchSpy = installFetch(true);
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b', dismissed: true });
		await fireEvent.click(screen.getByTestId('page-explainer-reopen'));
		expect(screen.getByTestId('page-explainer-body')).toBeInTheDocument();
		// Peek is local state only -- no network call.
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('globallyHidden=true defaults to collapsed', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b', globallyHidden: true });
		expect(screen.queryByTestId('page-explainer-body')).toBeNull();
		expect(screen.getByTestId('page-explainer-reopen')).toBeInTheDocument();
	});

	it('rolls back to expanded if the dismissal POST fails', async () => {
		installFetch(false);
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		await fireEvent.click(screen.getByTestId('page-explainer-collapse'));
		await tick();
		// Failure path -> optimistic state reverts.
		expect(screen.getByTestId('page-explainer-body')).toBeInTheDocument();
		expect(screen.queryByTestId('page-explainer-reopen')).toBeNull();
	});

	it('rolls back to expanded if fetch throws', async () => {
		const spy = vi.fn(async () => {
			throw new Error('network down');
		});
		vi.stubGlobal('fetch', spy);
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		await fireEvent.click(screen.getByTestId('page-explainer-collapse'));
		await tick();
		expect(screen.getByTestId('page-explainer-body')).toBeInTheDocument();
	});
});

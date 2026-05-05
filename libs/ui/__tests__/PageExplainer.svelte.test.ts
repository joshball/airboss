/**
 * PageExplainer DOM contract:
 *   - Open by default. Body + collapse button visible.
 *   - Collapse -> body hidden, `?` re-open button visible, dismissal
 *     persisted in localStorage under a per-page key.
 *   - Re-open via `?` -> peek mode (body shown without clearing dismissal).
 *   - globallyHidden=true -> default-collapsed regardless of stored state.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PageExplainerHarness from './harnesses/PageExplainerHarness.svelte';

const STORAGE_KEY = 'airboss.page-explainer.dismissed.test-page';

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

describe('PageExplainer', () => {
	it('renders body open by default with collapse control', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'Body text.' });
		expect(screen.getByTestId('page-explainer-body')).toBeTruthy();
		expect(screen.getByTestId('page-explainer-harness-body').textContent).toBe('Body text.');
		expect(screen.getByTestId('page-explainer-collapse')).toBeTruthy();
		expect(screen.queryByTestId('page-explainer-reopen')).toBeNull();
	});

	it('uses default title "Why am I here?"', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		expect(screen.getByText('Why am I here?')).toBeTruthy();
	});

	it('clicking collapse hides the body and shows the reopen button', async () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		await fireEvent.click(screen.getByTestId('page-explainer-collapse'));
		expect(screen.queryByTestId('page-explainer-body')).toBeNull();
		expect(screen.getByTestId('page-explainer-reopen')).toBeTruthy();
	});

	it('persists dismissal to localStorage', async () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		await fireEvent.click(screen.getByTestId('page-explainer-collapse'));
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
	});

	it('reads existing dismissal on mount', () => {
		window.localStorage.setItem(STORAGE_KEY, '1');
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		expect(screen.queryByTestId('page-explainer-body')).toBeNull();
		expect(screen.getByTestId('page-explainer-reopen')).toBeTruthy();
	});

	it('reopen button shows the body without deleting the dismissal', async () => {
		window.localStorage.setItem(STORAGE_KEY, '1');
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b' });
		await fireEvent.click(screen.getByTestId('page-explainer-reopen'));
		expect(screen.getByTestId('page-explainer-body')).toBeTruthy();
		// Dismissal still set: this is a "peek", not a clear.
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
	});

	it('globallyHidden=true defaults to collapsed', () => {
		render(PageExplainerHarness, { pageKey: 'test-page', body: 'b', globallyHidden: true });
		expect(screen.queryByTestId('page-explainer-body')).toBeNull();
		expect(screen.getByTestId('page-explainer-reopen')).toBeTruthy();
	});

	it('per-page key isolates dismissals across pages', () => {
		window.localStorage.setItem('airboss.page-explainer.dismissed.page-a', '1');
		render(PageExplainerHarness, { pageKey: 'page-b', body: 'b' });
		// page-b is NOT dismissed even though page-a is.
		expect(screen.getByTestId('page-explainer-body')).toBeTruthy();
	});
});

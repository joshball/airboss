/**
 * Banner DOM contract -- role-by-tone, optional title, dismiss button.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BannerHarness from './harnesses/BannerHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Banner -- rendering', () => {
	it('renders root with body content', () => {
		render(BannerHarness, { body: 'Saved' });
		expect(screen.getByTestId('banner-root')).toBeTruthy();
		expect(screen.getByTestId('harness-banner-body').textContent).toBe('Saved');
	});

	it('renders title when provided', () => {
		render(BannerHarness, { title: 'Heads up', body: 'b' });
		expect(screen.getByTestId('banner-title').textContent).toBe('Heads up');
	});

	it('omits title when not provided', () => {
		render(BannerHarness, { body: 'b' });
		expect(screen.queryByTestId('banner-title')).toBeNull();
	});
});

describe('Banner -- role mapping', () => {
	it('non-danger tones use role=status', () => {
		render(BannerHarness, { tone: 'info', body: 'i' });
		expect(screen.getByTestId('banner-root').getAttribute('role')).toBe('status');
	});

	it('danger tone uses role=alert', () => {
		render(BannerHarness, { tone: 'danger', body: 'fail' });
		expect(screen.getByTestId('banner-root').getAttribute('role')).toBe('alert');
	});

	it('reflects tone via data-tone', () => {
		render(BannerHarness, { tone: 'warning', body: 'w' });
		expect(screen.getByTestId('banner-root').getAttribute('data-tone')).toBe('warning');
	});
});

describe('Banner -- dismiss', () => {
	it('does not render dismiss button by default', () => {
		render(BannerHarness, { body: 'b' });
		expect(screen.queryByTestId('banner-dismiss')).toBeNull();
	});

	it('renders dismiss button when dismissible=true and onDismiss is set', () => {
		render(BannerHarness, { body: 'b', dismissible: true, onDismiss: vi.fn() });
		expect(screen.getByTestId('banner-dismiss')).toBeTruthy();
	});

	it('clicking dismiss calls onDismiss exactly once', async () => {
		const onDismiss = vi.fn();
		const user = userEvent.setup();
		render(BannerHarness, { body: 'b', dismissible: true, onDismiss });
		await user.click(screen.getByTestId('banner-dismiss'));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});

/**
 * SharePopover DOM contract -- dialog gating, copy + report actions,
 * URL preview rendering.
 *
 * Uses direct `.click()` rather than userEvent because happy-dom's pointer
 * event ordering for buttons inside a scrim'd dialog doesn't reliably reach
 * the button onclick under userEvent. Click semantics are still proven --
 * they just go through the native click path instead of pointerdown ->
 * pointerup -> click.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharePopover from '../src/components/SharePopover.svelte';

afterEach(() => {
	cleanup();
});

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
	writeText = vi.fn(() => Promise.resolve());
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText },
	});
});

describe('SharePopover -- closed', () => {
	it('renders nothing when open=false', () => {
		const { container } = render(SharePopover, {
			open: false,
			cardId: 'c1',
			cardPublicUrl: 'https://airboss.test/c/1',
			onReport: vi.fn(),
		});
		expect(container.querySelector('[data-testid="sharepopover-root"]')).toBeNull();
	});
});

describe('SharePopover -- open', () => {
	it('renders dialog with the URL preview', () => {
		render(SharePopover, {
			open: true,
			cardId: 'c1',
			cardPublicUrl: 'https://airboss.test/c/1',
			onReport: vi.fn(),
		});
		const root = screen.getByTestId('sharepopover-root');
		expect(root.getAttribute('role')).toBe('dialog');
		expect(screen.getByTestId('sharepopover-url').textContent).toBe('https://airboss.test/c/1');
	});

	it('clicking Copy fires onCopy with the URL after the clipboard write succeeds', async () => {
		const onCopy = vi.fn<(url: string) => void>();
		render(SharePopover, {
			open: true,
			cardId: 'c1',
			cardPublicUrl: 'https://airboss.test/c/1',
			onReport: vi.fn(),
			onCopy,
		});
		(screen.getByTestId('sharepopover-copy') as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(writeText).toHaveBeenCalledWith('https://airboss.test/c/1');
		expect(onCopy).toHaveBeenCalledWith('https://airboss.test/c/1');
	});

	it('clicking Report calls onReport with the cardId', () => {
		const onReport = vi.fn<(id: string) => void>();
		render(SharePopover, {
			open: true,
			cardId: 'card-99',
			cardPublicUrl: 'https://airboss.test/c/99',
			onReport,
		});
		(screen.getByTestId('sharepopover-report') as HTMLButtonElement).click();
		expect(onReport).toHaveBeenCalledWith('card-99');
	});

	it('shows an error message when the clipboard write rejects', async () => {
		writeText.mockRejectedValueOnce(new Error('denied'));
		render(SharePopover, {
			open: true,
			cardId: 'c1',
			cardPublicUrl: 'https://airboss.test/c/1',
			onReport: vi.fn(),
		});
		(screen.getByTestId('sharepopover-copy') as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.getByTestId('sharepopover-error')).toBeTruthy();
	});

	it('clicking close calls onClose', () => {
		const onClose = vi.fn();
		render(SharePopover, {
			open: true,
			cardId: 'c1',
			cardPublicUrl: 'https://airboss.test/c/1',
			onReport: vi.fn(),
			onClose,
		});
		(screen.getByTestId('sharepopover-close') as HTMLButtonElement).click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

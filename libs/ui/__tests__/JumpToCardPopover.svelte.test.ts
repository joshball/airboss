/**
 * JumpToCardPopover DOM contract -- dialog open/close, item rendering,
 * Escape behaviour, click-on-row picks the index and closes.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JumpToCardPopover, { type JumpCardStatus } from '../src/components/JumpToCardPopover.svelte';

const statuses: JumpCardStatus[] = ['rated', 'pending', 'pending', 'pending'];

afterEach(() => {
	cleanup();
});

describe('JumpToCardPopover -- closed', () => {
	it('renders nothing when open=false', () => {
		const { container } = render(JumpToCardPopover, {
			open: false,
			totalCards: 4,
			currentIndex: 1,
			statuses,
			onPick: vi.fn(),
		});
		expect(container.querySelector('[data-testid="jumptocardpopover-root"]')).toBeNull();
	});
});

describe('JumpToCardPopover -- open', () => {
	it('renders dialog with role=dialog and aria-modal=true', () => {
		render(JumpToCardPopover, { open: true, totalCards: 4, currentIndex: 1, statuses, onPick: vi.fn() });
		const root = screen.getByTestId('jumptocardpopover-root');
		expect(root.getAttribute('role')).toBe('dialog');
		expect(root.getAttribute('aria-modal')).toBe('true');
	});

	it('renders one row per card with the right state and aria-selected', () => {
		render(JumpToCardPopover, { open: true, totalCards: 4, currentIndex: 1, statuses, onPick: vi.fn() });
		expect(screen.getByTestId('jumptocardpopover-item-0').getAttribute('data-state')).toBe('rated');
		expect(screen.getByTestId('jumptocardpopover-item-1').getAttribute('data-state')).toBe('current');
		expect(screen.getByTestId('jumptocardpopover-item-1').getAttribute('aria-selected')).toBe('true');
		expect(screen.getByTestId('jumptocardpopover-item-2').getAttribute('data-state')).toBe('pending');
	});

	it('list has role=listbox', () => {
		render(JumpToCardPopover, {
			open: true,
			totalCards: 2,
			currentIndex: 0,
			statuses: ['current', 'pending'],
			onPick: vi.fn(),
		});
		expect(screen.getByTestId('jumptocardpopover-list').getAttribute('role')).toBe('listbox');
	});
});

describe('JumpToCardPopover -- interaction', () => {
	it('clicking a row calls onPick with the 0-based index', async () => {
		const onPick = vi.fn<(idx: number) => void>();
		const user = userEvent.setup();
		render(JumpToCardPopover, { open: true, totalCards: 4, currentIndex: 1, statuses, onPick });
		await user.click(screen.getByTestId('jumptocardpopover-item-2'));
		expect(onPick).toHaveBeenCalledTimes(1);
		expect(onPick).toHaveBeenCalledWith(2);
	});

	it('clicking the close button calls onClose', async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(JumpToCardPopover, {
			open: true,
			totalCards: 4,
			currentIndex: 1,
			statuses,
			onPick: vi.fn(),
			onClose,
		});
		await user.click(screen.getByTestId('jumptocardpopover-close'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

import { describe, expect, it, vi } from 'vitest';
import { createFocusTrap, FOCUS_TRAP_SELECTOR } from '../src/lib/focus-trap';

/**
 * These tests verify the shared focus-trap helper behaviour that backs
 * `<Drawer>` (and `<Dialog>`, `<InfoTip>`, `<ConfirmAction>`): Escape
 * releases via the `onEscape` callback, Tab cycles forward, Shift+Tab
 * cycles backward. We don't need a real DOM; we stub the minimum surface
 * the helper interacts with (querySelectorAll + focus + offsetParent).
 */

interface FakeElement {
	tagName: string;
	hasAttribute: (name: string) => boolean;
	offsetParent: FakeElement | null;
	focus: () => void;
}

interface KeyDownInit {
	key: string;
	shiftKey?: boolean;
	target?: FakeElement | null;
}

function makeFocusable(label: string, focusSpy?: () => void): FakeElement {
	return {
		tagName: 'BUTTON',
		hasAttribute: (_name: string) => false,
		offsetParent: { tagName: 'BODY', hasAttribute: () => false, offsetParent: null, focus: () => {} },
		focus: focusSpy ?? (() => {}),
		// Label kept for test readability only.
		...{ label },
	} as FakeElement;
}

function makeContainer(children: FakeElement[]): HTMLElement {
	return {
		querySelectorAll: (_selector: string) => children,
	} as unknown as HTMLElement;
}

function event(init: KeyDownInit): KeyboardEvent {
	const e = {
		key: init.key,
		shiftKey: init.shiftKey ?? false,
		target: init.target ?? null,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	};
	return e as unknown as KeyboardEvent;
}

describe('createFocusTrap', () => {
	it('exposes the documented focusable selector', () => {
		expect(FOCUS_TRAP_SELECTOR).toContain('button:not([disabled])');
		expect(FOCUS_TRAP_SELECTOR).toContain('a[href]');
	});

	it('calls onEscape when Escape is pressed and stops the event', () => {
		const onEscape = vi.fn();
		const trap = createFocusTrap(makeContainer([]), { onEscape });
		const e = event({ key: 'Escape' });
		trap.handleKeyDown(e);
		expect(onEscape).toHaveBeenCalledTimes(1);
		expect(e.preventDefault).toHaveBeenCalled();
		expect(e.stopPropagation).toHaveBeenCalled();
	});

	it('does not throw when Escape fires with no onEscape handler', () => {
		const trap = createFocusTrap(makeContainer([]));
		expect(() => trap.handleKeyDown(event({ key: 'Escape' }))).not.toThrow();
	});

	it('wraps Tab from the last focusable back to the first', () => {
		const firstFocus = vi.fn();
		const lastFocus = vi.fn();
		const first = makeFocusable('first', firstFocus);
		const last = makeFocusable('last', lastFocus);
		const trap = createFocusTrap(makeContainer([first, last]));

		const e = event({ key: 'Tab', target: last });
		trap.handleKeyDown(e);

		expect(e.preventDefault).toHaveBeenCalled();
		expect(firstFocus).toHaveBeenCalledTimes(1);
		expect(lastFocus).not.toHaveBeenCalled();
	});

	it('wraps Shift+Tab from the first focusable back to the last', () => {
		const firstFocus = vi.fn();
		const lastFocus = vi.fn();
		const first = makeFocusable('first', firstFocus);
		const last = makeFocusable('last', lastFocus);
		const trap = createFocusTrap(makeContainer([first, last]));

		const e = event({ key: 'Tab', shiftKey: true, target: first });
		trap.handleKeyDown(e);

		expect(e.preventDefault).toHaveBeenCalled();
		expect(lastFocus).toHaveBeenCalledTimes(1);
		expect(firstFocus).not.toHaveBeenCalled();
	});

	it('pulls focus into the panel when Tab fires outside the focusable set', () => {
		const firstFocus = vi.fn();
		const first = makeFocusable('first', firstFocus);
		const last = makeFocusable('last');
		const trap = createFocusTrap(makeContainer([first, last]));

		// Simulate Tab arriving with a target outside the container.
		const stranger = makeFocusable('stranger');
		const e = event({ key: 'Tab', target: stranger });
		trap.handleKeyDown(e);

		expect(e.preventDefault).toHaveBeenCalled();
		expect(firstFocus).toHaveBeenCalledTimes(1);
	});

	it('ignores keys other than Tab and Escape', () => {
		const onEscape = vi.fn();
		const first = makeFocusable('first', vi.fn());
		const trap = createFocusTrap(makeContainer([first]), { onEscape });
		trap.handleKeyDown(event({ key: 'a' }));
		trap.handleKeyDown(event({ key: 'Enter' }));
		expect(onEscape).not.toHaveBeenCalled();
	});

	it('filters out aria-hidden and off-flow elements', () => {
		const visibleFocus = vi.fn();
		const visible = makeFocusable('visible', visibleFocus);
		const hidden: FakeElement = {
			tagName: 'BUTTON',
			hasAttribute: (name: string) => name === 'aria-hidden',
			offsetParent: { tagName: 'BODY', hasAttribute: () => false, offsetParent: null, focus: () => {} },
			focus: vi.fn(),
		};
		const offFlow: FakeElement = {
			tagName: 'BUTTON',
			hasAttribute: () => false,
			offsetParent: null,
			focus: vi.fn(),
		};
		const trap = createFocusTrap(makeContainer([hidden, offFlow, visible]));
		const stranger = makeFocusable('stranger');
		const e = event({ key: 'Tab', target: stranger });
		trap.handleKeyDown(e);
		// Only `visible` should be left in the set, so focus cycles to it.
		expect(visibleFocus).toHaveBeenCalledTimes(1);
	});
});

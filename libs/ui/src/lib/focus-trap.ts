/**
 * Focus-trap helper shared by `ConfirmAction`, `InfoTip`, and any other
 * disclosure surface that needs Tab/Shift+Tab to cycle within a container
 * plus Escape to release.
 *
 * Pure function: takes a container element and returns a keydown handler
 * plus a `release` callback. The handler handles Escape (calls `onEscape`)
 * and Tab (cycles focus across every visible focusable element in the
 * container, in DOM order). `release` is a no-op placeholder today so
 * callers can centralise teardown; extend when the trap grows document-
 * level listeners.
 *
 * Focusable set is queried dynamically on every Tab so elements that
 * render in or out of the panel after open are picked up automatically.
 * Hidden (`aria-hidden`) and off-flow (`offsetParent === null`) elements
 * are filtered out -- this matches the pattern proven in `ConfirmAction`.
 */

/**
 * CSS selector for all focusable descendants. Same shape used by the
 * WAI-ARIA authoring-practices reference implementations.
 */
export const FOCUS_TRAP_SELECTOR =
	'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface FocusTrap {
	/**
	 * Keydown handler. Wire to the panel element (or document) while the
	 * trap is active. Handles Tab, Shift+Tab, and Escape.
	 */
	handleKeyDown: (event: KeyboardEvent) => void;
	/**
	 * Detach any side effects. No-op today; placeholder for future
	 * extensions (e.g., the trap adding a capture-phase document listener).
	 */
	release: () => void;
}

export interface FocusTrapOptions {
	/** Called when the user presses Escape inside the trapped container. */
	onEscape?: () => void;
}

/**
 * Build a focus-trap attached to `container`. The handler cycles Tab
 * focus across every visible focusable element in DOM order and calls
 * `onEscape` on Escape. Returns `release` for symmetry with hooks that
 * attach listeners; the current implementation has nothing to release.
 */
export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): FocusTrap {
	function getFocusables(): HTMLElement[] {
		return Array.from(container.querySelectorAll<HTMLElement>(FOCUS_TRAP_SELECTOR)).filter(
			(el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
		);
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			options.onEscape?.();
			return;
		}
		if (event.key !== 'Tab') return;
		const focusables = getFocusables();
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const target = event.target as HTMLElement | null;
		if (event.shiftKey) {
			if (target === first || !target || !focusables.includes(target)) {
				event.preventDefault();
				last.focus();
			}
		} else {
			if (target === last || !target || !focusables.includes(target)) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	function release(): void {
		// Reserved for future teardown. Kept on the interface so callers
		// have a symmetric lifecycle even when there's nothing to tear down.
	}

	return { handleKeyDown, release };
}

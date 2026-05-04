/**
 * Roving-focus + tab-index helpers for the WAI-ARIA radio-group pattern.
 *
 * Pre-2026-05-04 the memory-review surface rendered both the confidence
 * chicklets and the card-feedback pills as `role="radio"` buttons inside a
 * `role="radiogroup"` but did not honour the radio-group keyboard contract:
 * every button was its own tab stop and arrow keys did nothing. SR users
 * navigating with the radio-group convention couldn't reach siblings.
 *
 * These helpers implement the standard pattern:
 *
 *   - exactly one radio holds `tabindex="0"` (the checked one, or the first
 *     when nothing is selected); the rest are `tabindex="-1"`
 *   - ArrowUp / ArrowLeft moves focus to the previous radio
 *   - ArrowDown / ArrowRight moves focus to the next radio
 *   - Home / End jump to the first / last
 *   - selection follows focus (the standard radio-group convention)
 *
 * Pure DOM walks, no animations -- safe under
 * `prefers-reduced-motion: reduce` without extra wiring.
 */

/**
 * Returns `0` when the radio is the single tab stop, `-1` when it sits
 * outside the tab cycle. WAI-ARIA: the tab stop is the checked radio when
 * there is one, else the first radio so keyboard users can enter the
 * group.
 */
export function rovingTabIndex<T>(values: readonly T[], value: T | null, item: T): 0 | -1 {
	if (value !== null) return value === item ? 0 : -1;
	return item === values[0] ? 0 : -1;
}

/**
 * Handle a `keydown` on a radio inside a radio-group. Calls `select` with
 * the next radio's `data-radio-value` (so application state updates first)
 * then focuses it. No-ops on keys other than ArrowUp/ArrowDown/ArrowLeft/
 * ArrowRight/Home/End.
 *
 * Caller is responsible for tagging each radio with `data-radio-value` and
 * for ensuring the parent has `role="radiogroup"`.
 */
export function moveRovingFocus(event: KeyboardEvent, select: (value: string) => void): void {
	const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
	if (!target) return;
	const group = target.closest<HTMLElement>('[role="radiogroup"]');
	if (!group) return;
	const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')).filter(
		(el) => !(el instanceof HTMLButtonElement && el.disabled) && el.getAttribute('aria-disabled') !== 'true',
	);
	if (radios.length === 0) return;
	const currentIndex = radios.indexOf(target);
	if (currentIndex === -1) return;
	let nextIndex: number | null = null;
	switch (event.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			nextIndex = (currentIndex + 1) % radios.length;
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
			nextIndex = (currentIndex - 1 + radios.length) % radios.length;
			break;
		case 'Home':
			nextIndex = 0;
			break;
		case 'End':
			nextIndex = radios.length - 1;
			break;
		default:
			return;
	}
	event.preventDefault();
	const next = radios[nextIndex];
	if (!next) return;
	const value = next.dataset.radioValue;
	if (typeof value === 'string') select(value);
	next.focus();
}

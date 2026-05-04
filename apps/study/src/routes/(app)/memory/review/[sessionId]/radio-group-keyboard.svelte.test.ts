/**
 * DOM tests for `moveRovingFocus` -- exercises the WAI-ARIA radio-group
 * keyboard contract against a real (happy-dom) DOM. Pinned behaviors:
 *
 *   - Tab enters the group on a single tab stop (the active radio).
 *   - ArrowRight / ArrowDown moves focus to the next radio with wrap.
 *   - ArrowLeft / ArrowUp moves focus to the previous radio with wrap.
 *   - Home / End jump to the first / last radio.
 *   - Selection follows focus (the `select` callback is called with the
 *     target's `data-radio-value`).
 *   - Disabled radios are skipped.
 *
 * Closes the chunk-1 a11y CRITICAL "memory-review feedback + confidence
 * radio groups don't support arrow-key nav" from
 * docs/work/reviews/2026-05-01-study-app-surfaces-a11y.md.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveRovingFocus } from './radio-group-keyboard';

interface BuiltGroup {
	group: HTMLElement;
	radios: HTMLButtonElement[];
}

function buildGroup(values: readonly string[], options: { disabled?: ReadonlySet<string> } = {}): BuiltGroup {
	const group = document.createElement('div');
	group.setAttribute('role', 'radiogroup');
	const radios: HTMLButtonElement[] = [];
	for (const value of values) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('role', 'radio');
		btn.dataset.radioValue = value;
		if (options.disabled?.has(value)) btn.disabled = true;
		btn.textContent = value;
		group.appendChild(btn);
		radios.push(btn);
	}
	document.body.appendChild(group);
	return { group, radios };
}

afterEach(() => {
	document.body.innerHTML = '';
});

function dispatchKey(target: HTMLElement, key: string): KeyboardEvent {
	// happy-dom doesn't wire `currentTarget` automatically for synthetic
	// dispatches the way browsers do for handlers. Construct the event,
	// invoke the handler directly with `currentTarget` overridden.
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	Object.defineProperty(event, 'currentTarget', { value: target, configurable: true });
	return event;
}

describe('moveRovingFocus -- ArrowRight / ArrowDown', () => {
	it('moves focus to the next radio and selects it', () => {
		const { radios } = buildGroup(['a', 'b', 'c']);
		const first = radios[0];
		const second = radios[1];
		if (!first || !second) throw new Error('test setup: missing radios');
		first.focus();
		const select = vi.fn();

		const event = dispatchKey(first, 'ArrowRight');
		moveRovingFocus(event, select);

		expect(select).toHaveBeenCalledWith('b');
		expect(document.activeElement).toBe(second);
		expect(event.defaultPrevented).toBe(true);
	});

	it('wraps from the last radio back to the first', () => {
		const { radios } = buildGroup(['a', 'b', 'c']);
		const first = radios[0];
		const last = radios[2];
		if (!first || !last) throw new Error('test setup: missing radios');
		last.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(last, 'ArrowDown'), select);

		expect(select).toHaveBeenCalledWith('a');
		expect(document.activeElement).toBe(first);
	});
});

describe('moveRovingFocus -- ArrowLeft / ArrowUp', () => {
	it('moves focus to the previous radio and selects it', () => {
		const { radios } = buildGroup(['a', 'b', 'c']);
		const first = radios[0];
		const second = radios[1];
		if (!first || !second) throw new Error('test setup: missing radios');
		second.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(second, 'ArrowLeft'), select);

		expect(select).toHaveBeenCalledWith('a');
		expect(document.activeElement).toBe(first);
	});

	it('wraps from the first radio back to the last', () => {
		const { radios } = buildGroup(['a', 'b', 'c']);
		const first = radios[0];
		const last = radios[2];
		if (!first || !last) throw new Error('test setup: missing radios');
		first.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(first, 'ArrowUp'), select);

		expect(select).toHaveBeenCalledWith('c');
		expect(document.activeElement).toBe(last);
	});
});

describe('moveRovingFocus -- Home / End', () => {
	it('Home jumps to the first radio', () => {
		const { radios } = buildGroup(['a', 'b', 'c']);
		const first = radios[0];
		const last = radios[2];
		if (!first || !last) throw new Error('test setup: missing radios');
		last.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(last, 'Home'), select);

		expect(select).toHaveBeenCalledWith('a');
		expect(document.activeElement).toBe(first);
	});

	it('End jumps to the last radio', () => {
		const { radios } = buildGroup(['a', 'b', 'c']);
		const first = radios[0];
		const last = radios[2];
		if (!first || !last) throw new Error('test setup: missing radios');
		first.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(first, 'End'), select);

		expect(select).toHaveBeenCalledWith('c');
		expect(document.activeElement).toBe(last);
	});
});

describe('moveRovingFocus -- disabled radios skipped', () => {
	it('skips a disabled radio when stepping forward', () => {
		const { radios } = buildGroup(['a', 'b', 'c'], { disabled: new Set(['b']) });
		const first = radios[0];
		const last = radios[2];
		if (!first || !last) throw new Error('test setup: missing radios');
		first.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(first, 'ArrowRight'), select);

		expect(select).toHaveBeenCalledWith('c');
		expect(document.activeElement).toBe(last);
	});
});

describe('moveRovingFocus -- non-arrow keys do nothing', () => {
	it('ignores Enter / Space / printable keys (caller handles activation)', () => {
		const { radios } = buildGroup(['a', 'b']);
		const first = radios[0];
		if (!first) throw new Error('test setup: missing radios');
		first.focus();
		const select = vi.fn();

		const event = dispatchKey(first, 'Enter');
		moveRovingFocus(event, select);

		expect(select).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(first);
	});
});

describe('moveRovingFocus -- defensive guards', () => {
	it('no-ops when the event target is outside any radiogroup', () => {
		const orphan = document.createElement('button');
		orphan.setAttribute('role', 'radio');
		orphan.dataset.radioValue = 'lone';
		document.body.appendChild(orphan);
		orphan.focus();
		const select = vi.fn();

		moveRovingFocus(dispatchKey(orphan, 'ArrowRight'), select);

		expect(select).not.toHaveBeenCalled();
	});
});

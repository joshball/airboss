/**
 * View Transitions wrapper -- runs `fn` inside `document.startViewTransition`
 * when the browser supports the API, otherwise just calls `fn` directly.
 *
 * Designed for in-doc reader navigation: the host wraps `goto(url)` in
 * `withViewTransition` so the body cross-fades while the persistent rail
 * stays anchored. Chrome / Edge / Safari TP cross-fade; Firefox falls
 * back to a plain navigation with no animation.
 *
 * The function intentionally does NOT block on `transition.finished` --
 * SvelteKit's router is async and we want the navigation to start
 * immediately. Callers awaiting the returned promise wait on whichever
 * comes first (the navigation or the transition). The browser handles
 * the visual swap during the transition; the navigation may resolve
 * earlier or later without breaking the animation.
 */

interface ViewTransitionDocument {
	startViewTransition?(callback: () => void | Promise<void>): {
		updateCallbackDone: Promise<void>;
		finished: Promise<void>;
		ready: Promise<void>;
	};
}

export function withViewTransition<T>(fn: () => T | Promise<T>): T | Promise<T> {
	if (typeof document === 'undefined') return fn();
	const docWithVT = document as unknown as ViewTransitionDocument;
	if (typeof docWithVT.startViewTransition !== 'function') return fn();

	// Capture the result so the caller's promise resolves with the
	// callback's return value, not undefined. The view transition wraps
	// the visual swap; the underlying side-effect (e.g. `goto`) runs
	// inside the callback. We seed `result` with a sentinel that the
	// synchronous callback overwrites; the type cast is the narrowest
	// way to express "set inside the same tick by the callback above".
	let result: T | Promise<T> | typeof UNSET = UNSET;
	docWithVT.startViewTransition(() => {
		result = fn();
		// Tell the API to wait until the route has actually finished
		// rendering before swapping the snapshot. If the route is sync
		// (or sync-fast), the transition swaps immediately.
		return Promise.resolve(result).then(() => undefined);
	});
	if (result === UNSET) {
		// Should be unreachable -- startViewTransition invokes its callback
		// synchronously per the API spec. Fall back to a plain call so we
		// don't strand the caller on a stuck promise.
		return fn();
	}
	return result;
}

const UNSET: unique symbol = Symbol('view-transition.unset');

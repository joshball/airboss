/**
 * Pure URL helpers for `<PageHelp>` drawer state persistence.
 *
 * The drawer survives reload / deep-link via a `?help=<id>` query param.
 * Component-side code mutates the URL through `$app/navigation`'s
 * `replaceState`; these helpers handle the pure URL math so they can be
 * unit-tested without a DOM.
 */

import { QUERY_PARAMS } from '@ab/constants';

/**
 * Read the drawer target id from the given URL.
 *
 * Returns `null` when the param is absent, empty, or the URL has no
 * search string. Never throws -- callers pass `page.url` which is already
 * a `URL` instance, but plain strings work too.
 */
export function readHelpParam(url: URL): string | null {
	const raw = url.searchParams.get(QUERY_PARAMS.HELP);
	return raw === null || raw === '' ? null : raw;
}

/**
 * Produce a new `URL` with `?help=<id>` set or removed. Leaves every
 * other search param untouched so the drawer persists alongside existing
 * page filters (tab, step, etc.).
 *
 * When `id` is `null`, the param is deleted and a search string of only
 * that param is cleared entirely so clean links don't grow a `?` tail.
 */
export function withHelpParam(url: URL, id: string | null): URL {
	const next = new URL(url);
	if (id === null) {
		next.searchParams.delete(QUERY_PARAMS.HELP);
	} else {
		next.searchParams.set(QUERY_PARAMS.HELP, id);
	}
	return next;
}

/**
 * True when the URL's `?help=<id>` matches the given page id. Used by
 * `<PageHelp>` to decide whether to auto-open on mount.
 */
export function isHelpTargetMatch(url: URL, pageId: string): boolean {
	return readHelpParam(url) === pageId;
}

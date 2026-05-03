/**
 * Dev-only route group gate.
 *
 * The `(dev)` group hosts demo / fixture surfaces (`/references`, `/primitives`)
 * that prime the in-memory `__sources_internal__` registry with synthetic
 * data. Allowing those routes to render in production would let an
 * unauthenticated visitor pollute the live source-resolution table with
 * fixture entries for the lifetime of the server process.
 *
 * Closes 2026-05-01 study-app-surfaces security review (MAJOR): "(dev) route
 * group exposed in production with no auth and module-global side effects".
 */

import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	if (!dev) {
		error(404, 'Not found');
	}
};

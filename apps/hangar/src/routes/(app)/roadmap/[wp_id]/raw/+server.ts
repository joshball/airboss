/**
 * `/roadmap/[wp_id]/raw` -- JSON dump of one WP's loaded shape (raw
 * frontmatter, parsed frontmatter, validation errors, absolute spec path).
 * Useful when debugging a frontmatter-lint failure or comparing the loader's
 * view against `bun run wp show <id> --json`.
 *
 * Auth-gated to AUTHOR | OPERATOR | ADMIN like the rest of `(app)`.
 */

import { requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { loadAllWorkPackages } from '@ab/wp-loader';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const wpId = event.params.wp_id;
	if (!wpId || !/^[a-z0-9][a-z0-9-]*$/.test(wpId)) {
		throw error(404, 'Work package not found');
	}
	const wp = loadAllWorkPackages().find((p) => p.id === wpId);
	if (wp === undefined) {
		throw error(404, `Work package "${wpId}" not found`);
	}
	return json(wp);
};

import { ROUTES } from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Hangar root redirects to the glossary surface. Matches the finish-plan
 * shape: /glossary is the primary admin landing. The audit-ping demo
 * from the scaffold WP moved to /admin/audit-ping.
 */
export const load: PageServerLoad = async () => {
	redirect(302, ROUTES.HANGAR_GLOSSARY);
};

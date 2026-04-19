import { requireAuth } from '@ab/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireAuth(event);
	return { user };
};

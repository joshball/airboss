/**
 * Hangar-app help pages -- INDEX SIDE.
 *
 * Mirrors `apps/study/src/lib/help/pages-index.ts`. Browser layouts pull
 * in only metadata + precomputed search haystacks; bodies load via
 * dynamic `import()` keyed by id when `/help/[id]` or the PageHelp drawer
 * opens.
 */

import type { HelpBodyLoader, HelpPageBody, HelpPageIndex } from '@ab/help';
import { auditIndex } from './content/audit';
import { usersIndex } from './content/users';

export const hangarHelpIndex: readonly HelpPageIndex[] = [auditIndex, usersIndex];

export const loadHangarHelpBody: HelpBodyLoader = async (id: string): Promise<HelpPageBody | undefined> => {
	switch (id) {
		case 'audit':
			return (await import('./content/bodies/audit')).auditBody;
		case 'users-detail':
			return (await import('./content/bodies/users')).usersBody;
		default:
			return undefined;
	}
};

/**
 * Hangar-app help pages -- FULL list (index + body merged).
 *
 * Reserved for build-time consumers (the references validator under Bun)
 * that need the complete `HelpPage[]` shape. Browser code goes through
 * `pages-index.ts` + `loadHangarHelpBody` instead.
 */

import type { HelpPage, HelpPageBody, HelpPageIndex } from '@ab/help';
import { auditIndex } from './content/audit';
import { auditBody } from './content/bodies/audit';
import { usersBody } from './content/bodies/users';
import { usersIndex } from './content/users';

function merge(index: HelpPageIndex, body: HelpPageBody): HelpPage {
	return {
		id: index.id,
		title: index.title,
		summary: index.summary,
		tags: index.tags,
		sections: body.sections,
		documents: index.documents,
		related: index.related,
		author: index.author,
		reviewedAt: index.reviewedAt,
		concept: index.concept,
		externalRefs: body.externalRefs ?? index.externalRefs,
	};
}

export const hangarHelpPages: readonly HelpPage[] = [merge(auditIndex, auditBody), merge(usersIndex, usersBody)];

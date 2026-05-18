/**
 * `/personal-minimums/history` -- read-only chronological view of every
 * personal-minimums revision (personal-minimums-as-typed-contract WP).
 *
 * No edit / delete controls -- editing happens by creating a new revision
 * on the main page. Each revision's notes are rendered to sanitized HTML
 * server-side via the shared markdown pipeline.
 */

import { requireAuth } from '@ab/auth';
import { getPersonalMinimumsHistory, type PersonalMinimums } from '@ab/bc-study/server';
import { renderMarkdown } from '@ab/utils';
import type { PageServerLoad } from './$types';

export interface PersonalMinimumsHistoryRow {
	record: PersonalMinimums;
	/** Notes rendered to sanitized HTML, or null when the revision has none. */
	notesHtml: string | null;
}

export interface PersonalMinimumsHistoryPageData {
	rows: PersonalMinimumsHistoryRow[];
}

export const load: PageServerLoad = async (event): Promise<PersonalMinimumsHistoryPageData> => {
	const user = requireAuth(event);
	const history = await getPersonalMinimumsHistory(user.id);
	return {
		rows: history.map((record) => ({
			record,
			notesHtml: record.notes ? renderMarkdown(record.notes) : null,
		})),
	};
};

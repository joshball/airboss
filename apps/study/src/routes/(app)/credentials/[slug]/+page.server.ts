import { requireAuth } from '@ab/auth';
import {
	type AreaMasteryRollup,
	type CredentialMasteryRollup,
	CredentialNotFoundError,
	type CredentialPrereqRow,
	type CredentialRow,
	type CredentialSyllabusRow,
	getCredentialBySlug,
	getCredentialMastery,
	getCredentialPrereqs,
	getCredentialPrimarySyllabus,
	getCredentialSyllabi,
	getCredentialsByIds,
	getSyllabusBySlug,
	type SyllabusRow,
} from '@ab/bc-study';
import { QUERY_PARAMS } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface PrereqDisplay {
	credential: CredentialRow;
	kind: string;
}

export interface SupplementalSyllabus {
	link: CredentialSyllabusRow;
	syllabus: SyllabusRow;
}

export interface CredentialDetailData {
	credential: CredentialRow;
	primarySyllabus: SyllabusRow | null;
	pinnedSyllabus: SyllabusRow | null;
	mastery: CredentialMasteryRollup;
	areas: AreaMasteryRollup[];
	prereqs: PrereqDisplay[];
	supplemental: SupplementalSyllabus[];
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const slug = event.params.slug;

	let credential: CredentialRow;
	try {
		credential = await getCredentialBySlug(slug);
	} catch (err) {
		if (err instanceof CredentialNotFoundError) {
			throw error(404, `Credential '${slug}' not found.`);
		}
		throw err;
	}

	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION);
	let pinnedSyllabus: SyllabusRow | null = null;
	if (editionParam !== null && editionParam !== '') {
		try {
			pinnedSyllabus = await getSyllabusBySlug(editionParam);
		} catch {
			// Invalid edition slug -> drop the pin and fall through to active.
			pinnedSyllabus = null;
		}
	}

	const [primarySyllabus, mastery, prereqRows, supplementalRaw] = await Promise.all([
		getCredentialPrimarySyllabus(credential.id),
		getCredentialMastery(user.id, credential.id),
		getCredentialPrereqs(credential.id),
		getCredentialSyllabi(credential.id, { primacy: 'supplemental' }),
	]);

	// Batched prereq title resolution: one BC call instead of one
	// `getCredentialById` per prereq row. See `getCredentialsByIds` in
	// `@ab/bc-study/credentials.ts`. Closes the chunk-1 perf MAJOR /
	// backend MAJOR N+1 (review-tail-2026-05).
	const prereqCredentials = await getCredentialsByIds(prereqRows.map((r: CredentialPrereqRow) => r.prereqId));
	const prereqs: PrereqDisplay[] = prereqRows.flatMap((row: CredentialPrereqRow) => {
		const cred = prereqCredentials.get(row.prereqId);
		if (cred === undefined) return [];
		return [{ credential: cred, kind: row.kind }];
	});
	prereqs.sort((a, b) => a.credential.title.localeCompare(b.credential.title));

	return {
		credential,
		primarySyllabus,
		pinnedSyllabus,
		mastery,
		areas: mastery.areas,
		prereqs,
		supplemental: supplementalRaw,
	} satisfies CredentialDetailData;
};

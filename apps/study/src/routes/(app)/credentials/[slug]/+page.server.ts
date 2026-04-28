import { requireAuth } from '@ab/auth';
import {
	type AreaMasteryRollup,
	type CredentialMasteryRollup,
	CredentialNotFoundError,
	type CredentialPrereqRow,
	type CredentialRow,
	type CredentialSyllabusRow,
	getCredentialById,
	getCredentialBySlug,
	getCredentialMastery,
	getCredentialPrereqs,
	getCredentialPrimarySyllabus,
	getCredentialSyllabi,
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

	const prereqs: PrereqDisplay[] = await Promise.all(
		prereqRows.map(async (row: CredentialPrereqRow) => ({
			credential: await getCredentialById(row.prereqId),
			kind: row.kind,
		})),
	);
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

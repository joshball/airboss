import { requireAuth } from '@ab/auth';
import {
	type CredentialMasteryRollup,
	type CredentialRow,
	getCredentialMastery,
	getDerivedCertGoals,
	getPrimaryGoal,
	listCredentials,
} from '@ab/bc-study';
import { CREDENTIAL_STATUSES } from '@ab/constants';
import type { PageServerLoad } from './$types';

export interface CredentialIndexRow {
	credential: CredentialRow;
	mastery: CredentialMasteryRollup;
	primaryGoalCredential: boolean;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const [credentials, primaryGoal, goalSlugs] = await Promise.all([
		listCredentials({ status: CREDENTIAL_STATUSES.ACTIVE }),
		getPrimaryGoal(user.id),
		getDerivedCertGoals(user.id),
	]);
	const goalSlugSet = new Set(goalSlugs);

	const rows: CredentialIndexRow[] = await Promise.all(
		credentials.map(async (cred) => ({
			credential: cred,
			mastery: await getCredentialMastery(user.id, cred.id),
			primaryGoalCredential: goalSlugSet.has(cred.slug),
		})),
	);

	const ordered = rows.slice().sort((a, b) => {
		if (a.primaryGoalCredential !== b.primaryGoalCredential) {
			return a.primaryGoalCredential ? -1 : 1;
		}
		if (a.credential.kind !== b.credential.kind) {
			return a.credential.kind.localeCompare(b.credential.kind);
		}
		return a.credential.slug.localeCompare(b.credential.slug);
	});

	return {
		rows: ordered,
		hasPrimaryGoal: primaryGoal !== null,
	};
};

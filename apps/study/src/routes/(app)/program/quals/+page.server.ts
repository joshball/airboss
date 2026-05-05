import { requireAuth } from '@ab/auth';
import {
	type CredentialMasteryRollup,
	type CredentialRow,
	getCredentialMasteryMap,
	getDerivedCertGoals,
	getPrimaryGoal,
	listCredentials,
} from '@ab/bc-study/server';
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

	// Batched mastery: one BC call computes the rollup for every active
	// credential instead of N independent `getCredentialMastery` round trips.
	// See `getCredentialMasteryMap` in `@ab/bc-study/credentials.ts`. Closes
	// the chunk-1 perf MAJOR / backend MAJOR N+1 (review-tail-2026-05).
	const masteryById = await getCredentialMasteryMap(
		user.id,
		credentials.map((c) => c.id),
	);
	const rows: CredentialIndexRow[] = credentials.map((cred) => {
		const mastery = masteryById.get(cred.id);
		if (mastery === undefined) {
			// Missing rollup means the credential row was not seen by the batched
			// helper -- can only happen on a TOCTOU delete between the list and
			// the rollup query. Fall through to a zero rollup so the page still
			// renders.
			return {
				credential: cred,
				mastery: {
					credentialId: cred.id,
					credentialSlug: cred.slug,
					primarySyllabusId: null,
					totalLeaves: 0,
					coveredLeaves: 0,
					masteredLeaves: 0,
					byEvidenceKind: {},
					areas: [],
				},
				primaryGoalCredential: goalSlugSet.has(cred.slug),
			};
		}
		return {
			credential: cred,
			mastery,
			primaryGoalCredential: goalSlugSet.has(cred.slug),
		};
	});

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

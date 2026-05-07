/**
 * `/library/topic/[topic]` -- cross-cut by aviation topic.
 *
 * Active references whose `subjects[]` array contains the requested topic,
 * grouped by `primary_cert` so the page reads as "what does each cert add to
 * this topic?". NULL primary_cert renders last.
 */

import { requireAuth } from '@ab/auth';
import {
	getReadableReferenceIds,
	type LibraryCardPayload,
	listReferencesByTopic,
	projectReferenceToLibraryCard,
} from '@ab/bc-study/server';
import {
	AVIATION_TOPIC_LABELS,
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	CERT_APPLICABILITIES,
	CERT_APPLICABILITY_LABELS,
	type CertApplicability,
} from '@ab/constants';
import { buildPartUrl } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface CardEntry {
	id: string;
	payload: LibraryCardPayload;
}

interface CertGroup {
	cert: CertApplicability | null;
	label: string;
	cards: CardEntry[];
}

/**
 * Stable display order for primary_cert grouping on this page. Mirrors the
 * cert progression a learner walks (Student -> Sport -> ... -> ATP, then
 * `all`); NULL renders last so unowned references don't bury the cert
 * groups.
 */
const CERT_GROUP_ORDER: readonly CertApplicability[] = [
	CERT_APPLICABILITIES.STUDENT,
	CERT_APPLICABILITIES.SPORT,
	CERT_APPLICABILITIES.RECREATIONAL,
	CERT_APPLICABILITIES.PRIVATE,
	CERT_APPLICABILITIES.INSTRUMENT,
	CERT_APPLICABILITIES.COMMERCIAL,
	CERT_APPLICABILITIES.CFI,
	CERT_APPLICABILITIES.CFII,
	CERT_APPLICABILITIES.ATP,
	CERT_APPLICABILITIES.ALL,
];

function isAviationTopic(value: string): value is AviationTopic {
	return (AVIATION_TOPIC_VALUES as readonly string[]).includes(value);
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const topicParam = event.params.topic;
	if (!isAviationTopic(topicParam)) {
		throw error(404, 'Topic not found.');
	}
	const topic = topicParam;

	const refs = await listReferencesByTopic(topic);
	const readableIds = await getReadableReferenceIds(refs.map((r) => r.id));

	const cardsByCert = new Map<CertApplicability | null, CardEntry[]>();
	for (const ref of refs) {
		const cert = (ref.primaryCert as CertApplicability | null) ?? null;
		const entry: CardEntry = {
			id: ref.id,
			payload: projectReferenceToLibraryCard(ref, readableIds.has(ref.id), buildPartUrl),
		};
		const list = cardsByCert.get(cert) ?? [];
		list.push(entry);
		cardsByCert.set(cert, list);
	}

	const groups: CertGroup[] = [];
	for (const cert of CERT_GROUP_ORDER) {
		const cards = cardsByCert.get(cert);
		if (!cards || cards.length === 0) continue;
		groups.push({ cert, label: CERT_APPLICABILITY_LABELS[cert], cards });
	}
	const orphans = cardsByCert.get(null);
	if (orphans && orphans.length > 0) {
		groups.push({ cert: null, label: 'No primary cert', cards: orphans });
	}

	return {
		topic,
		topicLabel: AVIATION_TOPIC_LABELS[topic],
		groups,
		totalCount: refs.length,
	};
};

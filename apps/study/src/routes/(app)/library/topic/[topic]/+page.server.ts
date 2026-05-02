/**
 * `/library/topic/[topic]` -- cross-cut by aviation topic.
 *
 * Active references whose `subjects[]` array contains the requested topic,
 * grouped by `primary_cert` so the page reads as "what does each cert add to
 * this topic?". NULL primary_cert renders last.
 */

import { requireAuth } from '@ab/auth';
import { getReadableReferenceIds, listReferencesByTopic } from '@ab/bc-study';
import {
	AVIATION_TOPIC_LABELS,
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	CERT_APPLICABILITIES,
	CERT_APPLICABILITY_LABELS,
	type CertApplicability,
	externalUrlForReference,
	type ReferenceKind,
} from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface CardView {
	id: string;
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	subjects: readonly string[];
	externalUrl: string | null;
	isReadable: boolean;
}

interface CertGroup {
	cert: CertApplicability | null;
	label: string;
	cards: CardView[];
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

	const cardsByCert = new Map<CertApplicability | null, CardView[]>();
	for (const ref of refs) {
		const cert = (ref.primaryCert as CertApplicability | null) ?? null;
		const kind = ref.kind as ReferenceKind;
		const card: CardView = {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			kind,
			subjects: ref.subjects as readonly string[],
			externalUrl: externalUrlForReference(kind, ref.documentSlug, ref.edition, ref.url),
			isReadable: readableIds.has(ref.id),
		};
		const list = cardsByCert.get(cert) ?? [];
		list.push(card);
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

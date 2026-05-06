<script lang="ts">
/**
 * CFR Section card. Used in card-grid contexts (cross-references, search
 * results). For the in-Part section list, prefer `CfrSectionRow` (which
 * supports inline body expansion).
 *
 * Layout v2: title is "§91.103 -- Preflight action". `external` required.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	partNumber,
	sectionCode,
	sectionTitle,
	href,
	external,
}: {
	partNumber: string;
	sectionCode: string;
	sectionTitle: string;
	href: string;
	external: { url: string; label: string };
} = $props();

const subject = $derived(`§${sectionCode}`);

$effect.pre(() => {
	enforceCardComplete('CfrSectionCard', subject, { partNumber, sectionCode, sectionTitle, external });
});

const title = $derived(sectionTitle ? `${subject} -- ${sectionTitle}` : subject);
</script>

<LibraryReferenceCard
	{title}
	kindBadge="CFR"
	identifier={`Part ${partNumber}`}
	local={{ url: href, label: 'Read section' }}
	{external}
/>

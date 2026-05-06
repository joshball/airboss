<script lang="ts">
/**
 * CFR Section card. Compact -- one row per section in the Part TOC.
 * The full Part context lives on the page header, so the card itself
 * is just code + title.
 *
 * `external` is required: every section card links to its eCFR
 * canonical URL (built via the nav-tree YAML).
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
</script>

<LibraryReferenceCard title={subject} officialTitle={sectionTitle} {href} {external} />

<script lang="ts">
/**
 * CFR Section card. Compact -- one row per section in the Part TOC.
 * The full Part context lives on the page header, so the card itself
 * is just code + title.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	partNumber,
	sectionCode,
	sectionTitle,
	href,
}: {
	partNumber: string;
	sectionCode: string;
	sectionTitle: string;
	href: string;
} = $props();

const subject = $derived(`§${sectionCode}`);

$effect.pre(() => {
	enforceCardComplete('CfrSectionCard', subject, { partNumber, sectionCode, sectionTitle });
});
</script>

<LibraryReferenceCard title={subject} officialTitle={sectionTitle} {href} />

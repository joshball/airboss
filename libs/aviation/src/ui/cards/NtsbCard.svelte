<script lang="ts">
/**
 * NTSB report / corpus card. Title is the report number or corpus name;
 * subtitle is the report title + (optional) date.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	reportNumber,
	reportTitle,
	date = null,
	summary = null,
	href = null,
	external = null,
}: {
	reportNumber: string;
	reportTitle: string;
	date?: string | null;
	summary?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('NtsbCard', reportNumber, { reportNumber, reportTitle });
});
</script>

<LibraryReferenceCard
	title={reportNumber}
	officialTitle={reportTitle}
	description={summary}
	editionBadge={date}
	kindBadge="NTSB"
	{href}
	{external}
/>

<script lang="ts">
/**
 * NTSB report / corpus card.
 *
 * Layout v2: title is the full report title; identifier shows the
 * report number + date. Summary becomes the description.
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

const identifier = $derived(date ? `${reportNumber} · ${date}` : reportNumber);
</script>

<LibraryReferenceCard
	title={reportTitle}
	kindBadge="NTSB"
	{identifier}
	description={summary}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

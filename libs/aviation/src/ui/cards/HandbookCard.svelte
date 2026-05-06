<script lang="ts">
/**
 * Handbook card -- PHAK, AFH, AVWX, etc.
 *
 * Layout v2: title is the full publisher name ("Pilot's Handbook of
 * Aeronautical Knowledge"). Kind chip is "HANDBOOK"; identifier carries
 * the FAA-H designation.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	shortSlug,
	fullTitle,
	edition,
	publisher,
	description = null,
	whyItMatters = null,
	topics = [],
	href,
	external = null,
}: {
	shortSlug: string;
	fullTitle: string;
	edition: string;
	publisher: string;
	description?: string | null;
	whyItMatters?: string | null;
	topics?: readonly { readonly value: string; readonly label: string }[];
	href: string;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('HandbookCard', shortSlug, { shortSlug, fullTitle, edition, publisher });
});

const identifier = $derived(edition && edition !== '-' ? edition : shortSlug.toUpperCase());
</script>

<LibraryReferenceCard
	title={fullTitle}
	kindBadge="HANDBOOK"
	{identifier}
	{description}
	{whyItMatters}
	{topics}
	local={{ url: href, label: 'Read in airboss' }}
	{external}
/>

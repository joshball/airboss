<script lang="ts">
/**
 * Airman Certification Standards (ACS) card.
 *
 * The ACS is the FAA's pilot test guide -- one document per airman
 * certificate level (Private/Commercial/ATP/CFI airplane, helicopter, ...).
 * Layout v2: title is the full publication name (e.g. "Private Pilot --
 * Airplane Airman Certification Standards"); kind chip is "ACS"; identifier
 * carries the FAA-S-ACS designation + edition.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	slug,
	title,
	edition,
	description = null,
	whyItMatters = null,
	topics = [],
	href = null,
	external = null,
}: {
	slug: string;
	title: string;
	edition: string;
	description?: string | null;
	whyItMatters?: string | null;
	topics?: readonly { readonly value: string; readonly label: string }[];
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('AcsCard', slug, { slug, title, edition });
});

const identifier = $derived(edition && edition !== '-' ? edition : slug.toUpperCase());
</script>

<LibraryReferenceCard
	{title}
	kindBadge="ACS"
	{identifier}
	{description}
	{whyItMatters}
	{topics}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

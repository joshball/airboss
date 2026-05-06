<script lang="ts">
/**
 * Practical Test Standards (PTS) card.
 *
 * The PTS is the FAA's pre-ACS pilot test guide. It still gets cited in
 * older training materials and remains in force for some certificates the
 * ACS hasn't reached yet. Layout v2: title is the full publication name
 * (e.g. "Flight Instructor Practical Test Standards"); kind chip is "PTS";
 * identifier carries the FAA-S-PTS designation + edition.
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
	enforceCardComplete('PtsCard', slug, { slug, title, edition });
});

const identifier = $derived(edition && edition !== '-' ? edition : slug.toUpperCase());
</script>

<LibraryReferenceCard
	{title}
	kindBadge="PTS"
	{identifier}
	{description}
	{whyItMatters}
	{topics}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

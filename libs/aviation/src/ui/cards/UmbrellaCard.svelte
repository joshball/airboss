<script lang="ts">
/**
 * Generic umbrella card -- the fallback for any reference we haven't
 * built a domain wrapper for yet. Tolerant: only `title` is required.
 * Description and whyItMatters are recommended (the audit page will
 * surface their absence) but never required, so a freshly-ingested
 * corpus doesn't crash the page before someone has authored copy.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	title,
	officialTitle = null,
	description = null,
	whyItMatters = null,
	kindBadge = null,
	editionBadge = null,
	href = null,
	external = null,
}: {
	title: string;
	officialTitle?: string | null;
	description?: string | null;
	whyItMatters?: string | null;
	kindBadge?: string | null;
	editionBadge?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('UmbrellaCard', title, { title });
});
</script>

<LibraryReferenceCard
	{title}
	{officialTitle}
	{description}
	{whyItMatters}
	{kindBadge}
	{editionBadge}
	{href}
	{external}
/>

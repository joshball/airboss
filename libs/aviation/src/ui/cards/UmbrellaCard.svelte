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
	description = null,
	whyItMatters = null,
	kindBadge = null,
	identifier = null,
	href = null,
	external = null,
}: {
	title: string;
	description?: string | null;
	whyItMatters?: string | null;
	kindBadge?: string | null;
	identifier?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('UmbrellaCard', title, { title });
});
</script>

<LibraryReferenceCard
	{title}
	{kindBadge}
	{identifier}
	{description}
	{whyItMatters}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

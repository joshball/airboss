<script lang="ts">
/**
 * Safety Alert for Operators (SAFO) card.
 *
 * SAFOs are short FAA bulletins that flag a safety concern to operators.
 * Layout v2: title is the SAFO subject heading; kind chip is "SAFO";
 * identifier is the SAFO number + date when available.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	safoNumber,
	title,
	date = null,
	summary = null,
	audience = null,
	href = null,
	external = null,
}: {
	safoNumber: string;
	title: string;
	date?: string | null;
	summary?: string | null;
	audience?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('SafoCard', safoNumber, { safoNumber, title });
});

const identifier = $derived(date ? `${safoNumber} · ${date}` : safoNumber);
const description = $derived(audience && summary ? `${audience} -- ${summary}` : (summary ?? audience));
</script>

<LibraryReferenceCard
	{title}
	kindBadge="SAFO"
	{identifier}
	{description}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

<script lang="ts">
/**
 * Information for Operators (InFO) card.
 *
 * InFOs are short FAA bulletins that share operational information with
 * operators -- sibling program to SAFOs, same shape, different program.
 * Layout v2: title is the InFO subject heading; kind chip is "INFO";
 * identifier is the InFO number + date when available.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	infoNumber,
	title,
	date = null,
	summary = null,
	audience = null,
	href = null,
	external = null,
}: {
	infoNumber: string;
	title: string;
	date?: string | null;
	summary?: string | null;
	audience?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('InfoCard', infoNumber, { infoNumber, title });
});

const identifier = $derived(date ? `${infoNumber} · ${date}` : infoNumber);
const description = $derived(audience && summary ? `${audience} -- ${summary}` : (summary ?? audience));
</script>

<LibraryReferenceCard
	{title}
	kindBadge="INFO"
	{identifier}
	{description}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

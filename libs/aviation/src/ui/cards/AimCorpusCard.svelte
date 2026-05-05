<script lang="ts">
/**
 * AIM corpus card. Single AIM doc + the Pilot/Controller Glossary under
 * one bucket. Title is the short form ("AIM" / "Pilot/Controller
 * Glossary"); description + whyItMatters required so the card always
 * communicates purpose.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	title,
	officialTitle = null,
	description,
	whyItMatters,
	edition = null,
	href = null,
	external = null,
}: {
	title: string;
	officialTitle?: string | null;
	description: string;
	whyItMatters: string;
	edition?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('AimCorpusCard', title, { title, description, whyItMatters });
});
</script>

<LibraryReferenceCard
	{title}
	{officialTitle}
	{description}
	{whyItMatters}
	{href}
	{external}
	editionBadge={edition}
	kindBadge="AIM"
/>

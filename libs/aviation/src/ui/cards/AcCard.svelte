<script lang="ts">
/**
 * Advisory Circular card. Title is the AC number (`AC 91-21.1D`); the
 * AC's official title is the subtitle.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	acNumber,
	acTitle,
	edition,
	description = null,
	href = null,
	external = null,
}: {
	acNumber: string;
	acTitle: string;
	edition: string;
	description?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

const subject = $derived(`AC ${acNumber}`);

$effect.pre(() => {
	enforceCardComplete('AcCard', subject, { acNumber, acTitle, edition });
});
</script>

<LibraryReferenceCard
	title={subject}
	officialTitle={acTitle}
	{description}
	{href}
	{external}
	editionBadge={edition}
	kindBadge="AC"
/>

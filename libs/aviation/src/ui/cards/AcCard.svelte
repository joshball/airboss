<script lang="ts">
/**
 * Advisory Circular card.
 *
 * Layout v2: title is "AC 91-21.1D -- Use of Portable Electronic Devices
 * Aboard Aircraft" (full readable name). Kind chip carries "AC", identifier
 * carries the AC number for top-right reference.
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

const title = $derived(acTitle ? `${subject} -- ${acTitle}` : subject);
</script>

<LibraryReferenceCard
	{title}
	kindBadge="AC"
	identifier={edition && edition !== '-' ? `${subject} · ${edition}` : subject}
	{description}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

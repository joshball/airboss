<script lang="ts">
/**
 * CFR Part card. Used on /library/regulations/14-cfr (and /49-cfr) to
 * render each Part. Title is "<title> CFR Part <part>" (e.g.
 * "14 CFR Part 91" or "49 CFR Part 830") so a learner reading the card
 * out of context still knows what regulator + Part it belongs to. The
 * official Part title sits as subtitle ("General Operating and Flight
 * Rules").
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	titleNumber,
	partNumber,
	partTitle,
	description = null,
	whyItMatters = null,
	href,
	sectionCount = null,
}: {
	titleNumber: 14 | 49;
	partNumber: string;
	partTitle: string;
	description?: string | null;
	whyItMatters?: string | null;
	href: string;
	sectionCount?: number | null;
} = $props();

const subject = $derived(`${titleNumber} CFR Part ${partNumber}`);

$effect.pre(() => {
	enforceCardComplete('CfrPartCard', subject, { titleNumber, partNumber, partTitle });
});

const countLabel = $derived(sectionCount === null ? null : `${sectionCount} section${sectionCount === 1 ? '' : 's'}`);
</script>

<LibraryReferenceCard
	title={subject}
	officialTitle={partTitle}
	{description}
	{whyItMatters}
	{href}
	{countLabel}
/>

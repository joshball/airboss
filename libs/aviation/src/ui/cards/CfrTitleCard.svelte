<script lang="ts">
/**
 * Top-level CFR title card. Used on /library/regulations to render the
 * "14 CFR" / "49 CFR" buckets. Title is the short form ("14 CFR"); the
 * topic ("Aeronautics and Space") sits as subtitle. The full official
 * title ("Title 14 of the Code of Federal Regulations") is the tooltip
 * on the short label, surfaced via <abbr>.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	shortLabel,
	topic,
	officialTitle,
	description,
	whyItMatters,
	href,
	countLabel = null,
}: {
	shortLabel: string;
	topic: string;
	officialTitle: string;
	description: string;
	whyItMatters: string;
	href: string;
	countLabel?: string | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('CfrTitleCard', shortLabel, { shortLabel, topic, description, whyItMatters });
});
</script>

<LibraryReferenceCard
	title={shortLabel}
	titleAbbreviation={officialTitle}
	officialTitle={topic}
	{description}
	{whyItMatters}
	{href}
	{countLabel}
/>

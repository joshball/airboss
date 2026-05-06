<script lang="ts">
/**
 * Top-level CFR title card. Used on /library/regulations to render the
 * "14 CFR" / "49 CFR" buckets.
 *
 * Layout v2: title is the FULL readable name -- "Title 14 CFR -- Aeronautics
 * and Space" -- not split into short-label + subtitle. The card body is
 * non-clickable; the two-link footer carries `Open in airboss ->` (kind page)
 * and `View on eCFR ↗`.
 *
 * `external` is required: every CFR title must link to its eCFR landing.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	shortLabel,
	topic,
	description,
	whyItMatters,
	href,
	external,
}: {
	shortLabel: string;
	topic: string;
	description: string;
	whyItMatters: string;
	href: string;
	external: { url: string; label: string };
} = $props();

$effect.pre(() => {
	enforceCardComplete('CfrTitleCard', shortLabel, {
		shortLabel,
		topic,
		description,
		whyItMatters,
		external,
	});
});

// Title v2: "Title 14 CFR -- Aeronautics and Space" (one heading, no split).
// Falls back to `shortLabel` if topic is missing for any reason -- the
// validator throws on missing topic in dev, so this is a defensive default.
const title = $derived(topic ? `${shortLabel} -- ${topic}` : shortLabel);
const identifier = $derived(`Title ${shortLabel.replace(/^[^0-9]*(\d+).*$/, '$1')}`);
</script>

<LibraryReferenceCard
	{title}
	kindBadge="CFR"
	{identifier}
	{description}
	{whyItMatters}
	local={{ url: href, label: 'Browse parts' }}
	{external}
/>

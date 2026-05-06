<script lang="ts">
/**
 * CFR Part card. Used on /library/regulations/14-cfr (and /49-cfr) to
 * render each Part.
 *
 * Layout v2: title is the FULL readable name (e.g. "14 CFR Part 91 --
 * General Operating and Flight Rules"). When the Part has no authored
 * title yet, the card falls back to "14 CFR Part 91" alone -- the audit
 * page surfaces missing copy as Wave 1 work.
 *
 * `external` is required: every Part links to its eCFR canonical URL
 * (built via the nav-tree YAML in libs/sources/src/regs/nav-tree.ts).
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	titleNumber,
	partNumber,
	partTitle,
	description = null,
	whyItMatters = null,
	topics = [],
	href,
	external,
	sectionCount = null,
}: {
	titleNumber: 14 | 49;
	partNumber: string;
	partTitle: string;
	description?: string | null;
	whyItMatters?: string | null;
	topics?: readonly { readonly value: string; readonly label: string }[];
	href: string;
	external: { url: string; label: string };
	sectionCount?: number | null;
} = $props();

const subject = $derived(`${titleNumber} CFR Part ${partNumber}`);

$effect.pre(() => {
	enforceCardComplete('CfrPartCard', subject, { titleNumber, partNumber, partTitle, external });
});

// Combine subject + partTitle into a single full heading. Skip the join
// when the partTitle is just the subject repeated (the seeder fallback
// before Wave 1 authoring populates the metadata).
const title = $derived(partTitle && partTitle !== subject ? `${subject} -- ${partTitle}` : subject);
const identifier = $derived(
	sectionCount === null
		? `Part ${partNumber}`
		: `Part ${partNumber} · ${sectionCount} section${sectionCount === 1 ? '' : 's'}`,
);
const localLabel = $derived(sectionCount === null || sectionCount === 0 ? 'Open Part' : 'Browse sections');
</script>

<LibraryReferenceCard
	{title}
	kindBadge="CFR"
	{identifier}
	{description}
	{whyItMatters}
	{topics}
	local={{ url: href, label: localLabel }}
	{external}
/>

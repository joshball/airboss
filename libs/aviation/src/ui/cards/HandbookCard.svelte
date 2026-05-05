<script lang="ts">
/**
 * Handbook card -- PHAK, AFH, AVWX, etc. Title is the short slug
 * (uppercased); subtitle is the full title; edition + publisher in
 * the badge row.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	shortSlug,
	fullTitle,
	edition,
	publisher,
	description = null,
	whyItMatters = null,
	href,
}: {
	shortSlug: string;
	fullTitle: string;
	edition: string;
	publisher: string;
	description?: string | null;
	whyItMatters?: string | null;
	href: string;
} = $props();

$effect.pre(() => {
	enforceCardComplete('HandbookCard', shortSlug, { shortSlug, fullTitle, edition, publisher });
});
</script>

<LibraryReferenceCard
	title={shortSlug.toUpperCase()}
	officialTitle={fullTitle}
	{description}
	{whyItMatters}
	{href}
	kindBadge={publisher}
	editionBadge={edition}
/>

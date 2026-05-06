<script lang="ts">
/**
 * AIM corpus card. Single AIM doc + the Pilot/Controller Glossary under
 * one bucket.
 *
 * Layout v2: title is the publisher's full name ("Aeronautical
 * Information Manual"). The kind chip carries "AIM" / "PCG"; identifier
 * is the edition ("2026-04").
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	title,
	description,
	whyItMatters,
	edition = null,
	kindBadge = 'AIM',
	href = null,
	external = null,
}: {
	title: string;
	description: string;
	whyItMatters: string;
	edition?: string | null;
	kindBadge?: string;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('AimCorpusCard', title, { title, description, whyItMatters });
});
</script>

<LibraryReferenceCard
	{title}
	{kindBadge}
	identifier={edition}
	{description}
	{whyItMatters}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

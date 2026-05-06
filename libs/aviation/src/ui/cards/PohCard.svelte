<script lang="ts">
/**
 * Pilot Operating Handbook / Aircraft Flight Manual (POH/AFM) card.
 *
 * POHs are aircraft-specific. The FAA does not publish them; the airframe
 * manufacturer does. Layout v2: title is the aircraft model + POH (e.g.
 * "Cessna 172S Pilot Operating Handbook"); kind chip is "POH"; identifier
 * carries the document number / revision when known. The external link
 * label is the publisher (manufacturer) name rather than "FAA".
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	aircraftModel,
	title,
	revision,
	description = null,
	href = null,
	external = null,
}: {
	aircraftModel: string;
	title: string;
	revision: string;
	description?: string | null;
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('PohCard', aircraftModel, { aircraftModel, title, revision });
});

const identifier = $derived(revision && revision !== '-' ? `Rev. ${revision}` : aircraftModel);
</script>

<LibraryReferenceCard
	{title}
	kindBadge="POH"
	{identifier}
	{description}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	{external}
/>

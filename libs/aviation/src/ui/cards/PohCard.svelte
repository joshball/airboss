<script lang="ts">
/**
 * Pilot Operating Handbook / Aircraft Flight Manual (POH/AFM) card.
 *
 * POHs are aircraft-specific. The FAA does not publish them; the airframe
 * manufacturer does. Layout v3 (V3.5 library refresh): title is the
 * aircraft model + POH (e.g. "Cessna 172S Pilot Operating Handbook"); kind
 * chip is "POH"; identifier carries the document number / revision; the
 * external link label is the manufacturer name (mirrors how the AC card
 * labels its external link with the publisher rather than the FAA).
 *
 * The optional `whyItMatters` + `topics` props line up with `AcsCard` so a
 * POH renders the same pedagogy framing -- pilot-relevance behind the
 * expander, topic chips beneath the description -- as the rest of the
 * regulatory corpora.
 */

import LibraryReferenceCard from '../LibraryReferenceCard.svelte';
import { enforceCardComplete } from './validation';

let {
	aircraftModel,
	title,
	revision,
	manufacturer,
	revisionDate = null,
	applicableSerialNumbers = null,
	description = null,
	whyItMatters = null,
	topics = [],
	href = null,
	external = null,
}: {
	aircraftModel: string;
	title: string;
	revision: string;
	manufacturer: string;
	revisionDate?: string | null;
	applicableSerialNumbers?: string | null;
	description?: string | null;
	whyItMatters?: string | null;
	topics?: readonly { readonly value: string; readonly label: string }[];
	href?: string | null;
	external?: { url: string; label: string } | null;
} = $props();

$effect.pre(() => {
	enforceCardComplete('PohCard', aircraftModel, { aircraftModel, title, revision, manufacturer });
});

// Identifier reads "Rev. <n>" optionally followed by "(<date>)" when
// authored. A revision like "-" means unknown; fall back to the model so the
// top-right slot still carries a citation handle.
const identifier = $derived.by(() => {
	if (!revision || revision === '-') return aircraftModel;
	if (revisionDate) return `Rev. ${revision} (${revisionDate})`;
	return `Rev. ${revision}`;
});

// External link label is the manufacturer name (Cessna, Piper, Cirrus) so
// the footer reads "↗ Cessna" rather than the generic "FAA" used for
// FAA-published corpora. Authoring may pass a fully-shaped `external`
// object with its own label; the manufacturer fallback only applies when
// just a URL is on hand.
const externalForCard = $derived.by(() => {
	if (!external) return null;
	if (external.label && external.label.trim() !== '') return external;
	return { url: external.url, label: manufacturer };
});

// Compose description so the operator-facing serial-number applicability
// stays close to the publisher summary. The card only renders one
// description paragraph; concatenating keeps the layout simple without
// inventing a new slot.
const composedDescription = $derived.by(() => {
	if (!description && !applicableSerialNumbers) return null;
	if (description && applicableSerialNumbers) {
		return `${description} Applies to: ${applicableSerialNumbers}.`;
	}
	if (applicableSerialNumbers) return `Applies to: ${applicableSerialNumbers}.`;
	return description;
});
</script>

<LibraryReferenceCard
	{title}
	kindBadge="POH"
	{identifier}
	description={composedDescription}
	{whyItMatters}
	{topics}
	local={href ? { url: href, label: 'Open in airboss' } : null}
	external={externalForCard}
/>

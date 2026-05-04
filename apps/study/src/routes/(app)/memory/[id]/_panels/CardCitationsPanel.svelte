<script lang="ts">
import type { CitationWithTarget } from '@ab/bc-study';
import { CITATION_TARGET_LABELS, CITATION_TARGET_TYPES, type CitationTargetType, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import CitationChips, { type CitationChipItem } from '@ab/ui/components/CitationChips.svelte';
import CitationPicker, { type CitationPickerSelection } from '@ab/ui/components/CitationPicker.svelte';
import { invalidateAll } from '$app/navigation';

/**
 * Citations panel: list of cited references plus the "Cite a reference"
 * picker. Handles the picker's POST to `?/addCitation`, surfaces inline
 * errors, and invalidates the page on success so the server load refreshes.
 */

interface Props {
	cardId: string;
	citations: ReadonlyArray<CitationWithTarget>;
}

let { cardId, citations }: Props = $props();

let citationPickerOpen = $state(false);
let citationError = $state<string | null>(null);

const citationItems = $derived<CitationChipItem[]>(
	citations.map((c) => ({
		id: c.citation.id,
		typeLabel: targetTypeLabel(c.target.type),
		label: c.target.label,
		href: c.target.href ?? null,
		// Stage-5: external_ref opens in a new tab; in-app deep links
		// (`reference_section` -> flightbag, `knowledge_node` -> /knowledge/<id>)
		// stay in the same tab so the back button returns to the source.
		targetExternal: c.target.type === CITATION_TARGET_TYPES.EXTERNAL_REF,
		context: c.citation.citationContext,
	})),
);
const citationRemoveAction = $derived(`${ROUTES.MEMORY_CARD(cardId)}?/removeCitation`);
// Stage-5 (WP `stage5-citation-deeplink`): the polymorphic
// `reference_section` target type covers every corpus-backed citation
// (CFR / handbook / AC / ACS / AIM / NTSB / SAFO / InFO) -- one search
// box, one tab. Knowledge nodes and external refs keep their own tabs.
const citationTargets = [
	CITATION_TARGET_TYPES.REFERENCE_SECTION,
	CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
	CITATION_TARGET_TYPES.EXTERNAL_REF,
];

function targetTypeLabel(t: CitationTargetType): string {
	return CITATION_TARGET_LABELS[t];
}

async function handleCitationSelect(selection: CitationPickerSelection): Promise<void> {
	citationError = null;
	const body = new FormData();
	body.set('targetType', selection.targetType);
	body.set('targetId', selection.targetId);
	body.set('note', selection.note);
	const res = await fetch(`${ROUTES.MEMORY_CARD(cardId)}?/addCitation`, {
		method: 'POST',
		body,
		headers: { accept: 'application/json' },
	});
	if (!res.ok) {
		// Surface the actionResult error message when present.
		try {
			const payload = await res.json();
			const message = payload?.data?.fieldErrors?._ ?? 'Could not add citation.';
			throw new Error(message);
		} catch (err) {
			throw err instanceof Error ? err : new Error('Could not add citation.');
		}
	}
	citationPickerOpen = false;
	await invalidateAll();
}
</script>

<article class="content">
	<div class="citations-header">
		<h2>Citations</h2>
		<span class="citations-add">
			<Button variant="secondary" onclick={() => (citationPickerOpen = true)}>
				+ Cite a reference
			</Button>
		</span>
	</div>
	{#if citationError}
		<div class="error" role="alert">{citationError}</div>
	{/if}
	{#if citations.length === 0}
		<p class="empty-note">No citations yet. Link a reference section, knowledge node, or external link.</p>
	{:else}
		<CitationChips items={citationItems} editable removeAction={citationRemoveAction} />
	{/if}
</article>

<CitationPicker
	bind:open={citationPickerOpen}
	targetTypes={citationTargets}
	onSelect={async (selection) => {
		try {
			await handleCitationSelect(selection);
		} catch (err) {
			citationError = err instanceof Error ? err.message : 'Could not add citation.';
			throw err;
		}
	}}
	onCancel={() => (citationPickerOpen = false)}
/>

<style>
	.content {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.content h2 {
		margin: 0;
		font-size: var(--type-reading-body-size);
		color: var(--ink-strong);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.error {
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		color: var(--action-hazard-active);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.empty-note {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
	}

	.citations-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.citations-add {
		flex: 0 0 auto;
	}
</style>

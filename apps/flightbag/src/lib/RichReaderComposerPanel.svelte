<script lang="ts" module>
/**
 * Right-column composer panel for the rich reader. Reads composer state
 * from the layout's context and renders the InlineCardComposer when
 * `state.kind === 'card-now'`. Phase 5 will extend this panel with the
 * note composer (`kind === 'note'`) + the per-section notes panel
 * (when `state.kind === null`).
 *
 * Save POSTs to /api/cards (same origin), which calls createCard. The
 * composer stays open after save so the user can author another card
 * from the same passage.
 */
</script>

<script lang="ts">
import { CARD_KINDS, CARD_TYPES, domainLabel, DOMAIN_VALUES } from '@ab/constants';
import { useComposerState } from '@ab/library';
import InlineCardComposer from '@ab/library/InlineCardComposer.svelte';

const composerState = useComposerState();

let busy = $state(false);
let flash = $state<string | null>(null);
let errorMessage = $state<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const domains = DOMAIN_VALUES.map((value) => ({ value, label: domainLabel(value) }));

async function onSave(input: { front: string; back: string; domain: string; tags: string[] }) {
	if (!composerState) return;
	busy = true;
	errorMessage = null;
	try {
		const res = await fetch('/api/cards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				front: input.front,
				back: input.back,
				domain: input.domain,
				cardType: CARD_TYPES.BASIC,
				kind: CARD_KINDS.RECALL,
				tags: input.tags,
			}),
		});
		if (!res.ok) {
			const payload = (await res.json().catch(() => null)) as { error?: string } | null;
			errorMessage = payload?.error ?? `Save failed (${res.status}).`;
			return;
		}
		flash = 'Saved.';
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			flash = null;
		}, 1800);
	} catch (err) {
		console.error(err);
		errorMessage = "Couldn't save card. Try again?";
	} finally {
		busy = false;
	}
}

function onClose() {
	composerState?.close();
}
</script>

{#if composerState && composerState.kind === 'card-now' && composerState.cardPrefill}
	<InlineCardComposer
		prefill={composerState.cardPrefill}
		{domains}
		{onSave}
		{onClose}
		{busy}
		{flash}
		{errorMessage}
	/>
{/if}

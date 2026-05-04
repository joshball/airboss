<script lang="ts">
/**
 * Two-stack citation panel: handbook + regulation. The user-pref
 * `study.home.citation_order` selects which stack opens by default
 * (`'hb'` -> handbook open, `'reg'` -> regulation open). The toggle is
 * a SvelteKit form action POST against `?/setPref` with optimistic UI:
 * the panel flips immediately, the form action runs in the background,
 * the value rolls back on error.
 */

import { type CitationOrder, USER_PREF_KEYS } from '@ab/constants';
import { applyAction, deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { MapCitationStacks } from '../_lib/map-types';

interface Props {
	stacks: MapCitationStacks;
	citationOrder: CitationOrder;
}

let { stacks, citationOrder }: Props = $props();

// `pendingOrder` is set when the user clicks the toggle so the optimistic
// flip beats the form-action round trip. `null` means "no override --
// follow the prop." Reset to `null` once the navigation propagates the
// new persisted value back through `citationOrder`.
let pendingOrder = $state<CitationOrder | null>(null);
const optimisticOrder = $derived<CitationOrder>(pendingOrder ?? citationOrder);

// When the prop catches up with the optimistic value, drop the override.
$effect(() => {
	if (pendingOrder !== null && pendingOrder === citationOrder) {
		pendingOrder = null;
	}
});

async function setOrder(next: CitationOrder, event: MouseEvent | KeyboardEvent): Promise<void> {
	event.preventDefault();
	pendingOrder = next;
	try {
		const formData = new FormData();
		formData.set('key', USER_PREF_KEYS.CITATION_ORDER);
		formData.set('value', next);
		const response = await fetch('?/setPref', {
			method: 'POST',
			body: formData,
			headers: { 'x-sveltekit-action': 'true' },
		});
		const result = deserialize(await response.text());
		if (result.type === 'failure') {
			pendingOrder = null;
			return;
		}
		await applyAction(result);
		await invalidateAll();
	} catch {
		pendingOrder = null;
	}
}
</script>

<div class="stacks" data-active={optimisticOrder}>
	<div class="stack hb" class:open={optimisticOrder === 'hb'}>
		<h4 class="stack-h">Handbook</h4>
		<ul class="chips">
			{#each stacks.handbook as chip (chip.id)}
				<li><a class="chip" href={chip.href}>{chip.label}</a></li>
			{/each}
			{#if stacks.handbook.length === 0}
				<li class="empty">No handbook citations.</li>
			{/if}
		</ul>
	</div>
	<div class="stack reg" class:open={optimisticOrder === 'reg'}>
		<h4 class="stack-h">Regulation</h4>
		<ul class="chips">
			{#each stacks.regulation as chip (chip.id)}
				<li><a class="chip" href={chip.href}>{chip.label}</a></li>
			{/each}
			{#if stacks.regulation.length === 0}
				<li class="empty">No regulation citations.</li>
			{/if}
		</ul>
	</div>

	<div class="toggle">
		<button
			type="button"
			class:active={optimisticOrder === 'hb'}
			aria-label="Show handbook citations first"
			onclick={(e) => setOrder('hb', e)}
		>
			[hb]
		</button>
		<button
			type="button"
			class:active={optimisticOrder === 'reg'}
			aria-label="Show regulation citations first"
			onclick={(e) => setOrder('reg', e)}
		>
			[reg]
		</button>
	</div>
</div>

<style>
.stacks {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-md);
	padding: var(--space-sm) 0 var(--space-sm) calc(1ch + var(--space-sm));
	position: relative;
}

.stack {
	display: flex;
	flex-direction: column;
	gap: var(--space-2xs);
	opacity: 0.55;
}

.stack.open {
	opacity: 1;
}

.stack-h {
	margin: 0;
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
	font-weight: var(--font-weight-medium);
	text-transform: uppercase;
	letter-spacing: var(--letter-spacing-wide);
}

.chips {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-2xs);
}

.chip {
	color: var(--link-default);
	text-decoration: underline;
	font-size: var(--font-size-sm);
}

.empty {
	color: var(--ink-muted);
	font-size: var(--font-size-sm);
}

.toggle {
	position: absolute;
	top: 0;
	right: 0;
	display: flex;
	gap: var(--space-2xs);
	font-family: var(--font-family-mono);
	font-size: var(--font-size-sm);
}

.toggle button {
	background: transparent;
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	color: var(--ink-muted);
	cursor: pointer;
	padding: 0 var(--space-2xs);
}

.toggle button.active {
	background: var(--link-default);
	color: var(--surface-panel);
	border-color: var(--link-default);
}

@media (max-width: 700px) {
	.stacks {
		grid-template-columns: 1fr;
	}
}
</style>

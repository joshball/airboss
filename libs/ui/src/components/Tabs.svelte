<script lang="ts" module>
export interface TabItem {
	id: string;
	label: string;
	disabled?: boolean;
}
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Accessible tab list + panels. Arrow, Home, End keys navigate.
 * Controlled via `active` (bindable).
 */

let {
	tabs,
	active = $bindable(''),
	ariaLabel,
	panel,
}: {
	tabs: TabItem[];
	active?: string;
	ariaLabel?: string;
	panel: Snippet<[string]>;
} = $props();

const resolvedActive = $derived(active || tabs[0]?.id || '');

function focusByOffset(currentId: string, delta: number): void {
	const enabled = tabs.filter((t) => !t.disabled);
	const idx = enabled.findIndex((t) => t.id === currentId);
	if (idx === -1) return;
	const next = enabled[(idx + delta + enabled.length) % enabled.length];
	active = next.id;
	requestAnimationFrame(() => {
		const el = document.getElementById(`tab-${next.id}`);
		el?.focus();
	});
}

function handleKeyDown(event: KeyboardEvent, id: string): void {
	switch (event.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			event.preventDefault();
			focusByOffset(id, 1);
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
			event.preventDefault();
			focusByOffset(id, -1);
			break;
		case 'Home': {
			event.preventDefault();
			const first = tabs.find((t) => !t.disabled);
			if (first) {
				active = first.id;
				document.getElementById(`tab-${first.id}`)?.focus();
			}
			break;
		}
		case 'End': {
			event.preventDefault();
			const enabled = tabs.filter((t) => !t.disabled);
			const last = enabled[enabled.length - 1];
			if (last) {
				active = last.id;
				document.getElementById(`tab-${last.id}`)?.focus();
			}
			break;
		}
	}
}
</script>

<div class="tabs">
	<div class="tablist" role="tablist" aria-label={ariaLabel}>
		{#each tabs as t (t.id)}
			{@const selected = resolvedActive === t.id}
			<button
				type="button"
				id="tab-{t.id}"
				class="tab"
				class:is-active={selected}
				role="tab"
				aria-selected={selected}
				aria-controls="panel-{t.id}"
				tabindex={selected ? 0 : -1}
				disabled={t.disabled}
				onclick={() => (active = t.id)}
				onkeydown={(e) => handleKeyDown(e, t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>
	<div
		class="panel"
		id="panel-{resolvedActive}"
		role="tabpanel"
		aria-labelledby="tab-{resolvedActive}"
		tabindex="0"
	>
		{@render panel(resolvedActive)}
	</div>
</div>

<style>
	.tabs {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		min-width: 0;
	}

	.tablist {
		display: flex;
		gap: var(--space-xs);
		border-bottom: 1px solid var(--edge-default);
	}

	.tab {
		appearance: none;
		background: transparent;
		border: 1px solid transparent;
		border-bottom: none;
		border-top-left-radius: var(--radius-sm);
		border-top-right-radius: var(--radius-sm);
		padding: var(--control-padding-y-sm) var(--control-padding-x-md);
		font: inherit;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		cursor: pointer;
		margin-bottom: -1px;
	}

	.tab:not(:disabled):hover {
		color: var(--ink-body);
		background: var(--surface-muted);
	}

	.tab:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.tab:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tab.is-active {
		color: var(--action-default);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		border-bottom-color: var(--action-default-wash);
	}

	.panel {
		min-width: 0;
	}

	.panel:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>

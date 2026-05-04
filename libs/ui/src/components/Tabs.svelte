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

// Default to the first enabled tab so a disabled `tabs[0]` doesn't strand the
// panel/focus on a tab that can never be activated by keyboard.
const resolvedActive = $derived(active || tabs.find((t) => !t.disabled)?.id || '');

let panelEl = $state<HTMLDivElement | null>(null);

/**
 * After a tab activation that came from a user gesture (click or arrow key),
 * make sure the panel content is visible. On small viewports the new panel
 * may render off-screen with no indication; nudging it into view on
 * activation matches the WAI-ARIA tabs pattern's intent. Honors
 * `prefers-reduced-motion` so we don't smooth-scroll for users who opted
 * out of motion.
 */
function ensurePanelVisible(): void {
	if (typeof window === 'undefined' || !panelEl) return;
	const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	panelEl.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
}

function activate(id: string): void {
	active = id;
	requestAnimationFrame(ensurePanelVisible);
}

function focusByOffset(currentId: string, delta: number): void {
	const enabled = tabs.filter((t) => !t.disabled);
	const idx = enabled.findIndex((t) => t.id === currentId);
	if (idx === -1) return;
	const next = enabled[(idx + delta + enabled.length) % enabled.length];
	activate(next.id);
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
				activate(first.id);
				// Match focusByOffset: defer focus so Svelte applies the new
				// `tabindex` ordering before the focus call. Mixing rAF +
				// sync focus confused some assistive-tech announcers.
				requestAnimationFrame(() => document.getElementById(`tab-${first.id}`)?.focus());
			}
			break;
		}
		case 'End': {
			event.preventDefault();
			const enabled = tabs.filter((t) => !t.disabled);
			const last = enabled[enabled.length - 1];
			if (last) {
				activate(last.id);
				requestAnimationFrame(() => document.getElementById(`tab-${last.id}`)?.focus());
			}
			break;
		}
	}
}
</script>

<div class="tabs" data-testid="tabs-root">
	<div class="tablist" role="tablist" aria-label={ariaLabel} data-testid="tabs-list">
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
				data-testid={`tabs-item-${t.id}`}
				data-state={t.disabled ? 'disabled' : selected ? 'active' : 'idle'}
				onclick={() => activate(t.id)}
				onkeydown={(e) => handleKeyDown(e, t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>
	<div
		bind:this={panelEl}
		class="panel"
		id="panel-{resolvedActive}"
		role="tabpanel"
		aria-labelledby="tab-{resolvedActive}"
		tabindex="0"
		data-testid="tabs-panel"
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

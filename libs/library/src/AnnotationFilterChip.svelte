<script lang="ts" module>
import type { AnnotationFilter } from '@ab/constants';

/**
 * `<AnnotationFilterChip>` -- reader-chrome control for the
 * "Show: All / Highlights only / Notes only / Hidden" filter
 * (wp-flightbag-rich-reader Phase 6).
 *
 * Pure component: emits `onchange(value)`; the host persists via the
 * `/reading-prefs` endpoint and updates the AnnotationLayer's filter
 * prop. Mirrors the optimistic-flip pattern of ReaderPrefsButton.
 */

export interface AnnotationFilterChipProps {
	readonly value: AnnotationFilter;
	readonly onchange: (next: AnnotationFilter) => void;
}
</script>

<script lang="ts">
import { ANNOTATION_FILTER_LABELS, ANNOTATION_FILTER_VALUES } from '@ab/constants';

let { value, onchange }: AnnotationFilterChipProps = $props();

let open = $state(false);
let triggerEl = $state<HTMLButtonElement | null>(null);

function toggle() {
	open = !open;
}

function pick(next: typeof ANNOTATION_FILTER_VALUES[number]) {
	onchange(next);
	open = false;
	triggerEl?.focus();
}

function onDocumentClick(event: MouseEvent) {
	if (!open) return;
	const target = event.target;
	if (!(target instanceof Node)) return;
	if (triggerEl?.contains(target)) return;
	open = false;
}

function onKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && open) {
		open = false;
		triggerEl?.focus();
	}
}
</script>

<svelte:document onclick={onDocumentClick} onkeydown={onKeyDown} />

<div class="chip-host" data-testid="annotation-filter-chip">
	<button
		type="button"
		class="chip"
		bind:this={triggerEl}
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		data-testid="annotation-filter-trigger"
	>
		<span class="chip-eyebrow">Show:</span>
		<span class="chip-label">{ANNOTATION_FILTER_LABELS[value]}</span>
		<span class="chevron" aria-hidden="true">▾</span>
	</button>
	{#if open}
		<div class="menu" role="menu" data-testid="annotation-filter-menu">
			{#each ANNOTATION_FILTER_VALUES as opt (opt)}
				<button
					type="button"
					class="menu-item"
					class:active={opt === value}
					role="menuitemradio"
					aria-checked={opt === value}
					data-testid="annotation-filter-option-{opt}"
					onclick={() => pick(opt)}
				>
					{ANNOTATION_FILTER_LABELS[opt]}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.chip-host {
		position: relative;
		display: inline-block;
	}

	.chip {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-xs);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: inherit;
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.chip:hover,
	.chip:focus-visible {
		background: var(--surface-sunken);
	}

	.chip-eyebrow {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.chevron {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}

	.menu {
		position: absolute;
		top: calc(100% + var(--space-3xs));
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: var(--space-3xs);
		background: var(--surface-overlay);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		min-width: 12rem;
		z-index: var(--z-popover);
	}

	.menu-item {
		appearance: none;
		text-align: left;
		padding: var(--space-2xs) var(--space-xs);
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.menu-item:hover,
	.menu-item:focus-visible {
		background: var(--surface-sunken);
	}

	.menu-item.active {
		background: var(--surface-sunken);
		color: var(--ink-strong);
	}
</style>

<!--
@component
Number `?` popover for dashboard / Insights tiles
(study-app-ia-cleanup Phase 3, deferred from Phase 1).

Renders a numeric value plus a small `?` button. Clicking the button
opens an inline popover with the formula / explanation and an optional
deep link to the relevant glossary entry. Mirrors the Tooltip primitive's
hover / focus / Esc behaviour so keyboard and pointer users get parity.

Triggered by click (not hover) because the popover content is
substantive enough that a hover-show would feel grabby; spec Q10 chose
"hover tooltip + `?` popover" -- this is the popover half. For terms,
use `<Tooltip>`; for metrics where the user might want the formula,
use this.
-->
<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	/** The metric label rendered next to the value. */
	label: string;
	/** Pre-formatted numeric value (the caller decides units / formatting). */
	value: string;
	/** One-line explanation of the metric. Always rendered when the popover opens. */
	short: string;
	/** Optional formula or extended detail. Rendered below the short explanation. */
	formula?: string;
	/**
	 * Glossary key for "Learn more" deep link. Set when the metric has a
	 * canonical glossary entry; the popover renders an anchor to
	 * `/reference/glossary#{key}` so the learner can jump to the long-form.
	 * Caller composes the href via `glossaryHref` so this component stays
	 * route-agnostic (libs/ui leaf rule).
	 */
	glossaryHref?: string;
	/** Pre-rendered snippet for richer popover bodies. Replaces `short` + `formula` when present. */
	body?: Snippet;
	/** Optional testid prefix (defaults to `metric-explainer`). */
	testidPrefix?: string;
}

const { label, value, short, formula, glossaryHref, body, testidPrefix = 'metric-explainer' }: Props = $props();

let open = $state(false);
let triggerEl = $state<HTMLButtonElement | null>(null);
// Per-instance id: `$props.id()` guarantees uniqueness even when the same
// metric label renders twice on a page (a per-row tile and a summary tile). A
// label-derived id produced a duplicate `role="dialog"` `id`, so the trigger's
// `aria-controls` was ambiguous. Matches Select / TextField.
const instanceId = $props.id();
const popoverId = `metric-explainer-${instanceId}`;

function handleToggle() {
	open = !open;
}

function handleClose() {
	open = false;
}

function handleKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && open) {
		open = false;
		triggerEl?.focus();
	}
}

// Document-scoped pointerdown listener: close on click outside.
$effect(() => {
	if (!open) return;
	function handleOutside(event: PointerEvent) {
		if (triggerEl !== null && event.target instanceof Node && triggerEl.contains(event.target)) return;
		// Allow clicks inside the popover (target inside the host span)
		// to remain non-dismissive; the popover is rendered as a sibling
		// of the trigger so we check against the same wrapper.
		const host = triggerEl?.parentElement;
		if (host !== null && host !== undefined && event.target instanceof Node && host.contains(event.target)) return;
		open = false;
	}
	document.addEventListener('pointerdown', handleOutside, true);
	return () => document.removeEventListener('pointerdown', handleOutside, true);
});
</script>

<!--
	The host span is a non-interactive group that delegates focus / click
	to the inner trigger button. Esc-handling is wired here so the
	keyboard shortcut works regardless of which descendant has focus.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<span class="metric" onkeydown={handleKey} role="group">
	<span class="label" data-testid={`${testidPrefix}-label`}>{label}</span>
	<span class="value" data-testid={`${testidPrefix}-value`}>{value}</span>
	<button
		type="button"
		bind:this={triggerEl}
		class="trigger"
		aria-label={`What is ${label}?`}
		aria-expanded={open}
		aria-controls={popoverId}
		data-testid={`${testidPrefix}-trigger`}
		onclick={handleToggle}
	>?</button>
	{#if open}
		<span id={popoverId} role="dialog" class="popover" data-testid={`${testidPrefix}-popover`}>
			{#if body}
				{@render body()}
			{:else}
				<p class="short">{short}</p>
				{#if formula}
					<p class="formula"><code>{formula}</code></p>
				{/if}
			{/if}
			{#if glossaryHref}
				<a class="learn-more" href={glossaryHref} onclick={handleClose}>Learn more in the glossary →</a>
			{/if}
		</span>
	{/if}
</span>

<style>
	.metric {
		position: relative;
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2xs);
	}

	.label {
		color: var(--ink-muted);
	}

	.value {
		font-variant-numeric: tabular-nums;
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-body);
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4em;
		height: 1.4em;
		padding: 0;
		margin-left: var(--space-2xs);
		border: 1px solid var(--edge-default);
		border-radius: 50%;
		background: var(--surface-panel);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		line-height: 1;
		cursor: pointer;
	}

	.trigger:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.popover {
		position: absolute;
		top: calc(100% + var(--space-2xs));
		left: 0;
		z-index: var(--z-popover);
		min-width: 18rem;
		max-width: 24rem;
		padding: var(--space-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		font-size: var(--type-ui-label-size);
		line-height: 1.5;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.short {
		margin: 0;
		color: var(--ink-body);
	}

	.formula {
		margin: 0;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}

	.learn-more {
		color: var(--action-default);
		text-decoration: underline;
		text-underline-offset: var(--underline-offset-2xs);
	}

	.learn-more:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>

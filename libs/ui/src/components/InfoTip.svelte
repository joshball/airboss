<script lang="ts">
/**
 * Inline info-tip: a small `?` trigger that reveals a popover containing a
 * short definition of the accompanying term plus an optional "Learn more"
 * link to a help page. Used across `/session/start` to de-mystify slice,
 * kind, reason-code, priority, and domain labels.
 *
 * Length budget: one to two short sentences. Anything longer belongs in a
 * full help page. The popover caps at 20rem height and scrolls overflow, but
 * that is a guardrail against accidents, not a design target.
 *
 * A11y choices:
 *   - Role is `dialog` + `aria-modal="false"` (not `tooltip`) because the
 *     popover contains interactive content (the "Learn more" link). WAI-ARIA
 *     forbids interactive content inside `tooltip`.
 *   - Trigger carries `aria-haspopup="dialog"` and `aria-expanded` and
 *     `aria-controls` so AT users know there's a disclosure they can open.
 *   - Escape and outside-click both close. Tab cycles focus inside the
 *     popover via the shared focus-trap.
 *   - On touch (pointer: coarse) hover doesn't open; click does. Desktop
 *     hover opens transiently; click pins.
 *
 * Positioning: initial placement is below-start of the trigger; the
 * component measures the popover post-mount and flips above or right-aligned
 * when it would overflow the viewport.
 */

import { helpRegistry } from '@ab/help';
import { tick } from 'svelte';
import { page } from '$app/state';
import { createFocusTrap } from '../lib/focus-trap';

let {
	term,
	definition,
	helpId,
	helpSection,
	label,
}: {
	/** The term being explained. Rendered next to the `?` as a visible or screen-reader label. */
	term: string;
	/** One- to two-sentence plain-English explanation. Rendered in the popover body. */
	definition: string;
	/** Optional target help-page id. When set, the popover renders a "Learn more" link. */
	helpId?: string;
	/** Optional section anchor within the help page. */
	helpSection?: string;
	/** Custom accessible label override for the trigger. Defaults to `Learn more about ${term}`. */
	label?: string;
} = $props();

let open = $state(false);
/** True once the user pinned the popover by clicking. Suppresses hover-close. */
let pinned = $state(false);
let triggerEl = $state<HTMLButtonElement | null>(null);
let popoverEl = $state<HTMLDivElement | null>(null);
let flipY = $state(false);
let flipX = $state(false);

const popoverId = $derived(`infotip-${term.replace(/\s+/g, '-').toLowerCase()}`);
const titleId = $derived(`${popoverId}-title`);

const learnMoreHref = $derived.by<string | null>(() => {
	if (!helpId) return null;
	const base = `/help/${encodeURIComponent(helpId)}`;
	return helpSection ? `${base}#${encodeURIComponent(helpSection)}` : base;
});

const triggerLabel = $derived(label ?? `Learn more about ${term}`);

$effect(() => {
	if (!helpId) return;
	if (!import.meta.env.DEV) return;
	if (helpRegistry.getById(helpId) === undefined) {
		// biome-ignore lint/suspicious/noConsole: dev-only authoring guard
		console.warn(`InfoTip: no help page registered for id '${helpId}' (term='${term}').`);
	}
});

async function show(fromClick: boolean): Promise<void> {
	open = true;
	if (fromClick) pinned = true;
	await tick();
	measureFlip();
	if (fromClick) {
		const first = popoverEl?.querySelector<HTMLElement>('a, button');
		first?.focus();
	}
}

function hide(): void {
	open = false;
	pinned = false;
	flipX = false;
	flipY = false;
}

function measureFlip(): void {
	if (typeof window === 'undefined' || !popoverEl) return;
	const rect = popoverEl.getBoundingClientRect();
	const margin = 8;
	flipY = rect.bottom > window.innerHeight - margin && rect.top > rect.height + margin;
	flipX = rect.right > window.innerWidth - margin;
}

function handlePointerEnter(): void {
	// Don't preempt a pinned popover with hover state.
	if (pinned) return;
	void show(false);
}

function handlePointerLeave(): void {
	if (pinned) return;
	hide();
}

function handleClick(event: MouseEvent): void {
	event.stopPropagation();
	if (open && pinned) {
		hide();
		triggerEl?.focus();
		return;
	}
	void show(true);
}

function handleTriggerKeyDown(event: KeyboardEvent): void {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		if (open && pinned) {
			hide();
		} else {
			void show(true);
		}
	}
}

function handlePopoverKeyDown(event: KeyboardEvent): void {
	if (!popoverEl) return;
	const trap = createFocusTrap(popoverEl, {
		onEscape: () => {
			hide();
			triggerEl?.focus();
		},
	});
	trap.handleKeyDown(event);
}

function handleDocumentPointerDown(event: PointerEvent): void {
	if (!open || !pinned) return;
	const target = event.target as Node | null;
	if (!target) return;
	if (popoverEl?.contains(target)) return;
	if (triggerEl?.contains(target)) return;
	hide();
}

$effect(() => {
	if (!open || !pinned) return;
	document.addEventListener('pointerdown', handleDocumentPointerDown, true);
	window.addEventListener('resize', measureFlip);
	window.addEventListener('scroll', measureFlip, { passive: true });
	return () => {
		document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
		window.removeEventListener('resize', measureFlip);
		window.removeEventListener('scroll', measureFlip);
	};
});

// Hide when the user navigates away. `page.url.pathname` is reactive.
$effect(() => {
	// Read the pathname so the effect subscribes. Value is not otherwise used.
	void page.url.pathname;
	if (open) hide();
});
</script>

<span class="infotip">
	<button
		bind:this={triggerEl}
		type="button"
		class="trigger"
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls={popoverId}
		aria-label={triggerLabel}
		title={triggerLabel}
		onclick={handleClick}
		onkeydown={handleTriggerKeyDown}
		onpointerenter={handlePointerEnter}
		onpointerleave={handlePointerLeave}
		onfocus={() => void show(false)}
		onblur={() => {
			if (!pinned) hide();
		}}
	>
		<span aria-hidden="true">?</span>
	</button>
	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={popoverEl}
			id={popoverId}
			class="popover"
			class:flip-y={flipY}
			class:flip-x={flipX}
			role="dialog"
			aria-modal="false"
			aria-labelledby={titleId}
			tabindex="-1"
			onkeydown={handlePopoverKeyDown}
			onpointerenter={handlePointerEnter}
			onpointerleave={handlePointerLeave}
		>
			<div class="title" id={titleId}>{term}</div>
			<p class="body">{definition}</p>
			{#if learnMoreHref}
				<a class="learn-more" href={learnMoreHref}>Learn more</a>
			{/if}
		</div>
	{/if}
</span>

<style>
	.infotip {
		position: relative;
		display: inline-flex;
		align-items: center;
		vertical-align: baseline;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.125rem;
		height: 1.125rem;
		margin-left: var(--space-2xs);
		padding: 0;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		line-height: 1;
		cursor: help;
		transition:
			color var(--motion-fast),
			border-color var(--motion-fast),
			background var(--motion-fast);
	}

	.trigger:hover,
	.trigger[aria-expanded='true'] {
		color: var(--ink-body);
		border-color: var(--edge-strong);
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
		max-width: 18rem;
		min-width: 14rem;
		max-height: 20rem;
		overflow-y: auto;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		color: var(--ink-body);
		font-size: var(--font-size-sm);
		line-height: var(--line-height-normal);
		z-index: var(--z-popover);
		/* Transition respects reduced-motion via the token. */
		transition: opacity var(--motion-normal);
	}

	.popover.flip-y {
		top: auto;
		bottom: calc(100% + var(--space-2xs));
	}

	.popover.flip-x {
		left: auto;
		right: 0;
	}

	.title {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-2xs);
		color: var(--ink-body);
	}

	.body {
		margin: 0;
		color: var(--ink-muted);
	}

	.learn-more {
		display: inline-block;
		margin-top: var(--space-xs);
		color: var(--action-default);
		text-decoration: none;
		font-weight: var(--font-weight-medium);
	}

	.learn-more:hover {
		text-decoration: underline;
	}

	.learn-more:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	@media (hover: none) {
		.trigger {
			cursor: pointer;
		}
	}
</style>

<script lang="ts">
/**
 * Inline info-tip: a small `?` trigger that reveals a popover containing a
 * short definition of the accompanying term plus an optional "Learn more"
 * link to a help page. Used across `/session/start` to de-mystify slice,
 * kind, reason-code, priority, and domain labels.
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
		margin-left: var(--ab-space-2xs);
		padding: 0;
		border: 1px solid var(--ab-color-border);
		border-radius: 999px;
		background: transparent;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-semibold);
		line-height: 1;
		cursor: help;
		transition:
			color var(--ab-transition-fast),
			border-color var(--ab-transition-fast),
			background var(--ab-transition-fast);
	}

	.trigger:hover,
	.trigger[aria-expanded='true'] {
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
		background: var(--ab-color-surface-sunken);
	}

	.trigger:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
	}

	.popover {
		position: absolute;
		top: calc(100% + var(--ab-space-2xs));
		left: 0;
		max-width: 18rem;
		min-width: 14rem;
		padding: var(--ab-space-sm) var(--ab-space-md);
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		box-shadow: var(--ab-shadow-lg);
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-sm);
		line-height: var(--ab-line-height-normal);
		z-index: 50;
		/* Transition respects reduced-motion via the token. */
		transition: opacity var(--ab-transition-normal);
	}

	.popover.flip-y {
		top: auto;
		bottom: calc(100% + var(--ab-space-2xs));
	}

	.popover.flip-x {
		left: auto;
		right: 0;
	}

	.title {
		font-weight: var(--ab-font-weight-semibold);
		margin-bottom: var(--ab-space-2xs);
		color: var(--ab-color-fg);
	}

	.body {
		margin: 0;
		color: var(--ab-color-fg-muted);
	}

	.learn-more {
		display: inline-block;
		margin-top: var(--ab-space-xs);
		color: var(--ab-color-primary);
		text-decoration: none;
		font-weight: var(--ab-font-weight-medium);
	}

	.learn-more:hover {
		text-decoration: underline;
	}

	.learn-more:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
		border-radius: var(--ab-radius-sm);
	}

	@media (hover: none) {
		.trigger {
			cursor: pointer;
		}
	}
</style>

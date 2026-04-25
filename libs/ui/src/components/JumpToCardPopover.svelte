<script lang="ts">
/**
 * Popover for jumping to a specific position in a memory-review session.
 *
 * Lists cards by 1-based position only -- never front/back -- so the
 * affordance is a navigation aid, not a content leak. A small status badge
 * per row tells the learner where they have been (`rated` / `pending` /
 * `current`) without revealing the card itself.
 *
 * Controlled component: parent owns `open` and the `currentIndex`. Picking
 * a row calls `onPick(index)`; the parent submits the form action that
 * writes the session row and re-renders. The component does no I/O.
 *
 * A11y: dialog role + aria-label, ESC closes, scrim click closes,
 * focus-trap keeps Tab inside, Arrow Up/Down moves between rows, Enter
 * activates the focused row. Mirrors `SharePopover` and
 * `SnoozeReasonPopover`.
 */

import { createFocusTrap } from '../lib/focus-trap';

export type JumpCardStatus = 'rated' | 'pending' | 'current';

let {
	open = $bindable(false),
	totalCards,
	currentIndex,
	statuses,
	onPick,
	onClose,
}: {
	open?: boolean;
	totalCards: number;
	/** 0-based current index. */
	currentIndex: number;
	/** Same length as `totalCards`; `'current'` is enforced for `currentIndex`. */
	statuses: readonly JumpCardStatus[];
	/** Called with the picked 0-based index. Parent owns the navigation. */
	onPick: (index: number) => void;
	onClose?: () => void;
} = $props();

let panelEl = $state<HTMLDivElement | null>(null);
let listEl = $state<HTMLDivElement | null>(null);

const STATUS_LABELS: Record<JumpCardStatus, string> = {
	rated: 'Rated',
	pending: 'Pending',
	current: 'Current',
};

function close(): void {
	open = false;
	onClose?.();
}

function handleKeyDown(event: KeyboardEvent): void {
	if (!panelEl) return;
	const trap = createFocusTrap(panelEl, { onEscape: close });
	trap.handleKeyDown(event);

	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		const buttons = listEl?.querySelectorAll<HTMLButtonElement>('button[data-jump-row]');
		if (!buttons || buttons.length === 0) return;
		const active = document.activeElement as HTMLElement | null;
		const list = Array.from(buttons);
		const idx = active ? list.indexOf(active as HTMLButtonElement) : -1;
		const delta = event.key === 'ArrowDown' ? 1 : -1;
		const next = idx === -1 ? (delta === 1 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length;
		event.preventDefault();
		list[next]?.focus();
	}
}

function handleScrim(event: PointerEvent): void {
	if (event.target === event.currentTarget) close();
}

function pick(index: number): void {
	onPick(index);
	close();
}

$effect(() => {
	if (!open) return;
	queueMicrotask(() => {
		const target = listEl?.querySelector<HTMLButtonElement>(`button[data-jump-row="${currentIndex}"]`);
		(target ?? listEl?.querySelector<HTMLButtonElement>('button[data-jump-row]'))?.focus();
	});
});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="scrim" onpointerdown={handleScrim} onkeydown={handleKeyDown}>
		<div
			bind:this={panelEl}
			class="panel"
			role="dialog"
			aria-modal="true"
			aria-label="Jump to card in session"
		>
			<header class="hd">
				<h2>Jump to card</h2>
				<button type="button" class="close" aria-label="Close" onclick={close}>&times;</button>
			</header>

			<p class="sub">Pick a position. Skipped cards stay pending; come back to them anytime.</p>

			<div class="list" bind:this={listEl} role="listbox" aria-label="Card positions">
				{#each Array.from({ length: totalCards }, (_, i) => i) as index (index)}
					{@const status = index === currentIndex ? 'current' : (statuses[index] ?? 'pending')}
					<button
						type="button"
						class="row row-{status}"
						class:is-current={status === 'current'}
						data-jump-row={index}
						role="option"
						aria-selected={index === currentIndex}
						onclick={() => pick(index)}
					>
						<span class="row-pos">Card {index + 1}</span>
						<span class="row-status">{STATUS_LABELS[status]}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: var(--dialog-scrim);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal);
	}

	.panel {
		background: var(--surface-panel, var(--ink-inverse));
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-xl);
		min-width: min(24rem, 92vw);
		max-width: 28rem;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.2));
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.hd h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.close {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		font-size: var(--font-size-xl);
		line-height: 1;
		cursor: pointer;
		padding: var(--space-2xs) var(--space-sm);
	}

	.close:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
		border-radius: var(--radius-sm);
	}

	.sub {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		overflow-y: auto;
		padding: var(--space-2xs);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
		color: var(--ink-body);
		cursor: pointer;
		font: inherit;
	}

	.row:hover {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.row:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.row-pos {
		font-weight: 600;
	}

	.row-status {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.row-rated {
		color: var(--ink-muted);
	}

	.row-rated .row-status {
		color: var(--signal-success, var(--action-default-hover));
	}

	.row-pending .row-status {
		color: var(--ink-faint);
	}

	.row.is-current {
		border-color: var(--action-default);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
	}

	.row.is-current .row-status {
		color: var(--action-default-hover);
		font-weight: 600;
	}
</style>

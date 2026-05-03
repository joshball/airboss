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
 * Chrome / a11y: built on the shared `Dialog` primitive (canonical close
 * glyph, focus trap, ESC + scrim close, focus return). Listbox roving
 * tabindex via Arrow Up/Down is implemented locally; Enter activates the
 * focused row.
 */

import { tick } from 'svelte';
import Dialog from './Dialog.svelte';

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

function rovingMove(delta: number): void {
	const buttons = listEl?.querySelectorAll<HTMLButtonElement>('button[data-jump-row]');
	if (!buttons || buttons.length === 0) return;
	const active = document.activeElement as HTMLElement | null;
	const list = Array.from(buttons);
	const idx = active ? list.indexOf(active as HTMLButtonElement) : -1;
	const next = idx === -1 ? (delta === 1 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length;
	list[next]?.focus();
}

function handleListKeyDown(event: KeyboardEvent): void {
	switch (event.key) {
		case 'ArrowDown':
			event.preventDefault();
			rovingMove(1);
			break;
		case 'ArrowUp':
			event.preventDefault();
			rovingMove(-1);
			break;
		case 'Home': {
			event.preventDefault();
			listEl?.querySelector<HTMLButtonElement>('button[data-jump-row="0"]')?.focus();
			break;
		}
		case 'End': {
			event.preventDefault();
			const last = listEl?.querySelector<HTMLButtonElement>(`button[data-jump-row="${totalCards - 1}"]`);
			last?.focus();
			break;
		}
	}
}

function pick(index: number): void {
	onPick(index);
	close();
}

$effect(() => {
	if (!open) return;
	void tick().then(() => {
		const target = listEl?.querySelector<HTMLButtonElement>(`button[data-jump-row="${currentIndex}"]`);
		(target ?? listEl?.querySelector<HTMLButtonElement>('button[data-jump-row]'))?.focus();
	});
});
</script>

<Dialog
	bind:open
	ariaLabel="Jump to card in session"
	size="sm"
	onClose={close}
>
	{#snippet header()}
		<h2 data-testid="jumptocardpopover-title">Jump to card</h2>
	{/snippet}

	{#snippet body()}
		<span data-testid="jumptocardpopover-root" class="visually-hidden"></span>
		<p class="sub">Pick a position. Skipped cards stay pending; come back to them anytime.</p>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="list"
			bind:this={listEl}
			role="listbox"
			tabindex="-1"
			aria-label="Card positions"
			aria-activedescendant={`jumptocard-row-${currentIndex}`}
			data-testid="jumptocardpopover-list"
			onkeydown={handleListKeyDown}
		>
			{#each Array.from({ length: totalCards }, (_, i) => i) as index (index)}
				{@const status = index === currentIndex ? 'current' : (statuses[index] ?? 'pending')}
				<button
					type="button"
					id={`jumptocard-row-${index}`}
					class="row row-{status}"
					class:is-current={status === 'current'}
					data-jump-row={index}
					data-testid={`jumptocardpopover-item-${index}`}
					data-state={status}
					role="option"
					aria-selected={index === currentIndex}
					tabindex={index === currentIndex ? 0 : -1}
					onclick={() => pick(index)}
				>
					<span class="row-pos">Card {index + 1}</span>
					<span class="row-status">{STATUS_LABELS[status]}</span>
				</button>
			{/each}
		</div>
	{/snippet}
</Dialog>

<style>
	h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.sub {
		margin: 0 0 var(--space-md);
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		overflow-y: auto;
		padding: var(--space-2xs);
		max-height: 60vh;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		cursor: pointer;
		font: inherit;
	}

	.row:hover {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.row:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.row-pos {
		font-weight: 600;
	}

	/*
	 * Row status colors are driven by a single CSS custom property set on
	 * each row variant. Avoids a tangled cascade where (rated | pending |
	 * current) each clobber the .row-status color in different rules.
	 */
	.row {
		--row-status-color: var(--ink-subtle);
	}

	.row-rated {
		--row-status-color: var(--signal-success, var(--action-default-hover));
		color: var(--ink-muted);
	}

	.row-pending {
		--row-status-color: var(--ink-faint);
	}

	.row.is-current {
		--row-status-color: var(--action-default-hover);
		border-color: var(--action-default);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
	}

	.row-status {
		font-size: var(--font-size-xs);
		/* lint-disable-token-enforcement: --row-status-color is a component-local custom property, not a theme token */
		color: var(--row-status-color);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.row.is-current .row-status {
		font-weight: 600;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>

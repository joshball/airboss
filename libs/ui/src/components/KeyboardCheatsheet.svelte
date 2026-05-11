<script lang="ts" module>
/**
 * `<KeyboardCheatsheet>` -- modal overlay listing the keyboard shortcuts
 * available on the current page. Triggered by `?` in any page that
 * mounts a keyboard handler with a cheatsheet. Generic shape: caller
 * supplies an array of `{ key, description }` items grouped by section.
 *
 * Built on top of `<Drawer>`-style focus trap is overkill for a static
 * read-only overlay; a `<dialog>` element with native modal semantics
 * is enough. Esc closes; click on the backdrop closes.
 */

export interface KeyboardShortcutEntry {
	readonly key: string;
	readonly description: string;
}

export interface KeyboardShortcutGroup {
	readonly title: string;
	readonly entries: ReadonlyArray<KeyboardShortcutEntry>;
}

export interface KeyboardCheatsheetProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly groups: ReadonlyArray<KeyboardShortcutGroup>;
}
</script>

<script lang="ts">
let { open, onClose, groups }: KeyboardCheatsheetProps = $props();

let dialog = $state<HTMLDialogElement | null>(null);

$effect(() => {
	if (!dialog) return;
	if (open && !dialog.open) {
		dialog.showModal();
	} else if (!open && dialog.open) {
		dialog.close();
	}
});

function handleClose() {
	onClose();
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === dialog) {
		onClose();
	}
}
</script>

<dialog bind:this={dialog} class="cheatsheet" onclose={handleClose} onclick={handleBackdropClick}>
	<div class="panel">
		<header class="head">
			<h2>Keyboard shortcuts</h2>
			<button type="button" class="close" onclick={onClose} aria-label="Close keyboard shortcuts">×</button>
		</header>
		<div class="groups">
			{#each groups as group (group.title)}
				<section class="group">
					<h3>{group.title}</h3>
					<dl>
						{#each group.entries as entry (entry.key)}
							<div class="row">
								<dt><kbd>{entry.key}</kbd></dt>
								<dd>{entry.description}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}
		</div>
	</div>
</dialog>

<style>
	dialog.cheatsheet {
		padding: 0;
		border: 0;
		background: transparent;
		max-width: 36rem;
		width: 90vw;
	}

	dialog.cheatsheet::backdrop {
		background: var(--overlay-scrim);
	}

	.panel {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		max-height: 80vh;
		overflow-y: auto;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--edge-default);
		padding-bottom: var(--space-sm);
	}

	.head h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-strong);
	}

	.close {
		background: transparent;
		border: 0;
		font-size: var(--font-size-2xl);
		color: var(--ink-muted);
		cursor: pointer;
		padding: 0 var(--space-xs);
		line-height: 1;
	}

	.close:hover,
	.close:focus-visible {
		color: var(--ink-strong);
	}

	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.group h3 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-weight: var(--font-weight-medium);
	}

	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.row {
		display: grid;
		grid-template-columns: 6rem 1fr;
		align-items: baseline;
		gap: var(--space-sm);
	}

	dt {
		margin: 0;
	}

	dd {
		margin: 0;
		color: var(--ink-body);
	}

	kbd {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-strong);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		padding: var(--space-3xs) var(--space-xs);
		color: var(--ink-body);
		white-space: nowrap;
	}
</style>

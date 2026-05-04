<script lang="ts" module>
export interface FileTreeFileNode {
	readonly type: 'file';
	readonly path: string;
	readonly name: string;
}

export interface FileTreeDirNode {
	readonly type: 'dir';
	readonly path: string;
	readonly name: string;
	readonly children: ReadonlyArray<FileTreeNode>;
}

export type FileTreeNode = FileTreeFileNode | FileTreeDirNode;
</script>

<script lang="ts">
/**
 * Generic collapsible directory tree. Renders a nested `<ul>` of
 * `FileTreeNode` shapes (files + directories). The active file (if any) is
 * styled distinctly via `aria-current="page"`.
 *
 * Semantics: this is a nested list of links + toggle buttons, NOT a
 * WAI-ARIA tree. Native list semantics (Tab through links/buttons) work
 * for keyboard-only users without the cost of a full tree-pattern
 * implementation. If/when a real tree pattern is wanted (single roving
 * tabindex + Up/Down/Left/Right navigation between rows), the
 * implementation is a separate component.
 *
 * Open / closed directory state persists via `localStorage` keyed by
 * `storageKey + ':' + dir.path`, so a reload remembers what the reader
 * was looking at. Server-rendered first paint shows everything closed
 * (no SSR hydration mismatch) -- the client `$effect` opens the persisted
 * dirs after mount AND merges the active file's ancestor chain so the
 * highlighted row is always visible.
 *
 * Anchors are real `<a href>` elements pointing at `hrefFor(node.path)`,
 * not button onclicks, so the tree works with middle-click "open in new
 * tab" and is keyboard-navigable via tab order.
 */

import { untrack } from 'svelte';

let {
	roots,
	activePath,
	hrefFor,
	storageKey,
}: {
	roots: ReadonlyArray<FileTreeNode>;
	activePath?: string | undefined;
	hrefFor: (repoRelPath: string) => string;
	/** Stable, namespaced key under which open-state is persisted in
	 * localStorage. Required so two trees in the same app cannot collide. */
	storageKey: string;
} = $props();

// `$state.raw` skips proxying for a Set whose identity changes on every
// mutation -- we already write a new Set on every toggle, so granular
// proxy tracking buys nothing and `O(visible-nodes)` `Set.has` calls per
// toggle add up on a 577-dir tree.
let openDirs = $state.raw<ReadonlySet<string>>(new Set());
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Build the active-path ancestor chain ("docs", "docs/work", ...) */
function ancestorChain(path: string | undefined): ReadonlyArray<string> {
	if (!path) return [];
	const parts = path.split('/');
	const out: string[] = [];
	let prefix = '';
	for (let i = 0; i < parts.length - 1; i++) {
		prefix = prefix === '' ? (parts[i] ?? '') : `${prefix}/${parts[i]}`;
		if (prefix !== '') out.push(prefix);
	}
	return out;
}

// Mount-once: load the persisted open-set from localStorage.
$effect(() => {
	if (typeof window === 'undefined') return;
	const raw = window.localStorage.getItem(storageKey);
	if (raw) {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				const next = new Set<string>(parsed.filter((v): v is string => typeof v === 'string'));
				openDirs = next;
			}
		} catch {
			// ignore malformed value
		}
	}
});

// Whenever the active file changes, merge its ancestor chain into the
// open-set so the highlighted row is visible. Persist (debounced) so the
// merge survives reloads. Read-only on `openDirs` -- the merge is idempotent
// and only writes back when something actually changed.
$effect(() => {
	const chain = ancestorChain(activePath);
	if (chain.length === 0) return;
	untrack(() => {
		const current = openDirs;
		let changed = false;
		const next = new Set(current);
		for (const p of chain) {
			if (!next.has(p)) {
				next.add(p);
				changed = true;
			}
		}
		if (!changed) return;
		openDirs = next;
		schedulePersist(next);
	});
});

function schedulePersist(next: ReadonlySet<string>) {
	if (typeof window === 'undefined') return;
	if (persistTimer !== null) clearTimeout(persistTimer);
	const snapshot = [...next];
	persistTimer = setTimeout(() => {
		persistTimer = null;
		try {
			window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
		} catch {
			// localStorage may be disabled (private mode). non-fatal.
		}
	}, 100);
}

function toggleDir(path: string) {
	const next = new Set(openDirs);
	if (next.has(path)) next.delete(path);
	else next.add(path);
	openDirs = next;
	schedulePersist(next);
}

function isOpen(path: string): boolean {
	return openDirs.has(path);
}

$effect(() => {
	return () => {
		if (persistTimer !== null) clearTimeout(persistTimer);
	};
});
</script>

<ul class="tree-root">
	{#each roots as node (node.path)}
		{@render renderNode(node, 0)}
	{/each}
</ul>

{#snippet renderNode(node: FileTreeNode, depth: number)}
	{#if node.type === 'dir'}
		{@const open = isOpen(node.path)}
		<li class="tree-row">
			<button
				type="button"
				class="dir-toggle"
				style="padding-left: calc({depth} * var(--space-md) + var(--space-sm));"
				aria-expanded={open}
				onclick={() => toggleDir(node.path)}
			>
				<span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
				<span class="name">{node.name}</span>
			</button>
			{#if open}
				<ul class="tree-children">
					{#each node.children as child (child.path)}
						{@render renderNode(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		{@const isActive = activePath === node.path}
		<li class="tree-row">
			<a
				class="file-link"
				class:active={isActive}
				style="padding-left: calc({depth} * var(--space-md) + var(--space-md));"
				href={hrefFor(node.path)}
				aria-current={isActive ? 'page' : undefined}
			>
				<span class="name">{node.name}</span>
			</a>
		</li>
	{/if}
{/snippet}

<style>
	.tree-root,
	.tree-children {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.tree-row {
		margin: 0;
	}

	.dir-toggle,
	.file-link {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		width: 100%;
		text-align: left;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		background: transparent;
		border: 0;
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		cursor: pointer;
		text-decoration: none;
	}

	.dir-toggle:hover,
	.file-link:hover {
		background: var(--surface-sunken);
	}

	.dir-toggle:focus-visible,
	.file-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.file-link.active {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		font-weight: var(--type-ui-control-weight);
	}

	.chev {
		font-size: var(--type-ui-caption-size);
		width: 1ch;
		display: inline-block;
		color: var(--ink-muted);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

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
 * Generic collapsible directory tree. Renders a recursive `<ul>` of
 * `FileTreeNode` shapes (files + directories). The active file (if any) is
 * styled distinctly via `aria-current="page"`.
 *
 * Open / closed directory state persists via `localStorage` keyed by
 * `storageKey + ':' + dir.path`, so a reload remembers what the reader
 * was looking at. Server-rendered first paint shows everything closed
 * (no SSR hydration mismatch) -- the client `$effect` opens the persisted
 * dirs after mount.
 *
 * Anchors are real `<a href>` elements pointing at `hrefFor(node.path)`,
 * not button onclicks, so the tree works with middle-click "open in new
 * tab" and is keyboard-navigable via tab order.
 */

let {
	roots,
	activePath,
	hrefFor,
	storageKey = 'file-tree-open',
}: {
	roots: ReadonlyArray<FileTreeNode>;
	activePath?: string | undefined;
	hrefFor: (repoRelPath: string) => string;
	/** Stable key under which open-state is persisted in localStorage. */
	storageKey?: string;
} = $props();

let openDirs = $state<Set<string>>(new Set());

$effect(() => {
	if (typeof window === 'undefined') return;
	const raw = window.localStorage.getItem(storageKey);
	if (!raw) {
		// Default: expand the directory chain that contains the active file.
		if (activePath) {
			const parts = activePath.split('/');
			let prefix = '';
			const next = new Set<string>();
			for (let i = 0; i < parts.length - 1; i++) {
				prefix = prefix === '' ? parts[i] ?? '' : `${prefix}/${parts[i]}`;
				if (prefix !== '') next.add(prefix);
			}
			openDirs = next;
		}
		return;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			openDirs = new Set(parsed.filter((v): v is string => typeof v === 'string'));
		}
	} catch {
		// ignore malformed value
	}
});

function persist(next: Set<string>) {
	openDirs = next;
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(storageKey, JSON.stringify([...next]));
	} catch {
		// localStorage may be disabled (private mode). non-fatal.
	}
}

function toggleDir(path: string) {
	const next = new Set(openDirs);
	if (next.has(path)) next.delete(path);
	else next.add(path);
	persist(next);
}

function isOpen(path: string): boolean {
	return openDirs.has(path);
}
</script>

<ul class="tree-root" role="tree">
	{#each roots as node (node.path)}
		{@render renderNode(node, 0)}
	{/each}
</ul>

{#snippet renderNode(node: FileTreeNode, depth: number)}
	{#if node.type === 'dir'}
		{@const open = isOpen(node.path)}
		<li class="tree-row" role="treeitem" aria-expanded={open} aria-selected="false">
			<button
				type="button"
				class="dir-toggle"
				style="padding-left: calc({depth} * var(--space-md) + var(--space-xs));"
				aria-expanded={open}
				onclick={() => toggleDir(node.path)}
			>
				<span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
				<span class="name">{node.name}</span>
			</button>
			{#if open}
				<ul class="tree-children" role="group">
					{#each node.children as child (child.path)}
						{@render renderNode(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		{@const isActive = activePath === node.path}
		<li class="tree-row" role="treeitem" aria-selected={isActive}>
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

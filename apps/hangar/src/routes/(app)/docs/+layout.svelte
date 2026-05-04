<script lang="ts">
import { ROUTES } from '@ab/constants';
import FileTree, { type FileTreeNode } from '@ab/ui/components/FileTree.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import DocsSearchBox from '$lib/components/DocsSearchBox.svelte';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// `page.params.path` exists on `/docs/[...path]` -- strip a trailing slash
// and reuse it for the FileTree's active highlight.
const activePath = $derived<string | undefined>(
	typeof page.params.path === 'string' && page.params.path !== '' ? page.params.path : undefined,
);

const tree = $derived(data.tree as ReadonlyArray<FileTreeNode>);

function hrefFor(path: string): string {
	return ROUTES.HANGAR_DOCS_PATH(path);
}
</script>

<div class="docs-shell">
	<aside class="rail" aria-label="Docs file tree">
		<FileTree roots={tree} activePath={activePath} hrefFor={hrefFor} storageKey="hangar:docs:open-dirs" />
	</aside>
	<div class="main">
		<header class="topbar">
			<DocsSearchBox />
		</header>
		<div class="page-body">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.docs-shell {
		display: grid;
		grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr);
		gap: var(--space-lg);
		min-height: 70vh;
	}

	.rail {
		border-right: 1px solid var(--edge-default);
		padding: var(--space-md);
		overflow-y: auto;
		max-height: calc(100vh - 7rem);
		position: sticky;
		top: var(--space-lg);
	}

	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.topbar {
		display: flex;
		justify-content: flex-end;
	}

	.page-body {
		min-width: 0;
	}

	@media (max-width: 800px) {
		.docs-shell {
			grid-template-columns: 1fr;
		}

		.rail {
			border-right: 0;
			border-bottom: 1px solid var(--edge-default);
			max-height: 30vh;
			position: static;
		}
	}
</style>

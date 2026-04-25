<script lang="ts">
import type { MdNode } from '@ab/help';
import MarkdownBody from '@ab/help/ui/MarkdownBody.svelte';

/**
 * Full-fidelity Markdown preview for files inside a source's data directory.
 * The on-disk text is parsed server-side (`parseMarkdown` is async because it
 * calls Shiki for code-block highlighting) and the resulting AST is handed
 * to the same `<MarkdownBody>` primitive the help pages use, so the preview
 * matches the rendered help surface exactly.
 *
 * See docs/work-packages/hangar-sources-v1/spec.md sources-v1 polish
 * (deferred #2: full-fidelity preview components).
 */

let {
	fileName,
	fileSizeBytes,
	nodes,
}: {
	fileName: string;
	fileSizeBytes: number;
	nodes: MdNode[];
} = $props();

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || bytes <= 0) return '--';
	const units = ['B', 'KiB', 'MiB', 'GiB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
</script>

<section class="preview-markdown" aria-label="Markdown preview">
	<header class="hd">
		<span class="mono name">{fileName}</span>
		<span class="size mono">{formatBytes(fileSizeBytes)}</span>
	</header>
	<div class="body">
		<MarkdownBody {nodes} />
	</div>
</section>

<style>
	.preview-markdown {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.hd {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		align-items: baseline;
		padding-bottom: var(--space-xs);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.name {
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		flex: 1;
		min-width: 0;
		word-break: break-all;
	}

	.size {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.body {
		max-height: 36rem;
		overflow: auto;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-page);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>

<script lang="ts">
import { ROUTES } from '@ab/constants';

/**
 * Inline PDF preview for files inside a source's data directory. Embeds the
 * raw bytes via `<object>` so the browser's native viewer paints the first
 * page; we layer a header strip that surfaces the file name + size + a
 * fallback "open in new tab" link for browsers that decline to embed PDFs.
 *
 * See docs/work-packages/hangar-sources-v1/spec.md sources-v1 polish
 * (deferred #2: full-fidelity preview components).
 */

let {
	sourceId,
	fileName,
	fileSizeBytes,
}: {
	sourceId: string;
	fileName: string;
	fileSizeBytes: number;
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

const fileUrl = $derived(ROUTES.HANGAR_SOURCE_FILE_RAW(sourceId, fileName));
const objectAriaLabel = $derived(`PDF preview: ${fileName}`);
</script>

<section class="preview-pdf" aria-label="PDF preview">
	<header class="hd">
		<span class="mono name">{fileName}</span>
		<span class="size mono">{formatBytes(fileSizeBytes)}</span>
		<a class="open-link" href={fileUrl} target="_blank" rel="noreferrer">Open in new tab</a>
	</header>
	<object data={fileUrl} type="application/pdf" aria-label={objectAriaLabel} class="frame">
		<p class="fallback">
			Browser declined to embed this PDF.
			<a href={fileUrl} target="_blank" rel="noreferrer">Open <span class="mono">{fileName}</span> in a new tab.</a>
		</p>
	</object>
</section>

<style>
	.preview-pdf {
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

	.open-link {
		color: var(--link-default);
		text-decoration: none;
		font-size: var(--type-ui-caption-size);
	}

	.open-link:hover {
		text-decoration: underline;
	}

	.frame {
		display: block;
		width: 100%;
		height: 36rem;
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
	}

	.fallback {
		margin: 0;
		padding: var(--space-md);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.fallback a {
		color: var(--link-default);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>

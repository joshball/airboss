<script lang="ts">
import { ROUTES } from '@ab/constants';

/**
 * Inline JPEG preview for files inside a binary-visual source directory. Today
 * the only authored JPEG on disk is the ingest-generated thumbnail, served
 * from `ROUTES.HANGAR_SOURCE_THUMBNAIL`; the tile reuses that route so no new
 * arbitrary-file endpoint is needed. Sized against SECTIONAL_THUMBNAIL for
 * layout stability.
 *
 * See docs/work-packages/hangar-non-textual/design.md Preview dispatcher.
 */

let {
	sourceId,
	fileName,
	fileSizeBytes,
	altText,
}: {
	sourceId: string;
	fileName: string;
	fileSizeBytes: number;
	altText?: string;
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

const imgAlt = $derived(altText ?? `${fileName} preview`);
</script>

<figure class="preview-jpeg" aria-label="JPEG preview">
	<img src={ROUTES.HANGAR_SOURCE_THUMBNAIL(sourceId)} alt={imgAlt} />
	<figcaption class="caption">
		<span class="mono">{fileName}</span>
		<span class="size mono">{formatBytes(fileSizeBytes)}</span>
	</figcaption>
</figure>

<style>
	.preview-jpeg {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.preview-jpeg img {
		display: block;
		max-width: 100%;
		max-height: 24rem;
		width: auto;
		height: auto;
		object-fit: contain;
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
	}

	.caption {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.size {
		color: var(--ink-muted);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>

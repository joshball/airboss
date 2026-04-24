<script lang="ts">
import type { SourceEdition, SourceMedia } from '@ab/aviation';
import { ROUTES } from '@ab/constants';

/**
 * Dedicated preview for GeoTIFF rasters. There is no inline-render path for a
 * TIFF in the browser; the detail page shows the thumbnail generated at ingest
 * time and surfaces edition + archive metadata so an operator can confirm the
 * right vintage is on disk without streaming the full chart.
 *
 * See docs/work-packages/hangar-non-textual/design.md Preview dispatcher.
 */

let {
	sourceId,
	fileName,
	fileSizeBytes,
	media,
	edition,
}: {
	sourceId: string;
	fileName: string;
	fileSizeBytes: number;
	media: SourceMedia | null;
	edition: SourceEdition | null;
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

const editionLabel = $derived(
	edition ? `${edition.effectiveDate}${edition.editionNumber ? ` (#${edition.editionNumber})` : ''}` : '--',
);

const thumbnailAvailable = $derived(
	media !== null && media.thumbnailSizeBytes > 0 && media.generator !== 'unavailable',
);

const altText = $derived(edition ? `${fileName} - edition ${edition.effectiveDate}` : `${fileName} - preview`);
</script>

<section class="preview-geotiff" aria-label="GeoTIFF preview">
	<div class="thumb" aria-hidden={!thumbnailAvailable}>
		{#if thumbnailAvailable}
			<img src={ROUTES.HANGAR_SOURCE_THUMBNAIL(sourceId)} alt={altText} />
		{:else}
			<div class="thumb-unavailable">
				<p class="unavailable-label">Thumbnail unavailable</p>
				<p class="unavailable-hint">Install <code>gdal_translate</code> (or run on macOS) and re-fetch.</p>
			</div>
		{/if}
	</div>
	<dl class="meta">
		<div>
			<dt>File</dt>
			<dd class="mono">{fileName}</dd>
		</div>
		<div>
			<dt>Size</dt>
			<dd class="mono">{formatBytes(fileSizeBytes)}</dd>
		</div>
		<div>
			<dt>Edition</dt>
			<dd>{editionLabel}</dd>
		</div>
	</dl>
</section>

<style>
	.preview-geotiff {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-lg);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.thumb {
		display: block;
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface-sunken);
	}

	.thumb img {
		display: block;
		width: 256px;
		height: 192px;
		object-fit: cover;
	}

	.thumb-unavailable {
		width: 256px;
		height: 192px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-md);
		text-align: center;
		color: var(--ink-muted);
	}

	.unavailable-label {
		margin: 0;
		font-weight: var(--font-weight-semibold);
	}

	.unavailable-hint {
		margin: 0;
		font-size: var(--type-ui-caption-size);
	}

	.unavailable-hint code {
		font-family: var(--font-family-mono);
		background: var(--surface-panel);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
	}

	.meta {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.meta > div {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: var(--space-md);
		padding: var(--space-xs) 0;
		border-bottom: 1px solid var(--edge-subtle);
	}

	.meta > div:last-child {
		border-bottom: none;
	}

	.meta dt {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.meta dd {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		word-break: break-word;
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>

<script lang="ts">
import { ROUTES } from '@ab/constants';

/**
 * Preview tile for binary-visual sources. Renders inline when the row's
 * `media.thumbnailPath` is populated; clicking the thumbnail streams the
 * full archive with `content-disposition: attachment`.
 *
 * Role-token styled per the wp-hangar-non-textual theme checklist; no hex.
 */

let {
	sourceId,
	title,
	thumbnailUrl,
	thumbnailAvailable,
	edition,
	archiveSizeBytes,
	archiveSha,
	downloadedAt,
	generator,
}: {
	sourceId: string;
	title: string;
	thumbnailUrl: string;
	thumbnailAvailable: boolean;
	edition: { effectiveDate: string; editionNumber: number | null } | null;
	archiveSizeBytes: number | null;
	archiveSha: string;
	downloadedAt: string;
	generator: string;
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

function formatRelative(iso: string): string {
	if (!iso || iso === 'pending-download') return '--';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

const altText = $derived(
	edition
		? `${title} - edition ${edition.effectiveDate}${edition.editionNumber ? ` (#${edition.editionNumber})` : ''}`
		: `${title} - preview`,
);
const editionLabel = $derived(
	edition ? `${edition.effectiveDate}${edition.editionNumber ? ` (#${edition.editionNumber})` : ''}` : '--',
);
</script>

<section class="tile" aria-label="Source preview">
	<a
		class="thumb"
		href={ROUTES.HANGAR_SOURCE_DOWNLOAD(sourceId)}
		aria-label="Download full chart archive"
	>
		{#if thumbnailAvailable}
			<img src={thumbnailUrl} alt={altText} />
		{:else}
			<div class="thumb-unavailable">
				<p class="unavailable-label">Thumbnail unavailable</p>
				<p class="unavailable-hint">Install <code>gdal_translate</code> (or run on macOS) and re-fetch.</p>
			</div>
		{/if}
	</a>
	<dl class="meta">
		<div>
			<dt>Edition</dt>
			<dd>{editionLabel}</dd>
		</div>
		<div>
			<dt>Archive</dt>
			<dd><span class="mono">{formatBytes(archiveSizeBytes)}</span> - <span class="mono">{archiveSha.slice(0, 12)}</span></dd>
		</div>
		<div>
			<dt>Downloaded</dt>
			<dd>{formatRelative(downloadedAt)}</dd>
		</div>
		<div>
			<dt>Generator</dt>
			<dd><span class="mono">{generator}</span></dd>
		</div>
	</dl>
</section>

<style>
	.tile {
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

	.thumb:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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

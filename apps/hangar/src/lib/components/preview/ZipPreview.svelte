<script lang="ts">
import type { SourceMedia } from '@ab/aviation';

/**
 * Dedicated preview for zip archives. Lists top-level entries from the archive
 * manifest recorded at ingest time (no extraction here), reports the on-disk
 * size, and flags the archived-edition state so operators can distinguish the
 * live archive from prior retained editions.
 *
 * See docs/work-packages/hangar-non-textual/design.md Preview dispatcher.
 */

let {
	fileName,
	fileSizeBytes,
	isArchive,
	media,
}: {
	fileName: string;
	fileSizeBytes: number;
	isArchive: boolean;
	media: SourceMedia | null;
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

const entries = $derived(media?.archiveEntries ?? []);
const hasEntries = $derived(entries.length > 0);
</script>

<section class="preview-zip" aria-label="Zip archive preview">
	<header class="hd">
		<div class="hd-main">
			<span class="mono name">{fileName}</span>
			<span class="size mono">{formatBytes(fileSizeBytes)}</span>
		</div>
		<div class="hd-flags">
			{#if isArchive}
				<span class="flag archived-flag">archived edition</span>
			{/if}
			<span class="count">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
		</div>
	</header>

	{#if hasEntries}
		<ul class="entries" aria-label="Archive entries">
			{#each entries as entry (entry.name)}
				<li class="entry">
					<span class="entry-name mono">{entry.name}</span>
					<span class="entry-size mono">{formatBytes(entry.sizeBytes)}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">No archive manifest recorded. Re-fetch to capture entries.</p>
	{/if}
</section>

<style>
	.preview-zip {
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
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
		padding-bottom: var(--space-xs);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.hd-main {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
	}

	.name {
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.size {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.hd-flags {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.flag {
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.archived-flag {
		background: var(--signal-info-wash);
		color: var(--signal-info);
	}

	.count {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.entries {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		max-height: 24rem;
		overflow: auto;
	}

	.entry {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-md);
		padding: var(--space-2xs) 0;
		border-bottom: 1px solid var(--edge-subtle);
	}

	.entry:last-child {
		border-bottom: none;
	}

	.entry-name {
		color: var(--ink-body);
		font-size: var(--type-ui-caption-size);
		word-break: break-all;
	}

	.entry-size {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.empty {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>

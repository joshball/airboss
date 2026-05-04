<script lang="ts" module>
/**
 * `<ReadingTime>` -- the small "≈ N min read" badge surfaced next to a
 * section / chapter / handbook header.
 *
 * Renders nothing when `minutes <= 0` so callers don't have to guard the
 * "no body content" case. The badge is a `<span>` so it inlines cleanly into
 * a header without forcing a line break; styling is light-weight (muted
 * text + leading "≈" glyph) so the badge reads as metadata, not a CTA.
 *
 * The wording mirrors Medium / Substack / GitHub READMEs ("≈ 4 min read")
 * so a reader's intuition for "is this short?" transfers directly.
 */

export interface ReadingTimeProps {
	/** Estimated minutes-to-read. Anything <= 0 hides the badge. */
	readonly minutes: number;
	/**
	 * Optional `aria-label` override. Defaults to "Approximately N minutes
	 * to read"; pass a corpus-specific phrase ("Approximately N minutes to
	 * read this chapter") if needed.
	 */
	readonly ariaLabel?: string;
}
</script>

<script lang="ts">
let { minutes, ariaLabel }: ReadingTimeProps = $props();

const label = $derived(ariaLabel ?? `Approximately ${minutes} minute${minutes === 1 ? '' : 's'} to read`);
</script>

{#if minutes > 0}
	<span class="reading-time" aria-label={label} data-testid="reading-time">
		<span aria-hidden="true">≈ {minutes} min read</span>
	</span>
{/if}

<style>
	.reading-time {
		display: inline-flex;
		align-items: baseline;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		font-variant-numeric: tabular-nums;
		letter-spacing: var(--letter-spacing-wide);
	}
</style>

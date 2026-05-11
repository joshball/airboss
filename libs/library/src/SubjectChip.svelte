<script lang="ts" module>
/**
 * `<SubjectChip>` -- token-driven primitive for a "subject" tag rendered on
 * reference cards and per-doc landing pages.
 *
 * Subjects come from the `aviation_topics` vocabulary in
 * `libs/constants/src/reference-tags.ts`; every reference carries 1-3 of
 * them. Surfaces previously hand-rolled this chip with subtly different
 * spacing in three places (catalog, handbook landing, CFR landing); this
 * component is the single source.
 */

export interface SubjectChipProps {
	readonly subject: string;
}
</script>

<script lang="ts">
let { subject }: SubjectChipProps = $props();
</script>

<span class="subject-chip">{subject}</span>

<style>
	.subject-chip {
		display: inline-block;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		padding: var(--space-2xs) var(--space-xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
</style>

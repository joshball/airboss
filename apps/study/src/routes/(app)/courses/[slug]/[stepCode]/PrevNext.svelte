<script lang="ts">
/**
 * Prev/next leaf navigation for the course step reader. Renders two
 * links at the bottom of the page: prev (left) and next (right). Either
 * link is suppressed when null (start / end of the course's flat leaf
 * list).
 *
 * Per design.md "Prev/next traversal" -- leaves are flattened in
 * document order via `flattenLeavesDepthFirst`. For non-leaf rows the
 * load function picks the first-leaf-descendant as the "current
 * position" so clicking "next" on a lesson landing enters the lesson.
 */

import { ROUTES } from '@ab/constants';
import type { PrevNextLink } from './+page.server';

interface Props {
	courseSlug: string;
	prev: PrevNextLink | null;
	next: PrevNextLink | null;
}

let { courseSlug, prev, next }: Props = $props();
</script>

{#if prev !== null || next !== null}
	<nav class="prev-next" aria-label="Step navigation">
		{#if prev !== null}
			<a class="prev" href={ROUTES.COURSE_STEP(courseSlug, prev.code)} rel="prev">
				<span class="dir">Prev</span>
				<span class="title">{prev.title}</span>
			</a>
		{:else}
			<span class="prev empty" aria-hidden="true"></span>
		{/if}
		{#if next !== null}
			<a class="next" href={ROUTES.COURSE_STEP(courseSlug, next.code)} rel="next">
				<span class="dir">Next</span>
				<span class="title">{next.title}</span>
			</a>
		{:else}
			<span class="next empty" aria-hidden="true"></span>
		{/if}
	</nav>
{/if}

<style>
	.prev-next {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		padding: var(--space-md);
		border-top: 1px solid var(--edge-default);
	}

	.prev,
	.next {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--ink-body);
		background: var(--ink-inverse);
		max-width: 45%;
		transition: border-color var(--motion-fast) ease;
	}

	.prev:hover,
	.next:hover {
		border-color: var(--action-default-edge);
		background: var(--surface-muted);
	}

	.next {
		text-align: right;
		align-items: flex-end;
	}

	.dir {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.title {
		font-weight: 500;
	}

	.empty {
		display: block;
		visibility: hidden;
		max-width: 45%;
	}
</style>

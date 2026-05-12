<!--
CourseStepMarkdown -- the course-step body renderer.

Takes authored markdown (a `body_md` from `course_steps` or a `content_md`
from `knowledge_nodes`), parses it via `@ab/help`'s `parseMarkdownSync`
(no Shiki -- course bodies rarely carry code blocks, the plain
`<pre><code>` fallback is fine), and renders the resulting `MdNode[]` AST
through `<MarkdownBody>`.

Component-mount directives (`:::chart`, `:::scenario`) flow through the
`renderDirective` snippet: chart slugs mount `<CourseStepChart>`,
scenario slugs mount `<ScenarioPanel>`. Unknown directives render an
inert placeholder (defence in depth -- the parser already rejects
unknown directive names, so this branch only fires if a future directive
name lands in the AST before a renderer mapping does).

This component replaces the legacy `renderMarkdown(...) + {@html}` path
on course-step pages so the directive parser is the single source of
truth for authored markdown across body_md / content_md.
-->
<script lang="ts">
import { MARKDOWN_DIRECTIVE_NAMES, type WxScenario } from '@ab/constants';
import { type DirectiveNode, type MdNode, parseMarkdownSync } from '@ab/help';
import MarkdownBody from '@ab/help/ui/MarkdownBody.svelte';
import CourseStepChart from './CourseStepChart.svelte';
import ScenarioPanel from './ScenarioPanel.svelte';

interface Props {
	bodyMd: string;
}

let { bodyMd }: Props = $props();

// `parseMarkdownSync` throws `MarkdownParseError` for unclosed callouts /
// malformed directives. Catch + surface the error inline so an authoring
// typo on a course-step body never blanks the page; the error is visible
// at the point of failure.
const parsed = $derived.by((): { ok: true; ast: MdNode[] } | { ok: false; message: string } => {
	try {
		return { ok: true, ast: parseMarkdownSync(bodyMd) };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, message };
	}
});
</script>

{#if parsed.ok}
	<MarkdownBody nodes={parsed.ast}>
		{#snippet renderDirective(node: DirectiveNode)}
			{#if node.name === MARKDOWN_DIRECTIVE_NAMES.CHART}
				<CourseStepChart slug={node.attrs.slug} />
			{:else if node.name === MARKDOWN_DIRECTIVE_NAMES.SCENARIO}
				<ScenarioPanel slug={node.attrs.slug as WxScenario} />
			{:else}
				<div class="unknown-directive" data-directive={node.name}>
					Unknown directive <code>:::{node.name}</code>.
				</div>
			{/if}
		{/snippet}
	</MarkdownBody>
{:else}
	<div class="parse-error" role="alert">
		<strong>Markdown parse error.</strong>
		<p>{parsed.message}</p>
	</div>
{/if}

<style>
	.parse-error {
		padding: var(--space-md);
		border: 1px solid var(--action-hazard);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		color: var(--ink-body);
	}

	.parse-error p {
		margin: var(--space-xs) 0 0;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	.unknown-directive {
		margin: var(--space-md) 0;
		padding: var(--space-sm) var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		color: var(--ink-muted);
	}

	.unknown-directive code {
		font-family: var(--font-family-mono);
	}
</style>

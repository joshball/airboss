/**
 * Component-mounting markdown directives.
 *
 * The course-step renderer (and any other surface that parses authored
 * markdown via `@ab/help`'s `parseMarkdown`) supports inline directives of
 * the form:
 *
 *     :::chart slug="wx-scenarios/frontal-xc-march/surface-analysis"
 *     :::
 *
 *     :::scenario slug="frontal-xc-march"
 *     :::
 *
 * Each directive parses to an AST `DirectiveNode` carrying the directive
 * `name` and an attribute bag. The renderer (`MarkdownBody.svelte`) mounts
 * the matching Svelte component (`<CourseStepChart>` / `<ScenarioPanel>`)
 * per name. Callouts (`:::tip` / `:::warn` / ...) continue to use the
 * existing `CALLOUT_VARIANTS` block path; this constant lists the directive
 * names that have no inner body and instead drive a component mount.
 *
 * Keep this list small. Every value here adds a public author surface and
 * a renderer obligation. New directives go through the same review as new
 * callout variants.
 */

export const MARKDOWN_DIRECTIVE_NAMES = {
	CHART: 'chart',
	SCENARIO: 'scenario',
} as const;

export const MARKDOWN_DIRECTIVE_VALUES = Object.values(MARKDOWN_DIRECTIVE_NAMES);

export type MarkdownDirectiveName = (typeof MARKDOWN_DIRECTIVE_VALUES)[number];

/**
 * Required attribute keys per directive. The parser collects every
 * `key="value"` pair from the opening line; the renderer + validator use
 * this map to verify each directive carries the attributes it needs.
 */
export const MARKDOWN_DIRECTIVE_REQUIRED_ATTRS: Record<MarkdownDirectiveName, readonly string[]> = {
	chart: ['slug'],
	scenario: ['slug'],
};

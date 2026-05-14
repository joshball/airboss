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
 *     :::cards
 *     - front: "..."
 *       back: "..."
 *     :::
 *
 * Each directive parses to an AST `DirectiveNode` carrying the directive
 * `name` and an attribute bag. The renderer (`MarkdownBody.svelte`) mounts
 * the matching Svelte component (`<CourseStepChart>` / `<ScenarioPanel>`)
 * per name, or renders nothing (`:::cards` is data-only -- the YAML body
 * feeds the spaced-repetition seeder at build time and the rendered page
 * is intentionally silent because cards surface via the review queue, not
 * inline on the knowledge node). Callouts (`:::tip` / `:::warn` / ...)
 * continue to use the existing `CALLOUT_VARIANTS` block path; this
 * constant lists the directive names that drive a component mount or a
 * data-only payload.
 *
 * Two families:
 *
 *   - **Attribute-only directives** (`chart`, `scenario`): carry
 *     `key="value"` attributes on the opener and MUST close on the next
 *     non-blank line. The parser rejects any body content.
 *   - **Body-bearing directives** (`cards`): the lines between opener
 *     and closer hold a payload the validator parses as data (YAML for
 *     `cards`). The parser collects the body verbatim into
 *     `DirectiveNode.body` -- it does NOT walk the body as nested
 *     markdown. The validator-of-record per name (see
 *     `validateDirective` in `libs/help/src/markdown/block.ts`) decides
 *     how to interpret it.
 *
 * Keep this list small. Every value here adds a public author surface and
 * a renderer obligation. New directives go through the same review as new
 * callout variants.
 */

export const MARKDOWN_DIRECTIVE_NAMES = {
	CARDS: 'cards',
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
	cards: [],
	chart: ['slug'],
	scenario: ['slug'],
};

/**
 * Directives whose body between opener and closer is captured verbatim
 * into `DirectiveNode.body`. Attribute-only directives are NOT in this
 * set -- their parser path enforces an empty body and throws on any
 * non-blank line between `:::name` and `:::`.
 *
 * The body is raw text; the per-directive validator (run inside the
 * parser) is responsible for parsing it (`cards` parses as YAML).
 */
export const MARKDOWN_DIRECTIVE_BODY_BEARING: ReadonlySet<MarkdownDirectiveName> = new Set([
	MARKDOWN_DIRECTIVE_NAMES.CARDS,
]);

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
 *     :::phase name="context"
 *     Body markdown for the phase. Headings of level >= 3 are allowed; H1
 *     and H2 inside a phase body are rejected (the phase title itself is
 *     auto-rendered as an H3 by the renderer, sourced from
 *     `KNOWLEDGE_PHASE_LABELS`).
 *     :::
 *
 * Each directive parses to an AST `DirectiveNode` carrying the directive
 * `name` and an attribute bag. The renderer (`MarkdownBody.svelte`) mounts
 * the matching Svelte component (`<CourseStepChart>` / `<ScenarioPanel>`)
 * per name, or renders nothing (`:::cards` is data-only -- the YAML body
 * feeds the spaced-repetition seeder at build time and the rendered page
 * is intentionally silent because cards surface via the review queue, not
 * inline on the knowledge node), or recurses into the nested markdown AST
 * (`:::phase` is a structural splitter consumed by `splitContentPhases`).
 * Callouts (`:::tip` / `:::warn` / ...) continue to use the existing
 * `CALLOUT_VARIANTS` block path; this constant lists the directive names
 * that drive a component mount, a data payload, or a nested markdown body.
 *
 * Three families:
 *
 *   - **Attribute-only directives** (`chart`, `scenario`): carry
 *     `key="value"` attributes on the opener and MUST close on the next
 *     non-blank line. The parser rejects any body content.
 *   - **Data-payload-body directives** (`cards`): the lines between
 *     opener and closer hold a typed payload (YAML for `cards`) parsed
 *     by the validator. The body is collected verbatim into
 *     `DirectiveNode.body` and is NOT walked as nested markdown -- it's
 *     a typed data block.
 *   - **Nested-markdown-body directives** (`phase`): the body IS
 *     authored markdown. The parser captures the raw body into
 *     `DirectiveNode.body` (for splitters that want the raw text) AND
 *     recursively parses the body as markdown, populating
 *     `DirectiveNode.children` for renderers that want the AST without
 *     re-parsing. The per-directive validator enforces structural
 *     constraints on the body (e.g., `phase` rejects H1/H2 inside the
 *     body because the phase title is auto-rendered as an H3).
 *
 * Keep this list small. Every value here adds a public author surface and
 * a renderer obligation. New directives go through the same review as new
 * callout variants.
 */

export const MARKDOWN_DIRECTIVE_NAMES = {
	CARDS: 'cards',
	CHART: 'chart',
	PHASE: 'phase',
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
	phase: ['name'],
	scenario: ['slug'],
};

/**
 * Directives whose body between opener and closer is captured verbatim
 * into `DirectiveNode.body`. Attribute-only directives are NOT in this
 * set -- their parser path enforces an empty body and throws on any
 * non-blank line between `:::name` and `:::`.
 *
 * The body is raw text; the per-directive validator (run inside the
 * parser) is responsible for interpreting it (`cards` parses as YAML;
 * `phase` walks the body for disallowed headings).
 */
export const MARKDOWN_DIRECTIVE_BODY_BEARING: ReadonlySet<MarkdownDirectiveName> = new Set([
	MARKDOWN_DIRECTIVE_NAMES.CARDS,
	MARKDOWN_DIRECTIVE_NAMES.PHASE,
]);

/**
 * Body-bearing directives whose body IS nested markdown (NOT a typed
 * data payload). The parser captures the raw text into `node.body` AND
 * recursively parses the body as markdown, populating `node.children`
 * with the resulting `MdNode[]`. Renderers that walk a directive's
 * nested AST (rather than re-rendering raw markdown) read from
 * `node.children`; splitters that consume the raw text (e.g., the
 * knowledge-node phase splitter) read from `node.body`.
 *
 * Data-payload directives (e.g., `cards`) are body-bearing but NOT in
 * this set -- their body is a typed payload, not authored markdown.
 */
export const MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY: ReadonlySet<MarkdownDirectiveName> = new Set([
	MARKDOWN_DIRECTIVE_NAMES.PHASE,
]);

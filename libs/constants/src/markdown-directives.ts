/**
 * Markdown directive registry.
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
 *     :::tip Optional title
 *     Body markdown for the callout box.
 *     :::
 *
 * Every directive shares the `:::name` opener and the bare `:::` closer.
 * A body-bearing directive may also be closed inline on the SAME line with
 * a trailing `:::` (e.g. `:::cards none:::`); the block form and the
 * inline-closed form parse to an equivalent node.
 *
 * Four directive families:
 *
 *   - **Attribute-only directives** (`chart`, `scenario`): carry
 *     `key="value"` attributes on the opener and MUST close on the next
 *     non-blank line. The parser rejects any body content. Each parses to
 *     an AST `DirectiveNode` carrying `name` + attribute bag; the renderer
 *     (`MarkdownBody.svelte`) mounts the matching Svelte component
 *     (`<CourseStepChart>` / `<ScenarioPanel>`).
 *   - **Data-payload-body directives** (`cards`): the lines between
 *     opener and closer hold a typed payload (YAML for `cards`) parsed
 *     by the validator. The body is collected verbatim into
 *     `DirectiveNode.body` and is NOT walked as nested markdown -- it's
 *     a typed data block. `cards` renders nothing inline: the YAML body
 *     feeds the spaced-repetition seeder at build time and cards surface
 *     via the review queue, not on the knowledge node. `cards` stays in
 *     this family deliberately; its body is structured data, not prose,
 *     so it is NOT a nested-markdown-body directive.
 *   - **Nested-markdown-body directives** (`phase`): the body IS
 *     authored markdown. The parser captures the raw body into
 *     `DirectiveNode.body` (for splitters that want the raw text) AND
 *     recursively parses the body as markdown, populating
 *     `DirectiveNode.children` for renderers that want the AST without
 *     re-parsing. The per-directive validator enforces structural
 *     constraints on the body (e.g., `phase` rejects H1/H2 inside the
 *     body because the phase title is auto-rendered as an H3). `:::phase`
 *     is a structural splitter consumed by `splitContentPhases`.
 *   - **Variant-named directives** (the callout family: `tip`, `warn`,
 *     `note`, `example`): the directive NAME is itself the variant drawn
 *     from a closed enum -- authoring stays `:::tip` / `:::warn`, not
 *     `:::callout variant="tip"`. The body is nested markdown (same
 *     behaviour as `phase`): the parser recurses into the block parser
 *     and builds a `children` AST. The renderer mounts a styled callout
 *     box (`<HelpCard>`) keyed on the variant. Each variant carries a
 *     fixed semantic purpose:
 *       - `tip`     -- a technique or pro-move the learner should adopt.
 *       - `warn`    -- a hazard or a common error.
 *       - `note`    -- a neutral aside or context.
 *       - `example` -- a worked instance of the concept just taught.
 *
 * Keep these lists small. Every value adds a public author surface and a
 * renderer obligation. New directives (and new callout variants) go
 * through the same review.
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
 * Callout-family directive names (the variant-named family). The directive
 * name IS the callout variant: authoring is `:::tip` / `:::warn` /
 * `:::note` / `:::example`, never `:::callout variant="..."`.
 *
 * Each variant has a fixed semantic purpose (see the file doc comment):
 *
 *   - `tip`     -- a technique or pro-move the learner should adopt.
 *   - `warn`    -- a hazard or a common error.
 *   - `note`    -- a neutral aside or context.
 *   - `example` -- a worked instance of the concept just taught.
 *
 * `danger` and `howto` were retired in Phase 3 (zero authored uses; dead
 * code). New callout variants go through the same review as new directives.
 */
export const MARKDOWN_CALLOUT_VARIANT_NAMES = {
	EXAMPLE: 'example',
	NOTE: 'note',
	TIP: 'tip',
	WARN: 'warn',
} as const;

export const MARKDOWN_CALLOUT_VARIANT_VALUES = Object.values(MARKDOWN_CALLOUT_VARIANT_NAMES);

export type MarkdownCalloutVariant = (typeof MARKDOWN_CALLOUT_VARIANT_VALUES)[number];

/**
 * Every legal directive name across all four families. The parser keys
 * its `:::name` opener recognition on this set; membership in one of the
 * per-family sets above selects which parse path runs.
 */
export const MARKDOWN_DIRECTIVE_ALL_NAMES: readonly string[] = [
	...MARKDOWN_DIRECTIVE_VALUES,
	...MARKDOWN_CALLOUT_VARIANT_VALUES,
];

/**
 * Required attribute keys per directive. The parser collects every
 * `key="value"` pair from the opening line; the renderer + validator use
 * this map to verify each directive carries the attributes it needs.
 *
 * Callout-family directives carry no required attributes (the variant is
 * the name, and the optional title is free text after the name), so they
 * are not listed here -- the parser's callout path does not consult this
 * map.
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
 *
 * Callout-family directives are body-bearing too, but they are tracked
 * via `MARKDOWN_CALLOUT_VARIANT_VALUES` (the parser's callout path),
 * not this set.
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
 *
 * Callout-family directives also have nested-markdown bodies; the parser
 * handles them via its callout path (emitting a `CalloutNode`) rather
 * than this set, which is keyed on `MarkdownDirectiveName`.
 */
export const MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY: ReadonlySet<MarkdownDirectiveName> = new Set([
	MARKDOWN_DIRECTIVE_NAMES.PHASE,
]);

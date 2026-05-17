/**
 * Markdown AST for the help library renderer.
 *
 * The parser produces `MdNode[]` (block-level) trees. Inline ranges inside
 * block nodes are represented as `InlineNode[]`. The AST is deliberately
 * small: authors write a controlled dialect (headings h2-h4, paragraphs,
 * lists, tables, fenced code, blockquotes, callouts, figures, hr) plus the
 * project-specific `[[display::id]]` wikilinks.
 *
 * Callouts are the variant-named directive family: the directive name
 * (`tip` / `warn` / `note` / `example`) is the variant. The legal set is
 * owned by `MARKDOWN_CALLOUT_VARIANT_VALUES` in `@ab/constants`.
 */

import type { MarkdownCalloutVariant } from '@ab/constants';

export type CalloutVariant = MarkdownCalloutVariant;

export type TableAlign = 'left' | 'right' | 'center' | null;

export interface HeadingNode {
	kind: 'heading';
	level: 2 | 3 | 4;
	id: string;
	children: InlineNode[];
}

export interface ParagraphNode {
	kind: 'paragraph';
	children: InlineNode[];
}

export interface ListItemNode {
	kind: 'listItem';
	children: MdNode[];
}

export interface ListNode {
	kind: 'list';
	ordered: boolean;
	items: ListItemNode[];
}

export interface TableNode {
	kind: 'table';
	alignments: TableAlign[];
	header: InlineNode[][];
	rows: InlineNode[][][];
}

export interface CodeNode {
	kind: 'code';
	lang: string;
	value: string;
	/** Filled by `parseMarkdown` after Shiki runs. Raw pre-rendered HTML. */
	highlighted?: string;
}

export interface BlockquoteNode {
	kind: 'blockquote';
	children: MdNode[];
}

/**
 * A callout box (the variant-named directive family). Authored as
 * `:::tip` / `:::warn` / `:::note` / `:::example` -- the directive name
 * is the `variant`. The body is nested markdown (same family behaviour as
 * `:::phase`): the parser recurses into the block parser and stores the
 * resulting `MdNode[]` in `children`. The renderer mounts a styled
 * `<HelpCard>` keyed on the variant.
 *
 * Callouts share the `:::name` opener and the bare `:::` closer with
 * every other directive and are recognised through the same registry
 * (`MARKDOWN_DIRECTIVE_ALL_NAMES`). They keep their own node kind --
 * rather than collapsing into `DirectiveNode` -- because the variant is
 * a closed enum the renderer switches on directly, with no attribute
 * bag and no host-app component mount.
 */
export interface CalloutNode {
	kind: 'callout';
	variant: CalloutVariant;
	title?: string;
	children: MdNode[];
}

export interface FigureNode {
	kind: 'figure';
	src: string;
	alt: string;
	caption?: string;
}

export interface HrNode {
	kind: 'hr';
}

/**
 * Component-mounting (or data-payload, or nested-markdown) directive
 * (e.g. `:::chart slug="..."` / `:::scenario slug="..."` /
 * `:::cards ... :::` / `:::phase name="..." ... :::`). Unlike callouts,
 * directives identify either a Svelte component the renderer should
 * mount (parameterised by the attribute bag), a data payload the parser
 * has already validated inline, or a structural wrapper whose body is
 * nested markdown. The set of legal `name` values is owned by
 * `MARKDOWN_DIRECTIVE_VALUES` in `@ab/constants`.
 *
 * Attributes are stored as a string-keyed string map; per-directive
 * validation (required keys, slug shapes, payload schema, body shape)
 * runs in the parser before this node is emitted, so the renderer can
 * trust the attribute bag's shape and -- for body-bearing directives --
 * the body payload's syntactic validity.
 *
 * `body` is populated for directives listed in
 * `MARKDOWN_DIRECTIVE_BODY_BEARING` (currently `cards`, `phase`); the
 * raw text between opener and `:::` closer lands here verbatim.
 *
 * `children` is populated ONLY for directives in
 * `MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY` (currently `phase`); the
 * parser recursively walks the body through the same block parser and
 * stores the resulting `MdNode[]` here so renderers can walk a real
 * AST without re-parsing. Data-payload directives (e.g. `cards`) leave
 * `children` undefined because the body is a typed data block, not
 * authored markdown. Attribute-only directives (`chart`, `scenario`)
 * leave both `body` and `children` undefined.
 */
export interface DirectiveNode {
	kind: 'directive';
	name: string;
	attrs: Record<string, string>;
	body?: string;
	children?: MdNode[];
}

export type MdNode =
	| HeadingNode
	| ParagraphNode
	| ListNode
	| ListItemNode
	| TableNode
	| CodeNode
	| BlockquoteNode
	| CalloutNode
	| DirectiveNode
	| FigureNode
	| HrNode;

export interface TextInline {
	kind: 'text';
	value: string;
}

export interface StrongInline {
	kind: 'strong';
	children: InlineNode[];
}

export interface EmInline {
	kind: 'em';
	children: InlineNode[];
}

export interface CodeInline {
	kind: 'code';
	value: string;
}

export interface LinkInline {
	kind: 'link';
	url: string;
	external: boolean;
	/** Source badge derived from hostname (external links only). */
	source?: 'wikipedia' | 'faa' | 'paper' | 'book' | 'other';
	children: InlineNode[];
}

export interface WikilinkInline {
	kind: 'wikilink';
	display: string;
	/** Target id (post-`::`). Empty string when the author wrote `[[display::]]`. */
	pageId: string;
}

export interface BrInline {
	kind: 'br';
}

export type InlineNode = TextInline | StrongInline | EmInline | CodeInline | LinkInline | WikilinkInline | BrInline;

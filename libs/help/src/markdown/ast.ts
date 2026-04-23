/**
 * Markdown AST for the help library renderer.
 *
 * The parser produces `MdNode[]` (block-level) trees. Inline ranges inside
 * block nodes are represented as `InlineNode[]`. The AST is deliberately
 * small: authors write a controlled dialect (headings h2-h4, paragraphs,
 * lists, tables, fenced code, blockquotes, callouts, figures, hr) plus the
 * project-specific `[[display::id]]` wikilinks.
 *
 * Callout variants reuse the same set the validator accepts -- see
 * `CALLOUT_VARIANTS` in `libs/help/src/validation.ts`.
 */

export type CalloutVariant = 'tip' | 'warn' | 'danger' | 'howto' | 'note' | 'example';

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

export type MdNode =
	| HeadingNode
	| ParagraphNode
	| ListNode
	| ListItemNode
	| TableNode
	| CodeNode
	| BlockquoteNode
	| CalloutNode
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

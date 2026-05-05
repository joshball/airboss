/**
 * Glossary loader -- the public API for the four "explain everything"
 * surfaces (hover tooltips, page explainers, the right-cluster drawer,
 * the number `?` popover).
 *
 * Tooltips need only the short string; they read straight from the
 * eager-bundled `GLOSSARY_ENTRIES` map. The drawer and the canonical
 * `/reference/glossary` page render the long-form markdown body.
 *
 * Markdown bodies are bundled by Vite's `import.meta.glob` so this module
 * stays browser-safe (no `node:fs`). Bodies ride along the JS bundle but
 * the corpus is small enough (~20 short markdown files) that the cost is
 * negligible -- swapping to lazy `import()` per key is a future
 * optimisation if the corpus grows.
 */

import { GLOSSARY_BY_KEY, GLOSSARY_ENTRIES, type GlossaryEntry } from './entries';

export type { GlossaryEntry };
export { GLOSSARY_ENTRIES };

/**
 * Eager-glob of every long-form markdown file under `./content/`. Keys
 * are the resolved module paths (e.g. `/.../content/qual.md`); values
 * are the raw markdown source. We index by trailing filename so the
 * loader can look up `qual.md`, `cta.md`, etc. without hard-coding the
 * absolute path shape.
 */
const RAW_LONG_FORM = import.meta.glob('./content/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

const LONG_BY_FILENAME: ReadonlyMap<string, string> = new Map(
	Object.entries(RAW_LONG_FORM).map(([path, body]) => {
		const filename = path.slice(path.lastIndexOf('/') + 1);
		return [filename, body];
	}),
);

/** Merged short + long form. The drawer + glossary page consume this. */
export interface GlossaryEntryFull extends GlossaryEntry {
	/** Long-form markdown body. Empty string if no content file is present. */
	long: string;
}

/**
 * Look up one entry by key. Returns `null` for unknown keys (callers can
 * dev-warn). The long-form body is the verbatim file contents (frontmatter
 * included) so callers can strip the YAML in their own renderer if they
 * want.
 */
export function getGlossaryEntry(key: string): GlossaryEntryFull | null {
	const entry = GLOSSARY_BY_KEY.get(key);
	if (entry === undefined) return null;
	const long = LONG_BY_FILENAME.get(entry.longRef) ?? '';
	return { ...entry, long };
}

/** All entries with their long-form content. Used by the drawer + glossary page index. */
export function listGlossaryEntries(): ReadonlyArray<GlossaryEntryFull> {
	return GLOSSARY_ENTRIES.map((entry) => ({
		...entry,
		long: LONG_BY_FILENAME.get(entry.longRef) ?? '',
	}));
}

/**
 * Strip a YAML frontmatter block (between leading `---` lines) and return
 * the markdown body. Renderers can call this when they want the body
 * without the metadata.
 */
export function stripFrontmatter(markdown: string): string {
	if (!markdown.startsWith('---')) return markdown;
	const end = markdown.indexOf('\n---', 3);
	if (end === -1) return markdown;
	const after = markdown.indexOf('\n', end + 4);
	if (after === -1) return '';
	// Skip blank lines immediately after the closing fence so renderers
	// don't get a leading newline.
	let i = after + 1;
	while (i < markdown.length && (markdown[i] === '\n' || markdown[i] === '\r')) i++;
	return markdown.slice(i);
}

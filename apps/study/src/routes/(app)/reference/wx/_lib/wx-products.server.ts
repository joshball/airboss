// @browser-globals: server-only -- never imported by client .svelte
/**
 * Aviation weather product reference loader.
 *
 * Reads the markdown corpus at `course/weather/references/products/<slug>/page.md`
 * and projects each page into a structured record the route can render.
 *
 * Source of truth: the on-disk directory under `course/weather/references/products/`.
 * Each subdirectory containing a `page.md` is treated as one product; the slug
 * is the directory name. No DB tables -- the markdown is the canonical store.
 *
 * Server-only -- this file uses `node:fs/promises` and `node:path` directly,
 * which is safe because `+page.server.ts` modules are never bundled into the
 * client. The `@browser-globals: server-only` tag at the top documents that
 * intent for the lint walker.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@ab/utils';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..', '..', '..', '..');
const PRODUCTS_ROOT = join(REPO_ROOT, 'course', 'weather', 'references', 'products');
const KNOWLEDGE_WEATHER_ROOT = join(REPO_ROOT, 'course', 'knowledge', 'weather');

/**
 * One entry under an array-valued frontmatter key such as
 * `authoritative_sources:`. Each item authored as an indented `- source: ...`
 * sub-block of `key: value` pairs.
 */
export interface FrontmatterListItem {
	readonly [key: string]: string;
}

/** One related-product cross-reference. Slug refers to another product dir. */
export interface RelatedProduct {
	readonly slug: string;
	readonly title: string | null;
	readonly shortCode: string | null;
	readonly exists: boolean;
}

/** One related-knowledge-node cross-reference. */
export interface RelatedKnowledgeNode {
	readonly slug: string;
}

/** Parsed projection of a single product page.md. */
export interface WxProductDetail {
	readonly slug: string;
	readonly id: string;
	readonly title: string;
	readonly shortCode: string;
	readonly category: string;
	readonly tier: string;
	readonly status: string;
	readonly elevatorPitch: string;
	readonly authoritativeSources: ReadonlyArray<FrontmatterListItem>;
	readonly relatedProducts: ReadonlyArray<RelatedProduct>;
	readonly relatedKnowledgeNodes: ReadonlyArray<RelatedKnowledgeNode>;
	/** Body markdown with the frontmatter block stripped. */
	readonly body: string;
}

/** Catalog summary projection used by the index page. One per known slug. */
export interface WxProductSummary {
	readonly slug: string;
	readonly title: string;
	readonly shortCode: string;
	readonly category: string;
	readonly tier: string;
	readonly status: string;
	readonly elevatorPitch: string;
}

/**
 * In-process cache of the parsed catalog. Markdown ships with the deploy, so
 * the cache lives for the lifetime of the server process; restart picks up
 * new content. Mirrors the lesson-tree cache pattern in
 * `apps/study/src/routes/(app)/study/_lib/lesson-tree.ts`.
 */
let cache: ReadonlyMap<string, WxProductDetail> | null = null;
let cachePromise: Promise<ReadonlyMap<string, WxProductDetail>> | null = null;

async function loadCatalogUncached(): Promise<ReadonlyMap<string, WxProductDetail>> {
	let exists = false;
	try {
		const stats = await stat(PRODUCTS_ROOT);
		exists = stats.isDirectory();
	} catch {
		exists = false;
	}
	if (!exists) return new Map();

	const entries = await readdir(PRODUCTS_ROOT, { withFileTypes: true });
	const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

	const records: WxProductDetail[] = [];
	for (const slug of slugs) {
		const filePath = join(PRODUCTS_ROOT, slug, 'page.md');
		let raw: string;
		try {
			raw = await readFile(filePath, 'utf8');
		} catch {
			// Subdirectory without a `page.md` (e.g. a future asset dir) -- skip.
			continue;
		}
		const record = parseProductMarkdown(slug, raw);
		if (record !== null) records.push(record);
	}

	// Resolve related-product titles in a second pass now that all slugs are known.
	const bySlug = new Map<string, WxProductDetail>();
	for (const r of records) bySlug.set(r.slug, r);
	const resolved = new Map<string, WxProductDetail>();
	for (const r of records) {
		const relatedProducts = r.relatedProducts.map((rp) => {
			const target = bySlug.get(rp.slug);
			if (target === undefined) {
				return { slug: rp.slug, title: null, shortCode: null, exists: false } satisfies RelatedProduct;
			}
			return {
				slug: rp.slug,
				title: target.title,
				shortCode: target.shortCode,
				exists: true,
			} satisfies RelatedProduct;
		});
		resolved.set(r.slug, { ...r, relatedProducts });
	}
	return resolved;
}

/**
 * Get the parsed product catalog as a slug-keyed map. Idempotent: subsequent
 * calls return the cached map.
 */
export async function getWxProductCatalog(): Promise<ReadonlyMap<string, WxProductDetail>> {
	if (cache !== null) return cache;
	if (cachePromise !== null) return cachePromise;
	cachePromise = (async (): Promise<ReadonlyMap<string, WxProductDetail>> => {
		const map = await loadCatalogUncached();
		cache = map;
		cachePromise = null;
		return map;
	})();
	return cachePromise;
}

/** Test / hot-reload hook: drop the cache so a fresh disk walk runs. */
export function _resetWxProductCache(): void {
	cache = null;
	cachePromise = null;
	knowledgeDirCache = null;
	knowledgeDirCachePromise = null;
}

/**
 * Map of `course/knowledge/weather/<dir>` directory name -> knowledge node id
 * declared in that node's frontmatter `id:` field. Used to rewrite relative
 * `[link](../../../../knowledge/weather/<dir>/node.md)` paths in a product
 * body to the canonical knowledge-route URL (the route slug IS the node id).
 */
let knowledgeDirCache: ReadonlyMap<string, string> | null = null;
let knowledgeDirCachePromise: Promise<ReadonlyMap<string, string>> | null = null;

export async function getKnowledgeWeatherDirToIdMap(): Promise<ReadonlyMap<string, string>> {
	if (knowledgeDirCache !== null) return knowledgeDirCache;
	if (knowledgeDirCachePromise !== null) return knowledgeDirCachePromise;
	knowledgeDirCachePromise = (async (): Promise<ReadonlyMap<string, string>> => {
		const out = new Map<string, string>();
		let exists = false;
		try {
			const stats = await stat(KNOWLEDGE_WEATHER_ROOT);
			exists = stats.isDirectory();
		} catch {
			exists = false;
		}
		if (!exists) {
			knowledgeDirCache = out;
			knowledgeDirCachePromise = null;
			return out;
		}
		const entries = await readdir(KNOWLEDGE_WEATHER_ROOT, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const filePath = join(KNOWLEDGE_WEATHER_ROOT, entry.name, 'node.md');
			let raw: string;
			try {
				raw = await readFile(filePath, 'utf8');
			} catch {
				continue;
			}
			const { entries: fm } = parseFrontmatter(raw);
			const idEntry = fm.find((e) => e.key === 'id');
			if (idEntry && idEntry.value.length > 0) out.set(entry.name, idEntry.value);
		}
		knowledgeDirCache = out;
		knowledgeDirCachePromise = null;
		return out;
	})();
	return knowledgeDirCachePromise;
}

/** Look up one product by slug; returns `null` when unknown. */
export async function getWxProduct(slug: string): Promise<WxProductDetail | null> {
	const catalog = await getWxProductCatalog();
	return catalog.get(slug) ?? null;
}

/** List the catalog as summaries for the index surface. */
export async function listWxProductSummaries(): Promise<ReadonlyArray<WxProductSummary>> {
	const catalog = await getWxProductCatalog();
	const out: WxProductSummary[] = [];
	for (const r of catalog.values()) {
		out.push({
			slug: r.slug,
			title: r.title,
			shortCode: r.shortCode,
			category: r.category,
			tier: r.tier,
			status: r.status,
			elevatorPitch: r.elevatorPitch,
		});
	}
	return out;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Project one product's `page.md` into a structured record. Returns `null`
 * when the page is missing required scalar frontmatter (id, title) so the
 * loader can skip a partially-authored file without crashing the catalog.
 *
 * `parseFrontmatter` in `@ab/utils` only handles flat `key: value` pairs;
 * the wx product frontmatter additionally has YAML-style indented lists
 * (`authoritative_sources:`, `related_products:`, `related_knowledge_nodes:`).
 * We extract those list blocks ourselves with a small dedicated walker.
 */
function parseProductMarkdown(slug: string, raw: string): WxProductDetail | null {
	const { entries, body } = parseFrontmatter(raw);
	if (entries.length === 0) return null;

	const scalars = new Map<string, string>();
	for (const e of entries) scalars.set(e.key, e.value);

	const title = scalars.get('title') ?? '';
	if (title === '') return null;

	const id = scalars.get('id') ?? `wx-ref-${slug}`;
	const shortCode = scalars.get('short_code') ?? '';
	const category = scalars.get('category') ?? '';
	const tier = scalars.get('tier') ?? '';
	const status = scalars.get('status') ?? '';

	const lists = extractFrontmatterLists(raw);
	const authoritativeSources = lists.get('authoritative_sources') ?? [];
	const relatedProductSlugs = (lists.get('related_products') ?? []).map((item) => item._scalar ?? '').filter(nonEmpty);
	const relatedKnowledgeSlugs = (lists.get('related_knowledge_nodes') ?? [])
		.map((item) => item._scalar ?? '')
		.filter(nonEmpty);

	const relatedProducts: RelatedProduct[] = relatedProductSlugs.map((s) => ({
		slug: s,
		title: null,
		shortCode: null,
		exists: false,
	}));
	const relatedKnowledgeNodes: RelatedKnowledgeNode[] = relatedKnowledgeSlugs.map((s) => ({ slug: s }));

	const elevatorPitch = extractElevatorPitch(body);

	return {
		slug,
		id,
		title,
		shortCode,
		category,
		tier,
		status,
		elevatorPitch,
		authoritativeSources: authoritativeSources.map(stripScalar),
		relatedProducts,
		relatedKnowledgeNodes,
		body,
	};
}

interface ParsedListItem {
	readonly _scalar?: string;
	readonly [key: string]: string | undefined;
}

/**
 * Extract YAML-style indented list blocks from the leading frontmatter. The
 * `@ab/utils` `parseFrontmatter` only recognises top-level `key: value` lines;
 * the wx product frontmatter additionally has:
 *
 *     authoritative_sources:
 *       - source: AC 00-45H
 *         section: 'Chapter 3'
 *         note: Format spec.
 *       - source: AIM
 *         section: '7-1-29'
 *     related_products:
 *       - taf
 *       - speci
 *
 * Each block starts with a `^key:$` line (no value), followed by indented
 * `- foo` or `- key: value` lines until the next un-indented line. Items that
 * are scalar (`- taf`) are surfaced as `{ _scalar: 'taf' }`; items that are
 * key-value blocks aggregate every `key: value` line at the deeper indent
 * level into one record.
 */
function extractFrontmatterLists(raw: string): Map<string, ParsedListItem[]> {
	const out = new Map<string, ParsedListItem[]>();
	if (!raw.startsWith('---')) return out;
	const afterOpen = raw.charCodeAt(3);
	if (afterOpen !== 0x0a && afterOpen !== 0x0d) return out;
	const close = raw.indexOf('\n---', 3);
	if (close < 0) return out;
	const block = raw.slice(4, close);
	const lines = block.split(/\r?\n/);

	let currentKey: string | null = null;
	let items: ParsedListItem[] = [];
	let activeItem: Record<string, string> | null = null;

	const finalize = (): void => {
		if (currentKey !== null) {
			if (activeItem !== null) {
				items.push(activeItem as ParsedListItem);
				activeItem = null;
			}
			if (items.length > 0) out.set(currentKey, items);
		}
		currentKey = null;
		items = [];
	};

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, '');
		if (line === '' || line.trimStart().startsWith('#')) continue;

		// Top-level un-indented key. Two shapes:
		//   `key: value`   -- scalar, handled by parseFrontmatter
		//   `key:`         -- starts an indented list block
		const topMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
		const isIndented = /^\s/.test(line);
		if (!isIndented && topMatch !== null) {
			finalize();
			const key = topMatch[1] ?? '';
			const value = (topMatch[2] ?? '').trim();
			if (value === '') {
				currentKey = key;
			}
			continue;
		}

		if (currentKey === null) continue;

		const trimmed = line.trimStart();
		// New list item: `- foo` or `- key: value`.
		if (trimmed.startsWith('- ')) {
			if (activeItem !== null) {
				items.push(activeItem as ParsedListItem);
				activeItem = null;
			}
			const rest = trimmed.slice(2).trim();
			const kv = rest.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
			if (kv !== null && kv[2] !== undefined && kv[2].trim() !== '') {
				activeItem = { [kv[1] ?? '']: stripQuotes(kv[2].trim()) };
			} else if (kv !== null) {
				// `- key:` with empty value -- start a record with that key empty.
				activeItem = { [kv[1] ?? '']: '' };
			} else {
				// Pure scalar: `- taf`.
				items.push({ _scalar: stripQuotes(rest) });
			}
			continue;
		}

		// Continuation of an active key-value item.
		if (activeItem !== null) {
			const kv = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
			if (kv !== null) {
				activeItem[kv[1] ?? ''] = stripQuotes((kv[2] ?? '').trim());
			}
		}
	}
	finalize();
	return out;
}

function stripQuotes(s: string): string {
	if (s.length >= 2) {
		const first = s.charAt(0);
		const last = s.charAt(s.length - 1);
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return s.slice(1, -1).replace(/''/g, "'");
		}
	}
	return s;
}

function nonEmpty(s: string): boolean {
	return s.length > 0;
}

function stripScalar(item: ParsedListItem): FrontmatterListItem {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(item)) {
		if (k === '_scalar' || v === undefined) continue;
		out[k] = v;
	}
	return out;
}

/**
 * Extract the one-line elevator pitch from a product body. Convention: the
 * first blockquote (`> ...`) sits directly under the H1 and contains the
 * one-sentence definition. If no blockquote is present, fall back to the
 * first non-blank paragraph. Multi-line blockquotes are joined with a space.
 */
function extractElevatorPitch(body: string): string {
	const lines = body.split('\n');
	// Skip leading blanks, optional H1, then blanks again.
	let i = 0;
	while (i < lines.length && lines[i]?.trim() === '') i++;
	if (i < lines.length && lines[i]?.startsWith('# ')) i++;
	while (i < lines.length && lines[i]?.trim() === '') i++;

	// Blockquote path.
	if (i < lines.length && lines[i]?.startsWith('> ')) {
		const buf: string[] = [];
		while (i < lines.length && lines[i]?.startsWith('> ')) {
			buf.push(lines[i].slice(2).trim());
			i++;
		}
		return buf.join(' ').trim();
	}

	// Fallback: first non-blank paragraph.
	const para: string[] = [];
	while (i < lines.length && lines[i]?.trim() !== '') {
		const ln = lines[i].trim();
		if (ln.startsWith('#') || ln.startsWith('-') || ln.startsWith('|')) break;
		para.push(ln);
		i++;
	}
	return para.join(' ').trim();
}

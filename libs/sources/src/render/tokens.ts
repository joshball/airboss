/**
 * Token registry for `@ab/sources/render`.
 *
 * Source of truth: ADR 019 §3.1. The token set is **open** -- new tokens
 * register via `registerToken(...)` without ADR amendment. The 12 default
 * tokens listed in §3.1 are registered eagerly at module init.
 *
 * Each token is a small `{ name, kind, substitute }` record. `substitute`
 * is a pure function over `TokenContext`; the dispatcher passes the
 * resolved entry, the render mode, the optional adjacency group, and the
 * pin literal.
 */

import { resolveIdentifier, stripPin } from '../registry/query.ts';
import type { ResolvedIdentifier, SourceEntry, SourceId, Token, TokenContext, TokenName } from '../types.ts';

// ---------------------------------------------------------------------------
// Registry storage
// ---------------------------------------------------------------------------

const REGISTERED: Map<string, Token> = new Map();

/**
 * Register a token. Throws on name collision -- callers are buggy if they
 * try to overwrite a registered token; failure should be loud.
 */
export function registerToken(token: Token): void {
	if (REGISTERED.has(token.name)) {
		throw new Error(`token already registered: ${token.name}`);
	}
	REGISTERED.set(token.name, token);
}

/** Look up a token by name. Returns null when unregistered. */
export function getToken(name: string): Token | null {
	return REGISTERED.get(name) ?? null;
}

/** Snapshot of every registered token, in registration order. */
export function listTokens(): readonly Token[] {
	return Array.from(REGISTERED.values());
}

// ---------------------------------------------------------------------------
// Default token: identity-tier substitutions (per §3.1 first 5 rows)
// ---------------------------------------------------------------------------

function entryShort(resolved: ResolvedIdentifier): string {
	return resolved.entry?.canonical_short ?? '';
}

function entryFormal(resolved: ResolvedIdentifier): string {
	return resolved.entry?.canonical_formal ?? '';
}

function entryTitle(resolved: ResolvedIdentifier): string {
	return resolved.entry?.canonical_title ?? '';
}

function entryCite(resolved: ResolvedIdentifier): string {
	const e = resolved.entry;
	if (e === null) return '';
	return `${e.canonical_short} ${e.canonical_title}`;
}

const TOKEN_SHORT: Token = {
	name: '@short',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		return entryShort(ctx.resolved);
	},
};

const TOKEN_FORMAL: Token = {
	name: '@formal',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		return entryFormal(ctx.resolved);
	},
};

const TOKEN_TITLE: Token = {
	name: '@title',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		return entryTitle(ctx.resolved);
	},
};

const TOKEN_CITE: Token = {
	name: '@cite',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		return entryCite(ctx.resolved);
	},
};

// ---------------------------------------------------------------------------
// `@list`: derived from the adjacency group (or single-entry fallback per §1.4)
// ---------------------------------------------------------------------------

const TOKEN_LIST: Token = {
	name: '@list',
	kind: 'derived',
	substitute(ctx: TokenContext): string {
		const group = ctx.group;
		if (group === undefined || group.members.length <= 1) {
			// Single-entry fallback -- a list of one is the entry's canonical_short.
			return entryShort(ctx.resolved);
		}
		return formatListText(group.shape, group.members, ctx.resolvedMap);
	},
};

/**
 * Build the list-form text. Range form when `shape === 'range'`; comma-list
 * otherwise. Members resolve to `canonical_short` via the resolved map.
 *
 * Range form per ADR 019 §1.4 example: `§91.167-91.171` -- the section symbol
 * appears once on the first member; the trailing member uses its short form
 * with the leading `§` stripped (or whatever the corpus's prefix is).
 */
export function formatListText(
	shape: 'range' | 'list',
	members: readonly string[],
	resolvedMap: ReadonlyMap<string, ResolvedIdentifier>,
): string {
	const shorts = members.map((id) => resolvedMap.get(id)?.entry?.canonical_short ?? '').filter((s) => s.length > 0);
	if (shape === 'range' && shorts.length >= 2) {
		const first = shorts[0];
		const last = shorts[shorts.length - 1];
		if (first !== undefined && last !== undefined) {
			return `${first}-${stripCanonicalShortPrefix(first, last)}`;
		}
	}
	return shorts.join(', ');
}

/**
 * Strip the leading non-numeric prefix of `last` when it matches the prefix
 * of `first`. Example: `first = '§91.167'`, `last = '§91.171'` ->
 * the common non-numeric prefix is `'§'`; the bare numeric portion of `last`
 * is `'91.171'`. The range emit is `§91.167-91.171`.
 *
 * For non-numeric corpora (e.g. AIM `5-1-7`), the function returns `last`
 * unchanged so the comma-list path is the only safe fallback (handled by
 * `formatListText`'s caller via the `shape` flag).
 */
function stripCanonicalShortPrefix(first: string, last: string): string {
	// Find the first character that begins a digit run in `first`.
	const digitStart = first.search(/\d/);
	if (digitStart <= 0) return last;
	const prefix = first.slice(0, digitStart);
	if (last.startsWith(prefix)) return last.slice(prefix.length);
	return last;
}

// ---------------------------------------------------------------------------
// `@as-of`: pin literal
// ---------------------------------------------------------------------------

const TOKEN_AS_OF: Token = {
	name: '@as-of',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		return ctx.pin ?? '';
	},
};

// ---------------------------------------------------------------------------
// `@text` / `@quote`: indexed-tier content
// ---------------------------------------------------------------------------

const TOKEN_TEXT: Token = {
	name: '@text',
	kind: 'content',
	substitute(ctx: TokenContext): string {
		const idx = ctx.resolved.indexed;
		if (idx === null) return '[content unavailable]';
		return idx.normalizedText.trim();
	},
};

const TOKEN_QUOTE: Token = {
	name: '@quote',
	kind: 'content',
	substitute(ctx: TokenContext): string {
		const idx = ctx.resolved.indexed;
		if (idx === null) return '[content unavailable]';
		const body = idx.normalizedText.trim();
		const cite = entryCite(ctx.resolved);
		const quoted = body
			.split('\n')
			.map((line) => `> ${line}`)
			.join('\n');
		return cite.length > 0 ? `${quoted}\n>\n> -- ${cite}` : quoted;
	},
};

// ---------------------------------------------------------------------------
// `@last-amended`: SourceEntry.last_amended_date as ISO date string
// ---------------------------------------------------------------------------

const TOKEN_LAST_AMENDED: Token = {
	name: '@last-amended',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		const d = ctx.resolved.entry?.last_amended_date;
		if (d === undefined) return '';
		return d.toISOString().slice(0, 10);
	},
};

// ---------------------------------------------------------------------------
// `@deeplink`: per-corpus live URL (resolver-service is dropped per §10)
// ---------------------------------------------------------------------------

const TOKEN_DEEPLINK: Token = {
	name: '@deeplink',
	kind: 'identity',
	substitute(ctx: TokenContext): string {
		return ctx.resolved.liveUrl ?? '';
	},
};

// ---------------------------------------------------------------------------
// `@chapter` / `@subpart` / `@part`: containing-element titles via slug walk
// ---------------------------------------------------------------------------

/**
 * Walk up the entry's id path to find a parent whose `id` matches a path-prefix
 * test. The validator's row-1 corpus enumeration guarantees the slug structure
 * matches per-corpus convention; the resolver's `getChildren` is the inverse
 * walk. Here we walk one level up at a time and probe the registry.
 *
 * Returns null when the entry has no parent at the requested level.
 */
function walkParentEntry(
	resolved: ResolvedIdentifier,
	predicate: (entry: SourceEntry) => boolean,
	resolveById: (id: SourceId) => SourceEntry | null,
): SourceEntry | null {
	if (resolved.entry === null) return null;
	const stripped = stripPin(resolved.entry.id);
	const segs = stripped.split('/');
	// Walk parents: pop one segment at a time until the registry has an entry
	// matching the predicate, or we exhaust the path.
	for (let i = segs.length - 1; i > 1; i -= 1) {
		const parentSlug = segs.slice(0, i).join('/');
		const parent = resolveById(parentSlug as SourceId);
		if (parent !== null && predicate(parent)) return parent;
	}
	return null;
}

/** True when an entry's id signals a `subpart-X` segment. */
function isSubpartEntry(entry: SourceEntry): boolean {
	return entry.id.includes('/subpart-');
}

/**
 * Heuristic for "is this a Part-level entry": for `regs`, the locator after
 * `corpus/<title>` is exactly one segment (`<part-number>`). For `handbooks`,
 * the locator's first segment is the document slug; not a Part. We err on the
 * side of "match `regs`" since that's the only Phase 4 corpus with Part data.
 */
function isPartEntry(entry: SourceEntry): boolean {
	if (entry.corpus !== 'regs') return false;
	const stripped = stripPin(entry.id);
	const after = stripped.replace('airboss-ref:regs/', '');
	const segs = after.split('/');
	// `cfr-14/91` is two segments; `cfr-14/91/subpart-b` is three with subpart.
	return segs.length === 2;
}

/** Heuristic for "is this a Chapter-level entry" (handbooks). */
function isChapterEntry(entry: SourceEntry): boolean {
	if (entry.corpus !== 'handbooks') return false;
	// e.g. airboss-ref:handbooks/phak/8083-25C/12 -> chapter 12
	const stripped = stripPin(entry.id);
	const after = stripped.replace('airboss-ref:handbooks/', '');
	const segs = after.split('/');
	return segs.length === 3;
}

const TOKEN_CHAPTER: Token = {
	name: '@chapter',
	kind: 'derived',
	substitute(ctx: TokenContext): string {
		const parent = walkParentEntry(ctx.resolved, isChapterEntry, resolveStub);
		return parent?.canonical_title ?? '';
	},
};

const TOKEN_SUBPART: Token = {
	name: '@subpart',
	kind: 'derived',
	substitute(ctx: TokenContext): string {
		const parent = walkParentEntry(ctx.resolved, isSubpartEntry, resolveStub);
		return parent?.canonical_title ?? '';
	},
};

const TOKEN_PART: Token = {
	name: '@part',
	kind: 'derived',
	substitute(ctx: TokenContext): string {
		const parent = walkParentEntry(ctx.resolved, isPartEntry, resolveStub);
		return parent?.canonical_title ?? '';
	},
};

// ---------------------------------------------------------------------------
// Resolver indirection
// ---------------------------------------------------------------------------

/**
 * Indirection seam: parent-walk tokens use this to look up parent entries.
 * Production wires it to `resolveIdentifier` from `registry/query.ts`. Tests
 * can override via `__setResolveStub` to short-circuit registry lookups.
 */
const DEFAULT_RESOLVE: (id: SourceId) => SourceEntry | null = (id) => resolveIdentifier(id);
let resolveStub: (id: SourceId) => SourceEntry | null = DEFAULT_RESOLVE;

/**
 * Test-only seam: replace the resolver lookup. Production code MUST NOT call
 * this. The default delegates to `registry/query.ts#resolveIdentifier`.
 */
export function __setResolveStub(fn: (id: SourceId) => SourceEntry | null): void {
	resolveStub = fn;
}

/** Reset the resolver to its default production behavior. Test-only. */
export function __resetResolveStub(): void {
	resolveStub = DEFAULT_RESOLVE;
}

// ---------------------------------------------------------------------------
// Eager registration of the 12 default tokens per §3.1
// ---------------------------------------------------------------------------

const DEFAULT_TOKENS: readonly Token[] = [
	TOKEN_SHORT,
	TOKEN_FORMAL,
	TOKEN_TITLE,
	TOKEN_CITE,
	TOKEN_LIST,
	TOKEN_AS_OF,
	TOKEN_TEXT,
	TOKEN_QUOTE,
	TOKEN_LAST_AMENDED,
	TOKEN_DEEPLINK,
	TOKEN_CHAPTER,
	TOKEN_SUBPART,
	TOKEN_PART,
];

for (const tok of DEFAULT_TOKENS) {
	REGISTERED.set(tok.name, tok);
}

/**
 * Test-only: clear the registry and re-register the defaults. Useful when a
 * test has called `registerToken` and a later test in the same file expects
 * the default-only state.
 */
export const __token_internal__ = {
	resetToDefaults(): void {
		REGISTERED.clear();
		for (const tok of DEFAULT_TOKENS) {
			REGISTERED.set(tok.name, tok);
		}
	},
	listAll(): readonly TokenName[] {
		return Array.from(REGISTERED.keys()) as TokenName[];
	},
};

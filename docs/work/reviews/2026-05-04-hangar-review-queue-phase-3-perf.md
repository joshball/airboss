---
title: 'Phase 3 Performance Review: Hangar Review Queue'
reviewer: perf
date: 2026-05-04
diff: 642669cd...f7ec6c19
---

# Phase 3 Performance Review: Hangar Review Queue

## Summary

- Files reviewed: 8 (docs-tree, docs-search, layout/page/[..path] server loads, search.json endpoint, DocsSearchBox, FileTree)
- Critical: 2
- Major: 5
- Minor: 5
- Nit: 4

Phase 3 ships the right architectural pieces (Postgres FTS, a server-side tree builder, a debounced typeahead) but the implementation has several quantitative scale problems that bite at the actual data scale: 4821 markdown files across 577 directories, with single-file bodies up to 658 KB. The two critical issues are (a) `listDocsTree` walks the entire 577-directory tree on every `/docs/**` page request with no cache, and (b) the search endpoint has no `AbortController`, so superseded keystrokes still complete a full FTS query, race the live one, and clobber the result list out of order. Several other items are scale-fragile but tractable.

## Findings

### Critical

#### CRITICAL: `listDocsTree` walks 577 directories on every layout request

- **File**: `apps/hangar/src/routes/(app)/docs/+layout.server.ts:14`, `libs/bc/hangar/src/docs-tree.ts:41-92`
- **Problem**: The `/docs` layout calls `listDocsTree(REPO_ROOT)` from `+layout.server.ts` on every request. SvelteKit re-runs `+layout.server.ts` on every navigation under that layout (every file click in the tree triggers a navigation to `/docs/[...path]`), so each click re-walks all four roots. With 577 directories and 4821 files, that is one `readdir` + one `stat` per file per request. Even on a warm OS cache, this is several thousand syscalls per click of a tree node.
- **Why it matters**: Click-to-paint latency on a tree click compounds with the markdown read in the child route. The tree itself doesn't change between requests in a single session; this is pure waste. With 4821 files, the JSON payload returned to the browser is also large (every layout response embeds the full tree).
- **Fix**: Cache the result inside the BC module with a short TTL or a watched-mtime invalidation. Two concrete shapes:
  1. In-process memoization keyed by `repoRoot` with a 30-60 second TTL (set `cache?: { maxAgeMs: number }` so the loader can force-bust after a `runLoader` action).
  2. Or invalidate when `loadReviewItems` runs (the loader is the only writer to the docs corpus during a dev session). Add a `bustDocsTreeCache()` export and call it from `runLoader`.
  Bonus: parallelise the per-directory walk with `Promise.all` over `readdir` entries instead of the current serial `for...of`. Today every dir's `stat` calls block the next dir's `readdir`. With 577 dirs this is a cold-cache foot-gun.

#### CRITICAL: Search endpoint has no `AbortController` -- superseded requests race

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:34-53`, `apps/hangar/src/routes/(app)/docs/search.json/+server.ts:15-20`
- **Problem**: `runSearch` issues a `fetch` and stores the eventual response into `hits`. There is no `AbortController` and no request-id check. If the user types fast enough that two requests are in flight (debounce is 200 ms; FTS over a body up to 658 KB through `ts_headline` can easily exceed that under load), the slower-completing earlier request can land *after* the newer one, repopulating the popover with stale results. Each in-flight request also performs a full FTS scan + `ts_headline` over the matching corpus, server-side -- nothing is cancelled when a new keystroke supersedes the old one.
- **Why it matters**: Result list flicker / wrong content displayed for the visible query string is the canonical typeahead bug; on a slow connection or under load it is highly visible. Server-side, the redundant work amplifies load on the DB.
- **Fix**: Maintain an `AbortController` alongside the debounce timer. Cancel the prior controller on each new input event before starting the new fetch. Pass `signal: controller.signal` to `fetch`. Also consider gating the apply-to-state on a `requestId` counter so even a non-aborted in-flight response is dropped if a newer one started. The `+server.ts` endpoint will see the abort as a closed request; that's free server-side cancellation.

### Major

#### MAJOR: `ts_headline` runs against the full body -- including the 658 KB regulation files

- **File**: `libs/bc/hangar/src/docs-search.ts:60-67`
- **Problem**: `ts_headline('english', body, ...)` is called with the full `body` column. `ts_headline` is documented as expensive; its cost grows with body length. The corpus contains five `.md` files >200 KB and the largest is 658 KB. For matches in those files, every search call can spend seconds re-tokenising the body to render a snippet. Even on the smaller files, the cost is paid per row in the result, capped at `DOCS_SEARCH_LIMIT = 50`.
- **Why it matters**: A search hit that includes `course/firc/L01-FAA/references/part-91.md` will dominate request latency. The search is debounced to 200 ms, so the user expects sub-second feedback; large-body `ts_headline` blows that budget.
- **Fix**: Two options, pick one:
  1. Strip `ts_headline` to a prefixed body slice. Either store a `body_excerpt` column truncated to ~16 KB and headline against that, or pass `substring(body, 1, 16384)` inline. Snippet quality is not meaningfully worse for search hits when the body is large; the user clicks through to read the doc.
  2. Use `ShortWord=3, MaxFragments=2` you already have, but add `MaxWords=24` (already set) and lower the input via a CTE that pulls `substring(body, 1, 32768)` after the GIN-index match completes. Order is: GIN match -> rank -> top-N -> headline only on the survivors.
  Doing this also reduces the data volume that `ts_headline` must scan from megabytes to tens of kilobytes.

#### MAJOR: `ts_rank_cd` recomputed three times per row

- **File**: `libs/bc/hangar/src/docs-search.ts:68-72`
- **Problem**: The same expression `ts_rank_cd(${tsv}, plainto_tsquery('english', ${query}))` appears in the `select` projection AND the `orderBy` clause. Postgres will *not* CSE these into one evaluation across SELECT and ORDER BY in general; the planner re-evaluates the rank function. `plainto_tsquery('english', ${query})` is also called four times in the query (twice in select, once in where, once in order by) -- it is `IMMUTABLE` so the planner *can* fold it, but you're relying on that.
- **Why it matters**: At 50 rows it's noise; at the data scale (4821 rows) the WHERE filter selects relatively few, so the impact is small. But the pattern is the canonical FTS perf footgun and as bodies grow this cost shows.
- **Fix**: Move the `plainto_tsquery` call to a parameter. Cleaner: use a CTE / lateral join that computes `q := plainto_tsquery('english', $1)` once, then references `q` in WHERE, ORDER BY, headline, and rank. Drizzle supports this via a single `sql` block. Alternatively, since the order-by value is also in the projection, you can write `ORDER BY rank DESC` referencing the projection alias (Postgres allows this) and avoid one of the recomputations.

#### MAJOR: `+page.server.ts` for `[...path]` reads file from disk on every request -- index already has the body

- **File**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.server.ts:26-32`
- **Problem**: Every visit to `/docs/foo/bar.md` issues a `readFile(absPath, 'utf8')` against the filesystem. The same content is already in `hangar.docs_search_index.body`. There's no cache and no conditional-fetch (no ETag, no `If-Modified-Since`). For the largest 5-10 docs, the read is multi-hundred KB per click.
- **Why it matters**: Reading from disk is fine for an internal tool, but it is unnecessary: the loader has already stored the canonical bytes in Postgres. The fs read also re-runs `parseFrontmatter` on every request when the parsed entries are deterministic. With navigation between docs being the primary interaction, this is the hottest server path on the page.
- **Fix**: Either (a) read body+frontmatter from `hangar.docs_search_index` (one indexed lookup by `path` PK, much cheaper than a syscall + parse), or (b) memoize `parseFrontmatter(raw)` on the (path, mtime) tuple. Option (a) also gives you a single source of truth and aligns with the spec's "frontmatter is authoritative + DB caches it" model.

#### MAJOR: `renderMarkdown` runs on the client on every navigation

- **File**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:9`
- **Problem**: `bodyHtml` is computed via `$derived(rewriteDocsLinks(renderMarkdown(data.body), data.repoRelPath))`. `renderMarkdown` is a 990-line markdown engine that runs in the browser bundle. For every `/docs/[...path]` navigation, the client re-parses the full body (potentially 658 KB) every time `data.body` changes. The same parse happens on the server during SSR, so we are doing it twice for the initial load.
- **Why it matters**: `renderMarkdown` is included in the client bundle for `/docs`, inflating it. Per-navigation parse cost on a 200 KB+ body is visibly slow on lower-end laptops.
- **Fix**: Render markdown server-side once in `+page.server.ts`, return `bodyHtml` (and the rewritten links). The page becomes a pass-through: `{@html data.bodyHtml}`. This drops the renderer from the client bundle entirely (it's only imported through the page) and eliminates the duplicate parse. Caveat: server-side link rewriting needs the same string contract; it's the same code path so no behavioural change.

#### MAJOR: FileTree state mutates `Set` reference identity on every toggle

- **File**: `libs/ui/src/components/FileTree.svelte:48-92`
- **Problem**: `openDirs` is a `$state<Set<string>>`. On every toggle the code allocates a fresh `Set` (`new Set(openDirs)`), mutates it, and assigns. With deeply nested trees, the recursive `renderNode` snippet calls `isOpen(node.path)` for every visible directory on every state change -- 577 dirs total, with the open ones rendering all their children. Each `isOpen` call inside the snippet creates a `$derived`-style read of `openDirs` (via `Set.has`), so the recursive component graph re-renders the entire tree on every toggle.
- **Why it matters**: Tree expand-collapse feels sticky on a tree this size. The cost is `O(visible-nodes)` per toggle, which is the right complexity, but the constant factor is high because every node re-evaluates `isOpen`.
- **Fix**: Two cheap wins:
  1. Switch `openDirs` to a `$state.raw<Set<string>>(new Set())`, since the Set's identity changes (no granular subfields are tracked anyway). This skips proxying.
  2. Localise the `aria-expanded`/children visibility inside each `<li>` to a small wrapper component that reads only its own path's open-state via a callback prop `isOpen={(p) => openDirs.has(p)}`. Or pre-compute `openSet: ReadonlySet<string>` once per render and pass it down.
  Also: persist on a debounce / `requestIdleCallback` -- the JSON.stringify and localStorage write run synchronously inside every `toggleDir` call.

### Minor

#### MINOR: Layout response embeds the full tree on every request

- **File**: `apps/hangar/src/routes/(app)/docs/+layout.server.ts:12-16`, `libs/bc/hangar/src/docs-tree.ts`
- **Problem**: The full file tree (4821 nodes, 577 dirs) is JSON-serialised and shipped to the client on every page in `/docs/**`. Even compressed, this is a meaningful payload tax for every navigation.
- **Why it matters**: Time-to-interactive on `/docs/[...path]` includes downloading a tree the user mostly already has. On a slow connection it will dominate.
- **Fix**: Combine with the cache fix (CRITICAL #1). Once cached server-side, also let the client cache it: serve the tree via a separate JSON endpoint that the layout fetches once on first navigation, with `cache-control: private, max-age=60`. The `/docs/**` layout return can be slim ("cached on the client") and only the top-level `/docs` first paint pulls the tree down. SvelteKit pattern: an islanded `+layout.ts` that fetches `/docs/tree.json` and caches in module scope.

#### MINOR: `parent()` not used by child `+page.server.ts` -- layout + page run sequentially per request

- **File**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.server.ts:20-40`
- **Problem**: SvelteKit runs `+layout.server.ts` and `+page.server.ts` in parallel by default; child loads only block on `parent()` if explicitly called. That's fine here. However, `+page.server.ts`'s heavy work (fs read + frontmatter parse) currently fights with the layout's heavy work (full tree walk) for CPU/IO during the same request -- both are `await`ed in parallel. Combined with CRITICAL #1, every navigation incurs 4821 `stat` calls + a multi-hundred-KB file read concurrently.
- **Why it matters**: This compounds the other issues -- not novel on its own.
- **Fix**: Resolved by fixing CRITICAL #1. Once the tree is cached, the page load is just the file read.

#### MINOR: `rewriteDocsLinks` regex walks every `href` in HTML on every navigation

- **File**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:23-35`
- **Problem**: `html.replace(/href="([^"]+)"/g, ...)` walks the full rendered HTML, allocating per match. For a 658 KB body the rendered HTML can be larger; the regex walk is `O(html-length)` and runs in the client `$derived`.
- **Why it matters**: Once `renderMarkdown` is moved server-side (MAJOR #4), this rewrite is on the same server side and runs once at SSR, not per-navigation in the client.
- **Fix**: Move with `renderMarkdown` to the server. Same fix.

#### MINOR: `countDocsIndex` unbounded `count(*)::int` is fine today, but the Promise.all on `+page.server.ts` blocks layout

- **File**: `apps/hangar/src/routes/(app)/docs/+page.server.ts:21`
- **Problem**: The `/docs` index page does `Promise.all([readNow(), countDocsIndex()])`. `countDocsIndex` is a full table scan (`count(*)::int`) over the FTS index. With 4821 rows it's instant; at 100k+ rows it would matter. Not actually a concern at current scale -- flagged as a watch-item.
- **Why it matters**: The bigger smell is the "empty index" message uses `indexCount === 0` rather than a cheaper `EXISTS (SELECT 1 ...)`. `count(*)` is the fastest path Postgres knows for this exact question, so this is fine; the EXISTS would not actually win here.
- **Fix**: No change needed at current scale. Worth a comment noting "swap to `EXISTS` if the index grows past 1M rows."

#### MINOR: `localStorage` write runs on every directory toggle, synchronously

- **File**: `libs/ui/src/components/FileTree.svelte:80-85`
- **Problem**: `JSON.stringify([...next])` followed by `setItem` runs on every toggle. With many open dirs the serialised string grows. Synchronous localStorage writes block the main thread.
- **Why it matters**: Imperceptible at typical scale; the annoyance is layered with the FileTree re-render cost (MAJOR #5).
- **Fix**: Throttle/debounce the persist call (e.g. `requestIdleCallback` with a setTimeout fallback). State stays in memory, persisted on idle.

### Nit

#### NIT: `runSearch` payload not bounded on the response side

- **File**: `apps/hangar/src/routes/(app)/docs/search.json/+server.ts:15-20`
- **Problem**: The endpoint returns `{ hits }`. `searchDocs` already enforces `DOCS_SEARCH_LIMIT = 50`, but each hit includes a `snippet` from `ts_headline` that can be ~500 chars; total payload tops out near 25 KB. Fine, but no `cache-control` header is set, so a repeat search for the same query re-hits the DB.
- **Why it matters**: Trivial -- typeahead queries are rarely repeated identically.
- **Fix**: Set `cache-control: private, max-age=10` on the JSON response. Browsers will reuse the response within the debounce-burst window.

#### NIT: Empty-query branch in `runSearch` clears `hits` but keeps the popover open

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:35-38`
- **Problem**: When the user clears the input, the early-return sets `hits = []` but doesn't reset `loading` (already false here) or close `open`. The popover then renders the "No matches" branch incorrectly.
- **Why it matters**: UX bug, not perf. Flagged because it pairs with CRITICAL #2 (cancel + close on empty).
- **Fix**: Set `open = false` in the empty-query branch, clear any pending `debounceTimer`.

#### NIT: `$derived` on `data.tree as ReadonlyArray<FileTreeNode>` is a no-op cast

- **File**: `apps/hangar/src/routes/(app)/docs/+layout.svelte:17`
- **Problem**: Wrapping a type cast in `$derived` triggers re-evaluation on every `data` access but produces no actual derivation.
- **Why it matters**: Trivial.
- **Fix**: Either drop the `$derived` wrapper (`const tree = data.tree as ReadonlyArray<FileTreeNode>;` reads on every render anyway), or add a real derivation (e.g. tree-pruning under the active path). Minor cleanup.

#### NIT: `DOCS_SEARCH_MAX_LEN` is hardcoded inside `docs-search.ts` instead of `libs/constants`

- **File**: `libs/bc/hangar/src/docs-search.ts:26`
- **Problem**: A literal `200` for the input clamp lives in the BC module, not in `libs/constants/src/review.ts`. Project rule: all literal values in `libs/constants/`.
- **Why it matters**: Code-quality / consistency rather than perf.
- **Fix**: Move to `libs/constants/src/review.ts` next to `DOCS_SEARCH_LIMIT` / `DOCS_SEARCH_DEBOUNCE_MS`. Naming: `DOCS_SEARCH_MAX_QUERY_LEN`.

## Areas verified clean

- **GIN index over `tsv`**: `hangar_docs_search_tsv_idx` is declared correctly in `libs/bc/hangar/src/schema.ts:783-785`, GIN over the generated `tsv` column. The `WHERE tsv @@ plainto_tsquery(...)` shape will use it.
- **Result limit enforcement**: `searchDocs` clamps to `min(options.limit ?? DOCS_SEARCH_LIMIT, DOCS_SEARCH_LIMIT) = 50`. Cannot be blown out by a caller.
- **Empty-query short-circuit**: `searchDocs` early-returns `[]` for an empty trimmed query before any DB round-trip (line 50 of `docs-search.ts`).
- **Path traversal pre-check is constant-time**: `isDocsPathAllowed` is a pure-string predicate, no fs syscalls.
- **No `parent()` cycles**: `+layout.server.ts` and child `+page.server.ts` do not call each other; they run in parallel as SvelteKit defaults expect.
- **No new client deps**: Phase 3 added zero `package.json` entries (verified via `git diff 642669cd...f7ec6c19 -- 'apps/hangar/package.json' '*/package.json'`). No bundle bloat from third-party libs.
- **Auth on the JSON endpoint**: `search.json/+server.ts` re-checks `requireRole`. No fast-path bypass.
- **Debounce timer lifecycle**: `clearTimeout` is called before installing a new timer in `onInput` (DocsSearchBox:61). No timer leak on rapid typing.
- **`ts_headline` highlight tag set**: Configured to `<mark>...</mark>`, predictable shape for the client `{@html}` render.

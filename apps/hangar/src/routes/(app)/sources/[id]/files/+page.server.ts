/**
 * /sources/[id]/files -- filesystem browser for a source's binary + archives.
 *
 * Lists every file under `data/sources/<type>/` whose name starts with
 * `<sourceId>.` or `<sourceId>@`. Preview payloads are rendered client-side
 * (XML/JSON/CSV/Markdown/PDF/text) keyed on extension.
 *
 * Admin-only delete is handled via the `delete` form action; the detail
 * pages display the affordance only to users with ROLES.ADMIN.
 */

import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { getSource, REPO_ROOT } from '@ab/bc-hangar';
import {
	EXTENSION_TO_PREVIEW_KIND,
	PREVIEW_KINDS,
	type PreviewKind,
	type ReferenceSourceType,
	ROLES,
	ROUTES,
	SOURCE_KIND_BY_TYPE,
	SOURCE_KINDS,
} from '@ab/constants';
import { MarkdownParseError, type MdNode, parseMarkdown } from '@ab/help';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-files');

/** Maximum bytes we'll load into the preview payload for text-y files. */
const MAX_PREVIEW_BYTES = 256 * 1024;

export interface FileEntry {
	name: string;
	/** Lowercase extension with no leading dot (e.g. `zip`, `tif`). Empty when the file has no extension. */
	extension: string;
	sizeBytes: number;
	mtime: string;
	previewKind: PreviewKind;
	previewText: string | null;
	/**
	 * Pre-parsed Markdown AST. Populated server-side for `previewKind === MARKDOWN`
	 * because `parseMarkdown` is async (it calls Shiki for code-block highlight)
	 * and the MarkdownBody primitive expects nodes, not raw text.
	 */
	markdownNodes: MdNode[] | null;
	isArchive: boolean;
}

function extensionOf(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === filename.length - 1) return '';
	return filename.slice(lastDot + 1).toLowerCase();
}

function isInsideRoot(candidate: string, root: string): boolean {
	const rel = candidate.startsWith(`${root}/`) || candidate === root;
	return rel;
}

async function buildEntry(full: string, displayName: string, isArchive: boolean): Promise<FileEntry> {
	const s = await stat(full);
	const ext = extensionOf(displayName);
	const previewKind = EXTENSION_TO_PREVIEW_KIND[ext] ?? PREVIEW_KINDS.BINARY;
	let previewText: string | null = null;
	let markdownNodes: MdNode[] | null = null;
	const isTextLike =
		previewKind !== PREVIEW_KINDS.BINARY &&
		previewKind !== PREVIEW_KINDS.PDF &&
		previewKind !== PREVIEW_KINDS.GEOTIFF &&
		previewKind !== PREVIEW_KINDS.JPEG &&
		previewKind !== PREVIEW_KINDS.ZIP;
	if (isTextLike && s.size <= MAX_PREVIEW_BYTES) {
		try {
			previewText = await readFile(full, 'utf8');
		} catch {
			previewText = null;
		}
	}
	if (previewKind === PREVIEW_KINDS.MARKDOWN && previewText !== null) {
		try {
			markdownNodes = await parseMarkdown(previewText);
		} catch (err) {
			// Surface parse failures in the log but keep `previewText` so the
			// dispatcher can fall back to the plain `<pre>` renderer.
			log.warn('markdown preview parse failed', {
				file: displayName,
				err: err instanceof MarkdownParseError ? err.message : err instanceof Error ? err.message : String(err),
			});
			markdownNodes = null;
		}
	}
	return {
		name: displayName,
		extension: ext,
		sizeBytes: s.size,
		mtime: s.mtime.toISOString(),
		previewKind,
		previewText,
		markdownNodes,
		isArchive,
	};
}

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const source = await getSource(event.params.id);
	if (!source) throw error(404, `source '${event.params.id}' not found`);
	const kind = SOURCE_KIND_BY_TYPE[source.type as ReferenceSourceType] ?? SOURCE_KINDS.TEXT;
	const sourcesRoot = resolve(REPO_ROOT, 'data', 'sources');

	let entries: FileEntry[] = [];
	let dirDisplay: string;

	if (kind === SOURCE_KINDS.BINARY_VISUAL) {
		// Binary-visual layout: data/sources/<type>/<id>/<edition>/{chart.zip, thumb.jpg, meta.json}
		// Each edition directory becomes a section prefix in the displayed name.
		const sourceRoot = resolve(REPO_ROOT, 'data', 'sources', source.type, source.id);
		dirDisplay = `data/sources/${source.type}/${source.id}`;
		try {
			const editions = await readdir(sourceRoot, { withFileTypes: true });
			const editionDirs = editions.filter((e) => e.isDirectory()).map((e) => e.name);
			editionDirs.sort().reverse(); // newest edition first
			const collected: FileEntry[] = [];
			for (const ed of editionDirs) {
				const edPath = resolve(sourceRoot, ed);
				if (!isInsideRoot(edPath, sourcesRoot)) {
					throw new Error(`path escape detected: ${edPath}`);
				}
				const files = await readdir(edPath);
				files.sort();
				for (const file of files) {
					const full = resolve(edPath, file);
					if (!isInsideRoot(full, sourcesRoot)) continue;
					const isArchive = ed.includes('@archived-');
					const display = `${ed}/${file}`;
					collected.push(await buildEntry(full, display, isArchive));
				}
			}
			entries = collected;
		} catch (err) {
			log.warn(`failed to scan ${sourceRoot}`, {
				sourceId: source.id,
				err: err instanceof Error ? err.message : err,
			});
			entries = [];
		}
	} else {
		const dir = resolve(REPO_ROOT, 'data', 'sources', source.type);
		dirDisplay = `data/sources/${source.type}`;
		try {
			const names = await readdir(dir);
			const prefix1 = `${source.id}.`;
			const prefix2 = `${source.id}@`;
			const ownedNames = names.filter((name) => name.startsWith(prefix1) || name.startsWith(prefix2));

			entries = await Promise.all(
				ownedNames.sort().map(async (name): Promise<FileEntry> => {
					const full = resolve(dir, name);
					// Guard against symlink escapes.
					if (!isInsideRoot(full, sourcesRoot)) {
						throw new Error(`path escape detected: ${full}`);
					}
					return buildEntry(full, name, name.startsWith(prefix2));
				}),
			);
		} catch (err) {
			log.warn(`failed to scan ${dir}`, { sourceId: source.id, err: err instanceof Error ? err.message : err });
			entries = [];
		}
	}

	return {
		source: {
			id: source.id,
			type: source.type,
			title: source.title,
			sourceKind: kind,
			sizeBytes: source.sizeBytes,
			checksum: source.checksum,
			downloadedAt: source.downloadedAt,
			media: source.media,
			edition: source.edition,
		},
		user: { id: user.id, role: user.role },
		isAdmin: user.role === ROLES.ADMIN,
		dir: dirDisplay,
		entries,
	};
};

// Suppress unused-import for `relative` which is kept for symmetry if later
// features display relative paths directly.
void relative;

export const actions: Actions = {
	delete: async (event) => {
		const user = requireRole(event, ROLES.ADMIN);
		const form = await event.request.formData();
		const name = form.get('name');
		if (typeof name !== 'string' || name.length === 0) {
			return fail(400, { error: 'missing name' });
		}
		// Filename may only contain the source-scoped characters. Anything with a
		// slash is a path-escape attempt; reject before touching the fs.
		if (name.includes('/') || name.includes('\\') || name.includes('..')) {
			return fail(400, { error: 'invalid filename' });
		}
		const source = await getSource(event.params.id);
		if (!source) return fail(404, { error: 'source not found' });

		// Never allow deleting the primary binary; only archived versions.
		if (!name.startsWith(`${source.id}@`)) {
			return fail(400, { error: 'only archived versions may be deleted here' });
		}
		const dir = resolve(REPO_ROOT, 'data', 'sources', source.type);
		const full = resolve(dir, name);
		if (dirname(full) !== dir) {
			return fail(400, { error: 'path escape' });
		}
		try {
			await unlink(full);
		} catch (err) {
			log.error(
				'archive delete failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'delete failed' });
		}
		redirect(303, ROUTES.HANGAR_SOURCE_FILES(event.params.id));
	},
};

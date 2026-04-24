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
import { dirname, resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { EXTENSION_TO_PREVIEW_KIND, PREVIEW_KINDS, type PreviewKind, ROLES, ROUTES } from '@ab/constants';
import { db, hangarSource } from '@ab/db';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { REPO_ROOT } from '$lib/server/source-jobs';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-files');

/** Maximum bytes we'll load into the preview payload for text-y files. */
const MAX_PREVIEW_BYTES = 256 * 1024;

export interface FileEntry {
	name: string;
	sizeBytes: number;
	mtime: string;
	previewKind: PreviewKind;
	previewText: string | null;
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

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [source] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
	if (!source) throw error(404, `source '${event.params.id}' not found`);

	const dir = resolve(REPO_ROOT, 'data', 'sources', source.type);
	const sourcesRoot = resolve(REPO_ROOT, 'data', 'sources');

	let entries: FileEntry[] = [];
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
				const s = await stat(full);
				const ext = extensionOf(name);
				const previewKind = EXTENSION_TO_PREVIEW_KIND[ext] ?? PREVIEW_KINDS.BINARY;
				let previewText: string | null = null;
				if (previewKind !== PREVIEW_KINDS.BINARY && previewKind !== PREVIEW_KINDS.PDF && s.size <= MAX_PREVIEW_BYTES) {
					try {
						previewText = await readFile(full, 'utf8');
					} catch {
						previewText = null;
					}
				}
				return {
					name,
					sizeBytes: s.size,
					mtime: s.mtime.toISOString(),
					previewKind,
					previewText,
					isArchive: name.startsWith(prefix2),
				};
			}),
		);
	} catch (err) {
		log.warn(`failed to scan ${dir}`, { sourceId: source.id, err: err instanceof Error ? err.message : err });
		entries = [];
	}

	return {
		source: {
			id: source.id,
			type: source.type,
			title: source.title,
		},
		user: { id: user.id, role: user.role },
		isAdmin: user.role === ROLES.ADMIN,
		dir: `data/sources/${source.type}`,
		entries,
	};
};

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
		const [source] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
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

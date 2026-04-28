/**
 * Read per-handbook metadata from the Python side via subprocess JSON.
 *
 * The Python module `ingest.discovery_meta` knows about plugin-side regex
 * patterns and YAML-side `errata:` / `dismissed_errata:` lists; it emits
 * one JSON document on stdout. The TS dispatcher reads that document and
 * uses the applied/dismissed lists to merge state idempotently.
 *
 * Subprocess JSON is the existing TS<->Python boundary in this repo; FFI
 * would be a heavy precedent for one new caller (see design.md).
 *
 * Future: hangar UI wraps this command via dispatcher.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve relative paths via `import.meta.url` so the module loads under both
// Bun (where `import.meta.dir` exists) and the Vitest node runtime (where it
// does not). `fileURLToPath` is the standard ESM helper.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const TOOL_DIR = join(REPO_ROOT, 'tools/handbook-ingest');
const VENV_PYTHON = join(TOOL_DIR, '.venv/bin/python');

export interface AppliedRecord {
	readonly url: string;
	readonly errataId: string;
}

export interface DismissedRecord {
	readonly url: string | null;
	readonly sha256: string | null;
	readonly reason: string;
}

export interface HandbookDiscoveryMeta {
	readonly slug: string;
	readonly hasPlugin: boolean;
	readonly hasYaml: boolean;
	readonly discoveryUrl: string | null;
	readonly linkPatterns: readonly string[];
	readonly applied: readonly AppliedRecord[];
	readonly dismissed: readonly DismissedRecord[];
}

export class PythonMetaError extends Error {}

interface RawMeta {
	slug?: unknown;
	has_plugin?: unknown;
	has_yaml?: unknown;
	discovery_url?: unknown;
	link_patterns?: unknown;
	applied?: unknown;
	dismissed?: unknown;
}

interface RawApplied {
	url?: unknown;
	errata_id?: unknown;
}

interface RawDismissed {
	url?: unknown;
	sha256?: unknown;
	reason?: unknown;
}

export interface ReadMetaOptions {
	readonly slugs?: readonly string[];
	readonly pythonBin?: string;
}

export async function readPythonDiscoveryMeta(opts: ReadMetaOptions = {}): Promise<readonly HandbookDiscoveryMeta[]> {
	const pythonBin = opts.pythonBin ?? (existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');
	const args = ['-m', 'ingest.discovery_meta', ...(opts.slugs ?? [])];
	const proc = Bun.spawn([pythonBin, ...args], {
		cwd: TOOL_DIR,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
	const code = await proc.exited;
	if (code !== 0) {
		throw new PythonMetaError(`ingest.discovery_meta exited ${code}; stderr: ${stderr.trim()}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(stdout);
	} catch (error) {
		throw new PythonMetaError(
			`failed to parse discovery_meta JSON: ${describe(error)}; stdout was: ${stdout.slice(0, 500)}`,
		);
	}
	return parseMetaPayload(parsed);
}

export function parseMetaPayload(raw: unknown): readonly HandbookDiscoveryMeta[] {
	if (typeof raw !== 'object' || raw === null) {
		throw new PythonMetaError('discovery_meta payload: top-level must be an object');
	}
	const handbooks = (raw as { handbooks?: unknown }).handbooks;
	if (!Array.isArray(handbooks)) {
		throw new PythonMetaError('discovery_meta payload: missing `handbooks` array');
	}
	return handbooks.map((entry, idx) => parseEntry(entry, `handbooks[${idx}]`));
}

function parseEntry(value: unknown, path: string): HandbookDiscoveryMeta {
	if (typeof value !== 'object' || value === null) {
		throw new PythonMetaError(`${path}: must be an object`);
	}
	const raw = value as RawMeta;
	const slug = ensureString(raw.slug, `${path}.slug`);
	const hasPlugin = Boolean(raw.has_plugin);
	const hasYaml = Boolean(raw.has_yaml);
	const discoveryUrl =
		raw.discovery_url === null || raw.discovery_url === undefined
			? null
			: ensureString(raw.discovery_url, `${path}.discovery_url`);
	const linkPatterns = Array.isArray(raw.link_patterns)
		? raw.link_patterns.map((p, i) => ensureString(p, `${path}.link_patterns[${i}]`))
		: [];
	const applied = Array.isArray(raw.applied) ? raw.applied.map((a, i) => parseApplied(a, `${path}.applied[${i}]`)) : [];
	const dismissed = Array.isArray(raw.dismissed)
		? raw.dismissed.map((d, i) => parseDismissed(d, `${path}.dismissed[${i}]`))
		: [];
	return { slug, hasPlugin, hasYaml, discoveryUrl, linkPatterns, applied, dismissed };
}

function parseApplied(value: unknown, path: string): AppliedRecord {
	if (typeof value !== 'object' || value === null) {
		throw new PythonMetaError(`${path}: must be an object`);
	}
	const raw = value as RawApplied;
	return {
		url: ensureString(raw.url, `${path}.url`),
		errataId: ensureString(raw.errata_id, `${path}.errata_id`),
	};
}

function parseDismissed(value: unknown, path: string): DismissedRecord {
	if (typeof value !== 'object' || value === null) {
		throw new PythonMetaError(`${path}: must be an object`);
	}
	const raw = value as RawDismissed;
	return {
		url: raw.url === null || raw.url === undefined ? null : ensureString(raw.url, `${path}.url`),
		sha256: raw.sha256 === null || raw.sha256 === undefined ? null : ensureString(raw.sha256, `${path}.sha256`),
		reason: typeof raw.reason === 'string' ? raw.reason : '',
	};
}

function ensureString(value: unknown, path: string): string {
	if (typeof value !== 'string') {
		throw new PythonMetaError(`${path}: must be a string`);
	}
	return value;
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

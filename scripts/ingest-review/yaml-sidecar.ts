#!/usr/bin/env bun

/**
 * Shared YAML sidecar serialise / parse helpers for the
 * `bun scripts/ingest-review/{import,export}-overrides.ts` flows.
 *
 * The sidecar shape is documented in
 * `docs/work-packages/hangar-ingest-review-queue/design.md` (YAML sidecar
 * shape). One file per source: `<slug>-overrides.yaml`.
 *
 * Stability contract: `serializeSidecar` is byte-stable across runs given
 * the same input. The export script depends on this for
 * `bun scripts/ingest-review/export-overrides.ts` to be idempotent
 * (success criterion #2 in spec.md).
 */

import type { YamlSidecar, YamlSidecarEntry } from '@ab/bc-ingest-review';
import {
	INGEST_ISSUE_KIND_VALUES,
	INGEST_OVERRIDE_ACTION_VALUES,
	type IngestIssueKind,
	type IngestOverrideAction,
} from '@ab/constants';
import { parse as yamlParse } from 'yaml';

/** Two-space indent, sorted keys, single trailing newline. */
const INDENT = '  ';

export class YamlSidecarParseError extends Error {
	readonly code = 'INGEST_YAML_PARSE_ERROR';
	constructor(message: string) {
		super(message);
		this.name = 'YamlSidecarParseError';
	}
}

/**
 * Header comment block prepended to every emitted sidecar. The
 * placeholder `${slug}` and `${edition}` are filled at render time;
 * downstream tooling treats the block as opaque (the YAML parser
 * silently drops comments on round-trip).
 */
function renderHeader(slug: string, edition: string | null): string {
	const editionLabel = edition ? ` (${edition})` : '';
	return [
		`# Manual ingest overrides for ${slug.toUpperCase()}${editionLabel}.`,
		'#',
		'# Authored via the hangar /ingest-review queue and exported with',
		`# \`bun scripts/ingest-review/export-overrides.ts --corpus handbook --source ${slug}\`.`,
		'# Read by tools/handbook-ingest/ingest/figures.py during re-extraction.',
		'',
	].join('\n');
}

/**
 * Render one override entry as a YAML block. Sorted keys, two-space
 * indent. Empty payloads emit `payload: {}` for symmetry across actions.
 */
function renderEntry(entry: YamlSidecarEntry): string {
	const lines: string[] = [];
	lines.push(`${INDENT}- external_id: ${stringScalar(entry.external_id)}`);
	lines.push(`${INDENT}${INDENT}kind: ${stringScalar(entry.kind)}`);
	lines.push(`${INDENT}${INDENT}action: ${stringScalar(entry.action)}`);
	const payloadKeys = Object.keys(entry.payload).sort();
	if (payloadKeys.length === 0) {
		lines.push(`${INDENT}${INDENT}payload: {}`);
	} else {
		lines.push(`${INDENT}${INDENT}payload:`);
		for (const key of payloadKeys) {
			const value = entry.payload[key];
			lines.push(`${INDENT}${INDENT}${INDENT}${key}: ${scalar(value)}`);
		}
	}
	return lines.join('\n');
}

/**
 * Render a whole sidecar to a stable byte sequence. Entries sort by
 * `(external_id)` so the file's row order is deterministic regardless of
 * what order they came out of the DB.
 */
export function serializeSidecar(input: {
	slug: string;
	edition: string | null;
	overrides: readonly YamlSidecarEntry[];
}): string {
	const sortedEntries = [...input.overrides].sort((a, b) => a.external_id.localeCompare(b.external_id));
	const header = renderHeader(input.slug, input.edition);
	const body =
		sortedEntries.length === 0 ? 'overrides: []' : ['overrides:', ...sortedEntries.map(renderEntry)].join('\n');
	return `${header}${body}\n`;
}

/**
 * Parse a sidecar's text. Empty file or comments-only file -> empty
 * overrides. Malformed YAML or unknown kinds / actions throw a typed
 * error.
 */
export function parseSidecar(text: string): YamlSidecar {
	let parsed: unknown;
	try {
		parsed = yamlParse(text);
	} catch (err) {
		const cause = err instanceof Error ? err.message : String(err);
		throw new YamlSidecarParseError(`malformed sidecar YAML: ${cause}`);
	}
	if (parsed === null || parsed === undefined) {
		return { overrides: [] };
	}
	if (typeof parsed !== 'object') {
		throw new YamlSidecarParseError(`sidecar root must be an object, got ${typeof parsed}`);
	}
	const root = parsed as Record<string, unknown>;
	const rawOverrides = root.overrides;
	if (rawOverrides === undefined || rawOverrides === null) {
		return { overrides: [] };
	}
	if (!Array.isArray(rawOverrides)) {
		throw new YamlSidecarParseError('sidecar `overrides` must be a list');
	}
	const out: YamlSidecarEntry[] = [];
	for (const [i, raw] of rawOverrides.entries()) {
		if (typeof raw !== 'object' || raw === null) {
			throw new YamlSidecarParseError(`overrides[${i}]: expected an object`);
		}
		const r = raw as Record<string, unknown>;
		if (typeof r.external_id !== 'string' || r.external_id.length === 0) {
			throw new YamlSidecarParseError(`overrides[${i}]: external_id must be a non-empty string`);
		}
		if (typeof r.kind !== 'string' || !(INGEST_ISSUE_KIND_VALUES as readonly string[]).includes(r.kind)) {
			throw new YamlSidecarParseError(`overrides[${i}]: kind '${String(r.kind)}' is not in INGEST_ISSUE_KIND_VALUES`);
		}
		if (typeof r.action !== 'string' || !(INGEST_OVERRIDE_ACTION_VALUES as readonly string[]).includes(r.action)) {
			throw new YamlSidecarParseError(
				`overrides[${i}]: action '${String(r.action)}' is not in INGEST_OVERRIDE_ACTION_VALUES`,
			);
		}
		const payload = r.payload ?? {};
		if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
			throw new YamlSidecarParseError(`overrides[${i}]: payload must be an object`);
		}
		out.push({
			external_id: r.external_id,
			kind: r.kind as IngestIssueKind,
			action: r.action as IngestOverrideAction,
			payload: payload as Record<string, unknown>,
		});
	}
	return { overrides: out };
}

function stringScalar(value: string): string {
	// Quote when the string would otherwise be ambiguous: contains a
	// colon followed by space, leading/trailing whitespace, or special
	// YAML indicators. The handbook external_ids are hex; quoting is
	// rare but the helper is conservative.
	if (value.length === 0) return '""';
	if (/^[A-Za-z0-9_./-]+$/.test(value)) return value;
	const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `"${escaped}"`;
}

function scalar(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (typeof value === 'string') return stringScalar(value);
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) {
		// Inline-flow array of scalars; no plugin emits a nested object today.
		const parts = value.map((v) => scalar(v));
		return `[${parts.join(', ')}]`;
	}
	// Object payloads are flattened by the renderer; this path should not
	// hit for a well-formed entry. Stringify defensively.
	return JSON.stringify(value);
}

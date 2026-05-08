#!/usr/bin/env bun
/**
 * Build the knowledge-graph DB from `course/knowledge/**\/node.md`.
 *
 * Parses each node file (YAML frontmatter + H2 phase body), validates the
 * graph (membership checks, cycle detection in `requires`, edge resolution),
 * and upserts nodes + edges into Postgres. Validation is all-or-nothing: a
 * single invalid node fails the whole build and leaves the DB untouched.
 *
 * Flags:
 *   --dry-run           validate only; no DB writes
 *   --json              emit a machine-readable build summary on stdout
 *   --fail-on-coverage  exit non-zero if any node is lifecycle=skeleton
 *
 * Exit codes:
 *   0  success
 *   1  validation error, IO error, or coverage failure
 *
 * The build never mutates markdown. `course/knowledge/graph-index.md` is
 * author-facing output; it's rewritten in-place on each successful build.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { SIM_SCENARIO_NODE_MAPPINGS } from '@ab/constants/sim';
import {
	CERT_VALUES,
	DOMAIN_LABELS,
	KNOWLEDGE_EDGE_TYPES,
	KNOWLEDGE_EDGE_YAML_KEYS,
	KNOWLEDGE_PHASE_LABELS,
	KNOWLEDGE_PHASE_ORDER,
	type KnowledgeEdgeType,
	NODE_LIFECYCLES,
	type NodeLifecycle,
	STUDY_PRIORITY_VALUES,
} from '@ab/constants/study';
import type { ParsedIdentifier, ValidationFinding } from '@ab/sources';
import {
	type CitationSentinel,
	type SentinelField,
	validateRedirectedFrom,
	validateSentinelFieldName,
} from '@ab/sources/sentinels.ts';
import { parse as parseYaml } from 'yaml';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
	dryRun: boolean;
	json: boolean;
	failOnCoverage: boolean;
}

function parseArgs(argv: readonly string[]): Args {
	const args: Args = { dryRun: false, json: false, failOnCoverage: false };
	for (const a of argv) {
		if (a === '--dry-run') args.dryRun = true;
		else if (a === '--json') args.json = true;
		else if (a === '--fail-on-coverage') args.failOnCoverage = true;
		else {
			// eslint-disable-next-line no-console
			console.error(`build-knowledge: unknown flag '${a}'`);
			process.exit(1);
		}
	}
	return args;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Legacy free-text citation shape per ADR 019 amendment 2026-05 step 4.
 *
 * The amendment graduates this to ERROR in step 8 once the migration review
 * queue (`course/knowledge/.migration-review.md`) closes with zero residual
 * legacy citations. Today it parses with WARNING so the build flags every
 * un-migrated row.
 */
interface LegacyParsedReference {
	readonly shape: 'legacy';
	readonly source: string;
	readonly detail: string;
	readonly note: string;
}

/**
 * Structured citation shape per ADR 019 amendment 2026-05 §2 and the
 * migration-script proposed YAML.
 *
 * The `ref` field is the canonical `airboss-ref:` URI (with optional
 * embedded edition pin or `?at=`/`?page=`/`?paragraph=` query). Sentinel
 * fields are flat per amendment D1; the canonical vocabulary is closed
 * (validated by `validateSentinelFieldName`). When `quote` is present OR
 * the locator includes `?page=`/`?paragraph=`, the citation is
 * edition-sensitive and the validator requires an explicit pin.
 *
 * `redirectedFrom` is the well-known non-sentinel field introduced
 * alongside the sentinel vocabulary -- it records the original
 * `airboss-ref:` URI a citation pointed at before a human override moved
 * it (typically the legacy citation parsed by the migration script).
 * Validator parses the value via `parseIdentifier` but does not look it up
 * in the registry; the original target may be a retired edition, which is
 * exactly the case the field exists to record. Future-proofed for a list
 * of redirects but ships single-value-only.
 */
interface RefParsedReference {
	readonly shape: 'ref';
	readonly ref: string;
	readonly sentinels: ReadonlyArray<{ readonly field: SentinelField; readonly expected: string }>;
	readonly quote: string | null;
	readonly note: string;
	readonly redirectedFrom: string | null;
}

type ParsedReference = LegacyParsedReference | RefParsedReference;

interface ParsedFrontmatter {
	id: string;
	title: string;
	domain: string;
	crossDomains: string[];
	knowledgeTypes: string[];
	technicalDepth: string | null;
	stability: string | null;
	/** Lowest cert that requires this topic. Required field on authored nodes. */
	minimumCert: string | null;
	/** Study-time bucket: critical / standard / stretch. Required on authored nodes. */
	studyPriority: string | null;
	requires: string[];
	deepens: string[];
	appliedBy: string[];
	taughtBy: string[];
	related: string[];
	modalities: string[];
	estimatedTimeMinutes: number | null;
	reviewTimeMinutes: number | null;
	references: ParsedReference[];
	assessable: boolean;
	assessmentMethods: string[];
	masteryCriteria: string | null;
}

interface ParsedNode {
	/** Absolute filesystem path to the node.md. */
	filePath: string;
	/** Repo-relative path for display. */
	relPath: string;
	frontmatter: ParsedFrontmatter;
	/** Raw markdown body (everything after the closing frontmatter fence). */
	body: string;
	/** SHA-256 over the entire file contents. */
	contentHash: string;
	/** Presence map keyed by phase slug; value is the body text under that H2. */
	phases: Map<string, string>;
	/** Derived from phases -- skeleton/started/complete. */
	lifecycle: NodeLifecycle;
}

interface BuildError {
	relPath: string;
	message: string;
}

interface BuildWarning {
	relPath: string;
	message: string;
}

function sha256(buf: string): string {
	return createHash('sha256').update(buf, 'utf8').digest('hex');
}

function walkForNodeMd(root: string): string[] {
	const out: string[] = [];
	if (!safeStat(root)) return out;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const full = join(dir, entry);
			const s = safeStat(full);
			if (!s) continue;
			if (s.isDirectory()) {
				stack.push(full);
			} else if (basename(full) === 'node.md') {
				out.push(full);
			}
		}
	}
	return out.sort();
}

function safeStat(path: string): ReturnType<typeof statSync> | null {
	try {
		return statSync(path);
	} catch {
		return null;
	}
}

/** Split a node.md into its frontmatter and body. */
function splitFrontmatter(text: string): { yaml: string; body: string } | null {
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---', 4);
	if (end === -1) return null;
	const yaml = text.slice(4, end);
	// Consume optional trailing newline after the closing fence.
	const bodyStart = end + '\n---'.length;
	const afterFence = text.slice(bodyStart).replace(/^\r?\n/, '');
	return { yaml, body: afterFence };
}

/**
 * Scan the markdown body for `## PhaseLabel` headings and collect the body
 * text under each. Unknown H2 headings are a parse error (caught upstream by
 * validation). Title-only H1 at the top is tolerated; everything between H1
 * and the first H2 is discarded.
 */
function splitPhases(body: string): { phases: Map<string, string>; unknownHeadings: string[]; duplicates: string[] } {
	const phaseByLabel = new Map<string, string>();
	for (const phase of KNOWLEDGE_PHASE_ORDER) {
		phaseByLabel.set(KNOWLEDGE_PHASE_LABELS[phase].toLowerCase(), phase);
	}

	const phases = new Map<string, string>();
	const unknownHeadings: string[] = [];
	const duplicates: string[] = [];

	let currentPhase: string | null = null;
	const accum: string[] = [];
	const flush = () => {
		if (currentPhase !== null) {
			const text = accum.join('\n').trim();
			if (text.length > 0) {
				if (phases.has(currentPhase)) {
					duplicates.push(currentPhase);
				} else {
					phases.set(currentPhase, text);
				}
			}
			accum.length = 0;
		}
	};

	for (const rawLine of body.split(/\r?\n/)) {
		const h2Match = rawLine.match(/^##\s+(.+?)\s*$/);
		if (h2Match) {
			flush();
			const label = h2Match[1].trim().toLowerCase();
			const phase = phaseByLabel.get(label);
			if (phase) {
				currentPhase = phase;
			} else {
				currentPhase = null;
				unknownHeadings.push(h2Match[1].trim());
			}
			continue;
		}
		if (currentPhase !== null) accum.push(rawLine);
	}
	flush();
	return { phases, unknownHeadings, duplicates };
}

function deriveLifecycle(phaseCount: number): NodeLifecycle {
	if (phaseCount === 0) return NODE_LIFECYCLES.SKELETON;
	if (phaseCount >= KNOWLEDGE_PHASE_ORDER.length) return NODE_LIFECYCLES.COMPLETE;
	return NODE_LIFECYCLES.STARTED;
}

function asStringArray(value: unknown): string[] {
	if (value === null || value === undefined) return [];
	if (!Array.isArray(value)) return [];
	return value.filter((v): v is string => typeof v === 'string');
}

function asString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') return value;
	return null;
}

function asOptionalInt(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return value;
	return null;
}

/**
 * Stable code surfaced on every legacy-shape WARNING. ADR 019 amendment
 * 2026-05 step 8 graduates this to ERROR once the migration review queue
 * closes; until then the build emits per-citation WARNINGs that show up in
 * `bun run check` output without blocking.
 */
const LEGACY_CITATION_WARNING_CODE = 'legacy-citation-shape';

interface ReferenceParseResult {
	readonly references: readonly ParsedReference[];
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
}

function asReferenceArray(value: unknown): ReferenceParseResult {
	if (value === null || value === undefined) return { references: [], errors: [], warnings: [] };
	if (!Array.isArray(value)) {
		return { references: [], errors: ["'references' must be an array"], warnings: [] };
	}
	const references: ParsedReference[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];
	for (let i = 0; i < value.length; i += 1) {
		const entry = value[i];
		if (typeof entry !== 'object' || entry === null) {
			errors.push(`references[${i}]: entry must be an object`);
			continue;
		}
		const obj = entry as Record<string, unknown>;
		// Shape discrimination: structured citations carry `ref` (canonical
		// `airboss-ref:` URI per ADR 019). Legacy citations carry `source`.
		const hasRef = typeof obj.ref === 'string';
		const hasLegacy = typeof obj.source === 'string';
		if (hasRef && hasLegacy) {
			errors.push(`references[${i}]: cannot set both 'ref' (structured) and 'source' (legacy) on the same citation`);
			continue;
		}
		if (hasRef) {
			const result = parseRefReference(obj, i);
			if (result.error !== null) {
				errors.push(result.error);
				continue;
			}
			if (result.reference !== null) references.push(result.reference);
			continue;
		}
		if (hasLegacy) {
			references.push({
				shape: 'legacy',
				source: typeof obj.source === 'string' ? obj.source : '',
				detail: typeof obj.detail === 'string' ? obj.detail : '',
				note: typeof obj.note === 'string' ? obj.note : '',
			});
			warnings.push(
				`references[${i}] [${LEGACY_CITATION_WARNING_CODE}]: legacy free-text citation; ` +
					'migrate to the structured `ref:` shape via `bun scripts/db/migrate-knowledge-citations.ts`. ' +
					'Per ADR 019 amendment 2026-05 step 8 this graduates to ERROR after the migration review queue closes.',
			);
			continue;
		}
		errors.push(
			`references[${i}]: missing required citation discriminator -- set 'ref' (structured) or 'source' (legacy)`,
		);
	}
	return { references, errors, warnings };
}

interface RefParseSlot {
	readonly reference: RefParsedReference | null;
	readonly error: string | null;
}

/**
 * Parse a structured citation entry. The shape is `ref:` URI plus zero or
 * more flat sentinel fields drawn from the canonical vocabulary
 * (`SENTINEL_FIELDS`), zero or more well-known non-sentinel fields drawn
 * from `WELL_KNOWN_CITATION_FIELDS` (today: `redirected_from`), an
 * optional `quote`, and an optional `note`. Unknown fields are rejected
 * as ERROR (typo defense per amendment D1).
 */
function parseRefReference(obj: Record<string, unknown>, index: number): RefParseSlot {
	const ref = obj.ref;
	if (typeof ref !== 'string' || ref.length === 0) {
		return { reference: null, error: `references[${index}]: 'ref' must be a non-empty string` };
	}
	const sentinels: Array<{ readonly field: SentinelField; readonly expected: string }> = [];
	let quote: string | null = null;
	let note = '';
	let redirectedFrom: string | null = null;
	const allowedNonSentinel: ReadonlySet<string> = new Set(['ref', 'quote', 'note']);
	for (const [key, raw] of Object.entries(obj)) {
		if (allowedNonSentinel.has(key)) {
			if (key === 'quote') {
				if (raw === undefined || raw === null) continue;
				if (typeof raw !== 'string') {
					return { reference: null, error: `references[${index}]: 'quote' must be a string` };
				}
				quote = raw;
				continue;
			}
			if (key === 'note') {
				if (raw === undefined || raw === null) continue;
				if (typeof raw !== 'string') {
					return { reference: null, error: `references[${index}]: 'note' must be a string` };
				}
				note = raw;
				continue;
			}
			continue;
		}
		// Anything else must be a canonical sentinel or well-known field per
		// amendment D1 + the well-known-fields subsection of §2.
		const validation = validateSentinelFieldName(key);
		if (validation.kind === 'unknown-field') {
			return { reference: null, error: `references[${index}]: ${validation.message}` };
		}
		if (validation.kind === 'ok-well-known') {
			// Today the only well-known field is `redirected_from`. The switch
			// fans out as the vocabulary grows so each field can carry its own
			// validator without a generic catch-all that would silently accept
			// future fields with weaker validation.
			if (validation.field === 'redirected_from') {
				const result = validateRedirectedFrom(raw);
				if (!result.ok) {
					return { reference: null, error: `references[${index}]: ${result.message}` };
				}
				redirectedFrom = result.value;
				continue;
			}
			// Defensive exhaustive check -- if a new well-known field is added to
			// the vocabulary without a parser branch here, surface it as ERROR
			// instead of silently dropping the value.
			const exhaustive: never = validation.field;
			void exhaustive;
			return {
				reference: null,
				error: `references[${index}]: well-known field '${key}' has no schema parser branch`,
			};
		}
		if (typeof raw !== 'string' || raw.length === 0) {
			return {
				reference: null,
				error: `references[${index}]: sentinel '${key}' must be a non-empty string`,
			};
		}
		sentinels.push({ field: validation.field, expected: raw });
	}
	return {
		reference: {
			shape: 'ref',
			ref,
			sentinels,
			quote,
			note,
			redirectedFrom,
		},
		error: null,
	};
}

/**
 * Determine locator precision per ADR 019 amendment 2026-05 §1. The validator
 * routes on this to decide whether an unpinned identifier is OK.
 *
 * Edition-sensitive when:
 *   - `?page=` is in the URI (page-pinned),
 *   - `?paragraph=` is in the URI (paragraph-renumbered regs), or
 *   - the citation captures a sibling `quote:` field.
 *
 * Otherwise doc-or-chapter-level. Editionless corpora are detected inside
 * the validator from `parsed.corpus`, so we only need to choose between
 * 'doc-or-chapter-level' and 'edition-sensitive' here.
 */
function computeLocatorPrecision(ref: RefParsedReference): 'doc-or-chapter-level' | 'edition-sensitive' {
	if (ref.quote !== null && ref.quote.length > 0) return 'edition-sensitive';
	if (/[?&]page=/.test(ref.ref)) return 'edition-sensitive';
	if (/[?&]paragraph=/.test(ref.ref)) return 'edition-sensitive';
	return 'doc-or-chapter-level';
}

/**
 * Convert build-script captured sentinels to the validator's `CitationSentinel`
 * shape. The shapes are isomorphic; the indirection lets the build script use
 * its own readonly type while the validator keeps its own.
 */
function toCitationSentinels(ref: RefParsedReference): readonly CitationSentinel[] {
	return ref.sentinels.map((s) => ({ field: s.field, expected: s.expected }));
}

interface CitationValidationOutcome {
	readonly errors: readonly BuildError[];
	readonly warnings: readonly BuildWarning[];
}

/**
 * Lazily-loaded `@ab/sources` toolkit. The static import would pull
 * `@ab/db/connection` into module-load time (the production registry
 * transitively imports the editions cache, which imports the db handle),
 * which breaks `--dry-run` in environments without DATABASE_URL set.
 * Dynamic import keeps dry-run DB-free, matching the pattern used by
 * `writeToDb` below.
 */
type SourcesToolkit = {
	readonly parseIdentifier: typeof import('@ab/sources/parser.ts').parseIdentifier;
	readonly isParseError: typeof import('@ab/sources/parser.ts').isParseError;
	readonly validateIdentifier: typeof import('@ab/sources/validator.ts').validateIdentifier;
	readonly registry: import('@ab/sources').RegistryReader;
	readonly getCorpusResolver: typeof import('@ab/sources').getCorpusResolver;
};
let _sourcesToolkit: SourcesToolkit | null = null;
/**
 * Load the validator + parser + production registry on first use. The
 * production registry transitively imports `@ab/db/connection` (the editions
 * cache reads from Postgres at warm-time), so the static-import path would
 * break `--dry-run` in environments without DATABASE_URL set. Even the
 * `@ab/sources` barrel re-exports DB-touching values, so we import each
 * leaf module directly to keep dry-run hermetic until first use.
 */
async function loadSourcesToolkit(): Promise<SourcesToolkit> {
	if (_sourcesToolkit !== null) return _sourcesToolkit;
	const [
		{ parseIdentifier, isParseError },
		{ validateIdentifier },
		{ productionRegistry, getCorpusResolver },
		// Side-effect imports that register per-corpus resolvers. Required
		// for the validator's rule 2 fallback (resolver.isKnownLocator) to
		// reach the right resolver. The leaf-imports above do not transitively
		// pull these in -- the @ab/sources barrel does, but we avoid the
		// barrel because it also re-exports DB-touching values per the
		// comment above. Adding each corpus's index here is the minimal way
		// to populate the resolver registry without dragging in the DB layer.
		_handbooks,
	] = await Promise.all([
		import('@ab/sources/parser.ts'),
		import('@ab/sources/validator.ts'),
		import('@ab/sources/registry/index.ts'),
		import('@ab/sources/handbooks/index.ts'),
	]);
	_sourcesToolkit = {
		parseIdentifier,
		isParseError,
		validateIdentifier,
		registry: productionRegistry,
		getCorpusResolver,
	};
	return _sourcesToolkit;
}

/**
 * Validate every structured (`ref:`-shaped) citation in `references` via the
 * `@ab/sources` validator. Per ADR 019 amendment 2026-05 step 4, NOTICE-tier
 * findings are IDE-only and skipped from the CLI summary; ERROR fails the
 * build; WARNING is visible-but-non-blocking. Legacy citations are skipped --
 * `asReferenceArray` already emitted a per-citation WARNING for those.
 */
async function validateStructuredCitations(
	references: readonly ParsedReference[],
	relPath: string,
): Promise<CitationValidationOutcome> {
	const errors: BuildError[] = [];
	const warnings: BuildWarning[] = [];
	const toolkit = await loadSourcesToolkit();
	const lookup = (parsed: ParsedIdentifier, field: SentinelField): string | null => {
		const resolver = toolkit.getCorpusResolver(parsed.corpus);
		if (resolver === null) return null;
		const hook = resolver.getSentinelValue;
		if (typeof hook !== 'function') return null;
		return hook(parsed, field);
	};
	references.forEach((ref, index) => {
		if (ref.shape !== 'ref') return;
		const parsed = toolkit.parseIdentifier(ref.ref);
		if (toolkit.isParseError(parsed)) {
			errors.push({
				relPath,
				message: `references[${index}] '${ref.ref}': ${parsed.message}`,
			});
			return;
		}
		const findings: readonly ValidationFinding[] = toolkit.validateIdentifier(parsed, {
			registry: toolkit.registry,
			location: { file: relPath, line: 0, column: 0 },
			locatorPrecision: computeLocatorPrecision(ref),
			sentinels: toCitationSentinels(ref),
			sentinelLookup: lookup,
		});
		for (const finding of findings) {
			const detail = `references[${index}] '${ref.ref}' (rule ${finding.ruleId}): ${finding.message}`;
			if (finding.severity === 'error') {
				errors.push({ relPath, message: detail });
			} else if (finding.severity === 'warning') {
				warnings.push({ relPath, message: detail });
			}
			// NOTICE-tier findings are IDE-only per amendment step 4; skip from CLI summary.
		}
	});
	return { errors, warnings };
}

function parseFrontmatterYaml(
	yaml: string,
	relPath: string,
): { frontmatter: ParsedFrontmatter; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];
	let raw: unknown;
	try {
		raw = parseYaml(yaml);
	} catch (err) {
		errors.push(`YAML parse error: ${(err as Error).message}`);
		return { frontmatter: emptyFrontmatter(), errors, warnings };
	}
	if (typeof raw !== 'object' || raw === null) {
		errors.push('frontmatter is not an object');
		return { frontmatter: emptyFrontmatter(), errors, warnings };
	}
	const obj = raw as Record<string, unknown>;
	const referenceParse = asReferenceArray(obj.references);
	for (const message of referenceParse.errors) errors.push(message);
	for (const message of referenceParse.warnings) warnings.push(message);

	const frontmatter: ParsedFrontmatter = {
		id: typeof obj.id === 'string' ? obj.id : '',
		title: typeof obj.title === 'string' ? obj.title : '',
		domain: typeof obj.domain === 'string' ? obj.domain : '',
		crossDomains: asStringArray(obj.cross_domains),
		knowledgeTypes: asStringArray(obj.knowledge_types),
		technicalDepth: asString(obj.technical_depth),
		stability: asString(obj.stability),
		minimumCert: asString(obj.minimum_cert),
		studyPriority: asString(obj.study_priority),
		requires: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.REQUIRES]),
		deepens: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.DEEPENS]),
		appliedBy: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.APPLIED_BY]),
		taughtBy: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.TAUGHT_BY]),
		related: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.RELATED]),
		modalities: asStringArray(obj.modalities),
		estimatedTimeMinutes: asOptionalInt(obj.estimated_time_minutes),
		reviewTimeMinutes: asOptionalInt(obj.review_time_minutes),
		references: referenceParse.references.slice(),
		assessable: typeof obj.assessable === 'boolean' ? obj.assessable : true,
		assessmentMethods: asStringArray(obj.assessment_methods),
		masteryCriteria: asString(obj.mastery_criteria),
	};

	if (!frontmatter.id) errors.push(`${relPath}: missing 'id'`);
	if (!frontmatter.title) errors.push(`${relPath}: missing 'title'`);
	if (!frontmatter.domain) errors.push(`${relPath}: missing 'domain'`);
	if (frontmatter.id && !/^[a-z][a-z0-9-]*$/.test(frontmatter.id)) {
		errors.push(`${relPath}: id '${frontmatter.id}' must match /^[a-z][a-z0-9-]*$/`);
	}

	return { frontmatter, errors, warnings };
}

/**
 * Serialise a parsed reference back to the on-disk JSONB shape. The internal
 * discriminator (`shape`) is stripped so the column stays compatible with
 * the existing `Citation` union; the renderer then narrows on the presence
 * of `ref` vs `source` per amendment step 5.
 */
function serializeReferenceForDb(ref: ParsedReference): Record<string, unknown> {
	if (ref.shape === 'legacy') {
		return { source: ref.source, detail: ref.detail, note: ref.note };
	}
	const out: Record<string, unknown> = { ref: ref.ref };
	for (const sentinel of ref.sentinels) {
		out[sentinel.field] = sentinel.expected;
	}
	if (ref.redirectedFrom !== null && ref.redirectedFrom.length > 0) out.redirected_from = ref.redirectedFrom;
	if (ref.quote !== null && ref.quote.length > 0) out.quote = ref.quote;
	if (ref.note.length > 0) out.note = ref.note;
	return out;
}

function emptyFrontmatter(): ParsedFrontmatter {
	return {
		id: '',
		title: '',
		domain: '',
		crossDomains: [],
		knowledgeTypes: [],
		technicalDepth: null,
		stability: null,
		minimumCert: null,
		studyPriority: null,
		requires: [],
		deepens: [],
		appliedBy: [],
		taughtBy: [],
		related: [],
		modalities: [],
		estimatedTimeMinutes: null,
		reviewTimeMinutes: null,
		references: [],
		assessable: true,
		assessmentMethods: [],
		masteryCriteria: null,
	};
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
	errors: BuildError[];
	warnings: BuildWarning[];
	cycleChain: string[] | null;
}

function validate(nodes: readonly ParsedNode[]): ValidationResult {
	const errors: BuildError[] = [];
	const warnings: BuildWarning[] = [];

	const idToNode = new Map<string, ParsedNode>();
	for (const node of nodes) {
		if (node.frontmatter.id) {
			if (idToNode.has(node.frontmatter.id)) {
				errors.push({
					relPath: node.relPath,
					message: `duplicate id '${node.frontmatter.id}' (also defined in ${idToNode.get(node.frontmatter.id)?.relPath})`,
				});
			} else {
				idToNode.set(node.frontmatter.id, node);
			}
		}
	}

	for (const node of nodes) {
		const fm = node.frontmatter;
		// Edge target resolution
		const outgoing: Array<{ key: string; list: string[] }> = [
			{ key: 'requires', list: fm.requires },
			{ key: 'deepens', list: fm.deepens },
			{ key: 'applied_by', list: fm.appliedBy },
			{ key: 'taught_by', list: fm.taughtBy },
			{ key: 'related', list: fm.related },
		];
		for (const { key, list } of outgoing) {
			for (const target of list) {
				if (!idToNode.has(target)) {
					// A missing target is a warning in v1 so the 30-node skeleton
					// can land with dangling `teach-*` / `plan-*` references that
					// haven't been authored yet. The UI surfaces these as gaps
					// via a read-time LEFT JOIN on `knowledge_node` (see ADR 011
					// + 2026-05-06 review §E); no per-edge cached flag needed.
					warnings.push({
						relPath: node.relPath,
						message: `${key} -> '${target}' does not resolve to an authored node`,
					});
				}
			}
		}

		// minimum_cert is required and must be one of the known cert slugs.
		if (!fm.minimumCert) {
			errors.push({
				relPath: node.relPath,
				message: `missing 'minimum_cert' (one of: ${CERT_VALUES.join(', ')})`,
			});
		} else if (!CERT_VALUES.includes(fm.minimumCert as (typeof CERT_VALUES)[number])) {
			errors.push({
				relPath: node.relPath,
				message: `minimum_cert '${fm.minimumCert}' must be one of: ${CERT_VALUES.join(', ')}`,
			});
		}

		// study_priority is required and must be one of critical / standard / stretch.
		if (!fm.studyPriority) {
			errors.push({
				relPath: node.relPath,
				message: `missing 'study_priority' (one of: ${STUDY_PRIORITY_VALUES.join(', ')})`,
			});
		} else if (!STUDY_PRIORITY_VALUES.includes(fm.studyPriority as (typeof STUDY_PRIORITY_VALUES)[number])) {
			errors.push({
				relPath: node.relPath,
				message: `study_priority '${fm.studyPriority}' must be one of: ${STUDY_PRIORITY_VALUES.join(', ')}`,
			});
		}
	}

	// Cross-BC reference check: every nodeId named by SIM_SCENARIO_NODE_MAPPINGS
	// must resolve to an authored knowledge node. Failing here is a hard error
	// because the study scheduler will silently no-op on a stale slug -- the
	// learner gets no lift on cards the sim says they need. See
	// docs/work-packages/sim-card-mapping/spec.md "Validation".
	for (const [scenarioId, links] of Object.entries(SIM_SCENARIO_NODE_MAPPINGS)) {
		for (const link of links) {
			if (!idToNode.has(link.nodeId)) {
				errors.push({
					relPath: '(sim-card-mapping)',
					message: `SIM_SCENARIO_NODE_MAPPINGS[${scenarioId}] -> '${link.nodeId}' does not resolve to an authored knowledge node`,
				});
			}
		}
	}

	const cycleChain = findRequiresCycleInParsed(nodes);
	return { errors, warnings, cycleChain };
}

/** Cycle detection over the `requires` subgraph only. Returns the first cycle found or null. */
function findRequiresCycleInParsed(nodes: readonly ParsedNode[]): string[] | null {
	const ids = nodes.map((n) => n.frontmatter.id).filter((id) => id.length > 0);
	const idSet = new Set(ids);
	const adj = new Map<string, string[]>();
	for (const id of ids) adj.set(id, []);
	for (const node of nodes) {
		const fromId = node.frontmatter.id;
		if (!fromId) continue;
		for (const to of node.frontmatter.requires) {
			if (!idSet.has(to)) continue;
			const list = adj.get(fromId);
			if (list) list.push(to);
		}
	}
	const UNVISITED = 0;
	const VISITING = 1;
	const DONE = 2;
	const color = new Map<string, number>();
	const parent = new Map<string, string | null>();
	for (const id of ids) color.set(id, UNVISITED);
	function dfs(start: string): string[] | null {
		const stack: Array<{ id: string; childIdx: number }> = [{ id: start, childIdx: 0 }];
		color.set(start, VISITING);
		parent.set(start, null);
		while (stack.length > 0) {
			const frame = stack[stack.length - 1];
			const children = adj.get(frame.id) ?? [];
			if (frame.childIdx >= children.length) {
				color.set(frame.id, DONE);
				stack.pop();
				continue;
			}
			const child = children[frame.childIdx++];
			const c = color.get(child) ?? UNVISITED;
			if (c === VISITING) {
				const cycle: string[] = [child];
				let cur: string | null = frame.id;
				while (cur !== null && cur !== child) {
					cycle.push(cur);
					cur = parent.get(cur) ?? null;
				}
				cycle.push(child);
				cycle.reverse();
				return cycle;
			}
			if (c === UNVISITED) {
				color.set(child, VISITING);
				parent.set(child, frame.id);
				stack.push({ id: child, childIdx: 0 });
			}
		}
		return null;
	}
	for (const id of ids) {
		if ((color.get(id) ?? UNVISITED) === UNVISITED) {
			const cycle = dfs(id);
			if (cycle) return cycle;
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Edge normalization (frontmatter -> storage shape)
// ---------------------------------------------------------------------------

interface BuildEdge {
	fromNodeId: string;
	toNodeId: string;
	edgeType: KnowledgeEdgeType;
}

function edgesFor(node: ParsedNode): BuildEdge[] {
	const fromId = node.frontmatter.id;
	const edges: BuildEdge[] = [];
	for (const to of node.frontmatter.requires) {
		edges.push({ fromNodeId: fromId, toNodeId: to, edgeType: KNOWLEDGE_EDGE_TYPES.REQUIRES });
	}
	for (const to of node.frontmatter.deepens) {
		edges.push({ fromNodeId: fromId, toNodeId: to, edgeType: KNOWLEDGE_EDGE_TYPES.DEEPENS });
	}
	for (const from of node.frontmatter.appliedBy) {
		// applied_by: the LISTED node applies the CURRENT node. Stored from the
		// consumer to the source (the relationship's active voice is "applies").
		edges.push({ fromNodeId: from, toNodeId: fromId, edgeType: KNOWLEDGE_EDGE_TYPES.APPLIES });
	}
	for (const from of node.frontmatter.taughtBy) {
		edges.push({ fromNodeId: from, toNodeId: fromId, edgeType: KNOWLEDGE_EDGE_TYPES.TEACHES });
	}
	for (const to of node.frontmatter.related) {
		edges.push({ fromNodeId: fromId, toNodeId: to, edgeType: KNOWLEDGE_EDGE_TYPES.RELATED });
		// Mirror: `related` is bidirectional so either endpoint resolves to both.
		edges.push({ fromNodeId: to, toNodeId: fromId, edgeType: KNOWLEDGE_EDGE_TYPES.RELATED });
	}
	return edges;
}

// ---------------------------------------------------------------------------
// Coverage / index generation
// ---------------------------------------------------------------------------

interface CoverageSummary {
	totalNodes: number;
	byLifecycle: Record<NodeLifecycle, number>;
	byDomain: Record<string, number>;
	phaseGaps: Array<{ id: string; missing: string[] }>;
}

function buildCoverageSummary(nodes: readonly ParsedNode[]): CoverageSummary {
	const byLifecycle: Record<NodeLifecycle, number> = {
		[NODE_LIFECYCLES.SKELETON]: 0,
		[NODE_LIFECYCLES.STARTED]: 0,
		[NODE_LIFECYCLES.COMPLETE]: 0,
	};
	const byDomain: Record<string, number> = {};
	const phaseGaps: Array<{ id: string; missing: string[] }> = [];

	for (const node of nodes) {
		byLifecycle[node.lifecycle]++;
		const d = node.frontmatter.domain;
		byDomain[d] = (byDomain[d] ?? 0) + 1;

		const missing: string[] = [];
		for (const phase of KNOWLEDGE_PHASE_ORDER) {
			if (!node.phases.has(phase)) missing.push(KNOWLEDGE_PHASE_LABELS[phase]);
		}
		if (missing.length > 0) phaseGaps.push({ id: node.frontmatter.id, missing });
	}
	return { totalNodes: nodes.length, byLifecycle, byDomain, phaseGaps };
}

function renderGraphIndex(nodes: readonly ParsedNode[], summary: CoverageSummary): string {
	const lines: string[] = [];
	lines.push('<!-- Auto-generated by `bun run build-knowledge`. Do not edit by hand. -->');
	lines.push('# Knowledge Graph Index');
	lines.push('');
	lines.push(`Total nodes: **${summary.totalNodes}**`);
	lines.push('');
	lines.push('## Lifecycle');
	lines.push('');
	lines.push('| Lifecycle | Count |');
	lines.push('| --------- | ----- |');
	for (const lc of [NODE_LIFECYCLES.SKELETON, NODE_LIFECYCLES.STARTED, NODE_LIFECYCLES.COMPLETE] as const) {
		lines.push(`| ${lc} | ${summary.byLifecycle[lc]} |`);
	}
	lines.push('');
	lines.push('## By domain');
	lines.push('');
	lines.push('| Domain | Count |');
	lines.push('| ------ | ----- |');
	for (const d of Object.keys(summary.byDomain).sort()) {
		const label = (DOMAIN_LABELS as Record<string, string>)[d] ?? d;
		lines.push(`| ${label} | ${summary.byDomain[d]} |`);
	}
	lines.push('');
	lines.push('## Nodes');
	lines.push('');
	const byDomain = new Map<string, ParsedNode[]>();
	for (const n of nodes) {
		const d = n.frontmatter.domain;
		const arr = byDomain.get(d) ?? [];
		arr.push(n);
		byDomain.set(d, arr);
	}
	for (const d of [...byDomain.keys()].sort()) {
		const label = (DOMAIN_LABELS as Record<string, string>)[d] ?? d;
		lines.push(`### ${label}`);
		lines.push('');
		lines.push('| ID | Title | Lifecycle | Phases authored |');
		lines.push('| -- | ----- | --------- | --------------- |');
		for (const n of byDomain.get(d)?.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id)) ?? []) {
			const authored = KNOWLEDGE_PHASE_ORDER.filter((p) => n.phases.has(p)).length;
			lines.push(
				`| ${n.frontmatter.id} | ${n.frontmatter.title} | ${n.lifecycle} | ${authored}/${KNOWLEDGE_PHASE_ORDER.length} |`,
			);
		}
		lines.push('');
	}
	return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const repoRoot = resolve(import.meta.dir, '..');
	const knowledgeRoot = resolve(repoRoot, 'course', 'knowledge');

	const files = walkForNodeMd(knowledgeRoot);
	const nodes: ParsedNode[] = [];
	const parseErrors: BuildError[] = [];
	const parseWarnings: BuildWarning[] = [];

	for (const filePath of files) {
		let raw: string;
		try {
			raw = readFileSync(filePath, 'utf8');
		} catch (err) {
			parseErrors.push({ relPath: relative(repoRoot, filePath), message: `read failed: ${(err as Error).message}` });
			continue;
		}
		const relPath = relative(repoRoot, filePath);
		const split = splitFrontmatter(raw);
		if (!split) {
			parseErrors.push({ relPath, message: 'missing or malformed frontmatter fence' });
			continue;
		}
		const { frontmatter, errors: fmErrors, warnings: fmWarnings } = parseFrontmatterYaml(split.yaml, relPath);
		for (const message of fmErrors) parseErrors.push({ relPath, message });
		for (const message of fmWarnings) parseWarnings.push({ relPath, message });

		// Validate every structured citation through the @ab/sources validator.
		// ERROR -> build failure; WARNING -> visible-but-non-blocking; NOTICE
		// -> IDE-only (skipped from CLI summary). Parse errors on the
		// `airboss-ref:` URI are surfaced as ERROR carrying the parser's
		// message per amendment step 4.
		const validationOutcome = await validateStructuredCitations(frontmatter.references, relPath);
		for (const err of validationOutcome.errors) parseErrors.push(err);
		for (const warn of validationOutcome.warnings) parseWarnings.push(warn);

		const { phases, unknownHeadings, duplicates } = splitPhases(split.body);
		for (const unknown of unknownHeadings) {
			parseErrors.push({ relPath, message: `unknown phase heading '## ${unknown}'` });
		}
		for (const dup of duplicates) {
			parseErrors.push({
				relPath,
				message: `duplicate phase heading '${KNOWLEDGE_PHASE_LABELS[dup as keyof typeof KNOWLEDGE_PHASE_LABELS]}'`,
			});
		}
		nodes.push({
			filePath,
			relPath,
			frontmatter,
			body: split.body,
			contentHash: sha256(raw),
			phases,
			lifecycle: deriveLifecycle(phases.size),
		});
	}

	const validation = validate(nodes);
	const allErrors: BuildError[] = [...parseErrors, ...validation.errors];
	const allWarnings: BuildWarning[] = [...parseWarnings, ...validation.warnings];
	if (validation.cycleChain) {
		allErrors.push({
			relPath: '(graph)',
			message: `cycle detected in requires edges: ${validation.cycleChain.join(' -> ')}`,
		});
	}

	const summary = buildCoverageSummary(nodes);

	if (allErrors.length > 0) {
		emitReport('failed', args, nodes, summary, allErrors, allWarnings);
		process.exit(1);
	}

	// Lifecycle-skeleton coverage gate -- useful once the graph scales.
	if (args.failOnCoverage && summary.byLifecycle[NODE_LIFECYCLES.SKELETON] > 0) {
		emitReport(
			'failed',
			args,
			nodes,
			summary,
			[
				{
					relPath: '(coverage)',
					message: `--fail-on-coverage: ${summary.byLifecycle[NODE_LIFECYCLES.SKELETON]} skeleton node(s) remain`,
				},
			],
			allWarnings,
		);
		process.exit(1);
	}

	// Write the autogenerated index even on dry-run so authors can preview it.
	if (!args.dryRun) {
		const indexPath = join(knowledgeRoot, 'graph-index.md');
		writeFileSync(indexPath, renderGraphIndex(nodes, summary), 'utf8');
	}

	if (!args.dryRun) {
		await writeToDb(nodes);
	}

	emitReport(args.dryRun ? 'dry-run success' : 'success', args, nodes, summary, [], allWarnings);
}

// ---------------------------------------------------------------------------
// DB write pipeline -- dynamic import so --dry-run stays DB-free.
// ---------------------------------------------------------------------------

async function writeToDb(nodes: readonly ParsedNode[]): Promise<void> {
	const [{ client, db }, { knowledgeNode, knowledgeEdge }, { sql, inArray }] = await Promise.all([
		import('@ab/db/connection'),
		import('@ab/bc-study/schema'),
		import('drizzle-orm'),
	]);

	try {
		await db.transaction(async (tx) => {
			// Bulk-upsert every node in a single statement instead of one
			// INSERT per node. `excluded.*` references the candidate row in the
			// ON CONFLICT clause; the version CASE compares the stored content
			// hash against the candidate hash so re-seeds bump version only
			// when the body actually changed. Cuts ~N round-trips to 1.
			if (nodes.length > 0) {
				const values = nodes.map((node) => ({
					id: node.frontmatter.id,
					title: node.frontmatter.title,
					domain: node.frontmatter.domain,
					crossDomains: node.frontmatter.crossDomains,
					knowledgeTypes: node.frontmatter.knowledgeTypes,
					technicalDepth: node.frontmatter.technicalDepth,
					stability: node.frontmatter.stability,
					minimumCert: node.frontmatter.minimumCert,
					studyPriority: node.frontmatter.studyPriority,
					modalities: node.frontmatter.modalities,
					estimatedTimeMinutes: node.frontmatter.estimatedTimeMinutes,
					reviewTimeMinutes: node.frontmatter.reviewTimeMinutes,
					references: node.frontmatter.references.map(serializeReferenceForDb),
					assessable: node.frontmatter.assessable,
					assessmentMethods: node.frontmatter.assessmentMethods,
					masteryCriteria: node.frontmatter.masteryCriteria,
					contentMd: node.body,
					contentHash: node.contentHash,
					version: 1,
					lifecycle: node.lifecycle,
				}));
				await tx
					.insert(knowledgeNode)
					.values(values)
					.onConflictDoUpdate({
						target: knowledgeNode.id,
						set: {
							title: sql.raw(`excluded.title`),
							domain: sql.raw(`excluded.domain`),
							crossDomains: sql.raw(`excluded.cross_domains`),
							knowledgeTypes: sql.raw(`excluded.knowledge_types`),
							technicalDepth: sql.raw(`excluded.technical_depth`),
							stability: sql.raw(`excluded.stability`),
							minimumCert: sql.raw(`excluded.minimum_cert`),
							studyPriority: sql.raw(`excluded.study_priority`),
							modalities: sql.raw(`excluded.modalities`),
							estimatedTimeMinutes: sql.raw(`excluded.estimated_time_minutes`),
							reviewTimeMinutes: sql.raw(`excluded.review_time_minutes`),
							references: sql.raw(`excluded."references"`),
							assessable: sql.raw(`excluded.assessable`),
							assessmentMethods: sql.raw(`excluded.assessment_methods`),
							masteryCriteria: sql.raw(`excluded.mastery_criteria`),
							contentMd: sql.raw(`excluded.content_md`),
							contentHash: sql.raw(`excluded.content_hash`),
							version: sql<number>`CASE
								WHEN coalesce(${knowledgeNode.contentHash}, '') = excluded.content_hash THEN ${knowledgeNode.version}
								ELSE ${knowledgeNode.version} + 1
							END`,
							lifecycle: sql.raw(`excluded.lifecycle`),
							updatedAt: new Date(),
						},
					});
			}

			// Replace edges wholesale for every authored node. Cascading from the
			// delete would remove edges pointing *at* these nodes; we only want to
			// clear what the node itself emits, so filter on from_node_id.
			const authoredIds = nodes.map((n) => n.frontmatter.id);
			const authoredSet = new Set(authoredIds);
			if (authoredIds.length > 0) {
				// Clear every edge whose `from_node_id` is one of the authored
				// nodes *or* one of the reversed-edge sources (applied_by /
				// taught_by). The reversed form means the listed node becomes the
				// emitter; if that listed node happens to also be an authored
				// node, its outgoing edges from a previous build may collide
				// with the freshly-computed ones. Rebuilding the full edge set
				// per authored scope is simpler than diffing.
				await tx.delete(knowledgeEdge).where(inArray(knowledgeEdge.fromNodeId, authoredIds));
				const edgeRows = nodes.flatMap(edgesFor);
				// Drop any edge whose `from` isn't an authored node. The FK on
				// `knowledge_edge.from_node_id` would refuse the insert; the
				// `applied_by` / `taught_by` frontmatter shapes let authors name
				// future nodes that don't exist yet, and those edges stay
				// implicit until the target is authored (at which point its own
				// `requires` or `applies` will re-materialize them).
				const insertable = edgeRows.filter((e) => authoredSet.has(e.fromNodeId));
				// Deduplicate (same from, to, type) -- `related` mirror may
				// conflict with a legitimate two-sided author intent.
				const seen = new Set<string>();
				const unique = insertable.filter((e) => {
					const key = `${e.fromNodeId}|${e.toNodeId}|${e.edgeType}`;
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
				if (unique.length > 0) {
					await tx.insert(knowledgeEdge).values(unique).onConflictDoNothing();
				}
			}

			// Edge target existence is now resolved at read time via LEFT JOIN
			// (per 2026-05-06 review §E). The previously-stored `target_exists`
			// boolean was a maintained denormalized cache; the column was
			// dropped, and refresh-after-build is no longer needed.
		});
	} finally {
		// Close the postgres pool so the process can exit immediately on
		// success; without this the script hangs until the pool's idle
		// timeout fires (~20s).
		await client.end();
	}
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function emitReport(
	status: string,
	args: Args,
	nodes: readonly ParsedNode[],
	summary: CoverageSummary,
	errors: readonly BuildError[],
	warnings: readonly BuildWarning[],
): void {
	if (args.json) {
		process.stdout.write(
			`${JSON.stringify({
				status,
				dryRun: args.dryRun,
				nodeCount: nodes.length,
				summary,
				errors,
				warnings,
			})}\n`,
		);
		return;
	}
	process.stdout.write(`build-knowledge: ${status}\n`);
	process.stdout.write(`  nodes: ${nodes.length}\n`);
	process.stdout.write(
		`  lifecycle: skeleton=${summary.byLifecycle[NODE_LIFECYCLES.SKELETON]} started=${summary.byLifecycle[NODE_LIFECYCLES.STARTED]} complete=${summary.byLifecycle[NODE_LIFECYCLES.COMPLETE]}\n`,
	);
	if (warnings.length > 0) {
		process.stdout.write(`  warnings: ${warnings.length}\n`);
		const reportPath = writeWarningsReport(warnings);
		const aggregated = aggregateWarningsByCode(warnings);
		for (const group of aggregated) {
			const head = `    ${group.code}: ${group.count}`;
			if (group.actionable !== null) {
				process.stdout.write(`${head}  -- ${group.actionable}\n`);
			} else {
				process.stdout.write(`${head}\n`);
			}
			// Show one example per group so the operator can spot-check what
			// the aggregate refers to without opening the JSON.
			const example = group.first;
			process.stdout.write(`      eg ${example.relPath}: ${truncateForLine(example.message)}\n`);
		}
		process.stdout.write(`    full list: ${reportPath}\n`);
	}
	if (errors.length > 0) {
		process.stderr.write(`  errors: ${errors.length}\n`);
		for (const e of errors) process.stderr.write(`    [error] ${e.relPath}: ${e.message}\n`);
	}
}

interface AggregatedWarningGroup {
	readonly code: string;
	readonly count: number;
	readonly first: BuildWarning;
	readonly actionable: string | null;
}

/**
 * Collapse the flat warnings list into one row per code. The code is
 * extracted from the `[bracket]` tag in the message; messages without a
 * tag fall under `uncategorized`. Edge-resolution warnings get their own
 * synthetic codes (`unresolved-edge`) so they don't all collide as
 * `uncategorized`.
 *
 * `actionable` is the one-liner that tells the operator what to do about
 * the group ("run script X", "author the missing nodes", etc). Maintained
 * here so the aggregate output stays useful instead of "warnings: 116" with
 * no next-step.
 */
function aggregateWarningsByCode(warnings: ReadonlyArray<BuildWarning>): AggregatedWarningGroup[] {
	const buckets = new Map<string, { count: number; first: BuildWarning }>();
	for (const w of warnings) {
		const codeMatch = w.message.match(/\[([a-z][a-z0-9-]*)\]/i);
		let code: string;
		if (codeMatch) {
			code = codeMatch[1];
		} else if (/does not resolve to an authored node/.test(w.message)) {
			code = 'unresolved-edge';
		} else {
			code = 'uncategorized';
		}
		const entry = buckets.get(code);
		if (entry === undefined) {
			buckets.set(code, { count: 1, first: w });
		} else {
			entry.count += 1;
		}
	}
	const ACTIONABLES: Readonly<Record<string, string>> = {
		'legacy-citation-shape':
			"run 'bun scripts/db/migrate-knowledge-citations.ts' to migrate to the structured ref: shape",
		'unresolved-edge': 'author the missing target nodes, or remove the edge from the source node frontmatter',
	};
	const out: AggregatedWarningGroup[] = [];
	for (const [code, entry] of buckets) {
		out.push({ code, count: entry.count, first: entry.first, actionable: ACTIONABLES[code] ?? null });
	}
	out.sort((a, b) => b.count - a.count);
	return out;
}

function truncateForLine(message: string): string {
	const oneLine = message.replace(/\s+/g, ' ').trim();
	return oneLine.length > 140 ? `${oneLine.slice(0, 137)}...` : oneLine;
}

/**
 * Persist the full warning list to `.reports/build-knowledge/warnings.json`
 * so the operator can drill into specifics without the seed scrollback. Best
 * effort: failure to write the report is a debug aid, not a build failure.
 */
function writeWarningsReport(warnings: ReadonlyArray<BuildWarning>): string {
	const reportDir = resolve(process.cwd(), '.reports', 'build-knowledge');
	const reportPath = resolve(reportDir, 'warnings.json');
	try {
		mkdirSync(reportDir, { recursive: true });
		writeFileSync(reportPath, `${JSON.stringify(warnings, null, 2)}\n`);
	} catch (err) {
		// Don't crash the build if .reports isn't writable; just note it.
		process.stderr.write(`build-knowledge: failed to write warnings report: ${(err as Error).message}\n`);
	}
	return reportPath;
}

/**
 * Test-only escape hatch. Re-exports the pure citation-parsing helpers so
 * `build-knowledge-index.test.ts` can exercise them directly. Not part of
 * the script's public interface; do not import from production code.
 */
export const __test__ = {
	asReferenceArray,
	computeLocatorPrecision,
	serializeReferenceForDb,
	LEGACY_CITATION_WARNING_CODE,
};

// Run `main()` only when this script is invoked directly (`bun
// scripts/build-knowledge-index.ts`), not when imported as a module
// (e.g. by `build-knowledge-index.test.ts`).
if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`build-knowledge: unexpected failure: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}

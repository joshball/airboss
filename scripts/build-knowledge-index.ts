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
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import {
	DOMAIN_LABELS,
	KNOWLEDGE_EDGE_TYPES,
	KNOWLEDGE_EDGE_YAML_KEYS,
	KNOWLEDGE_PHASE_LABELS,
	KNOWLEDGE_PHASE_ORDER,
	type KnowledgeEdgeType,
	NODE_LIFECYCLES,
	type NodeLifecycle,
} from '@ab/constants/study';
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

interface ParsedReference {
	source: string;
	detail: string;
	note: string;
}

interface ParsedRelevance {
	cert: string;
	bloom: string;
	priority: string;
}

interface ParsedFrontmatter {
	id: string;
	title: string;
	domain: string;
	crossDomains: string[];
	knowledgeTypes: string[];
	technicalDepth: string | null;
	stability: string | null;
	relevance: ParsedRelevance[];
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

function asReferenceArray(value: unknown): ParsedReference[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
		.map((entry) => ({
			source: typeof entry.source === 'string' ? entry.source : '',
			detail: typeof entry.detail === 'string' ? entry.detail : '',
			note: typeof entry.note === 'string' ? entry.note : '',
		}));
}

function asRelevanceArray(value: unknown): ParsedRelevance[] {
	if (!Array.isArray(value)) return [];
	const out: ParsedRelevance[] = [];
	for (const entry of value) {
		if (typeof entry !== 'object' || entry === null) continue;
		const rec = entry as Record<string, unknown>;
		out.push({
			cert: typeof rec.cert === 'string' ? rec.cert : '',
			bloom: typeof rec.bloom === 'string' ? rec.bloom : '',
			priority: typeof rec.priority === 'string' ? rec.priority : '',
		});
	}
	return out;
}

function parseFrontmatterYaml(yaml: string, relPath: string): { frontmatter: ParsedFrontmatter; errors: string[] } {
	const errors: string[] = [];
	let raw: unknown;
	try {
		raw = parseYaml(yaml);
	} catch (err) {
		errors.push(`YAML parse error: ${(err as Error).message}`);
		return { frontmatter: emptyFrontmatter(), errors };
	}
	if (typeof raw !== 'object' || raw === null) {
		errors.push('frontmatter is not an object');
		return { frontmatter: emptyFrontmatter(), errors };
	}
	const obj = raw as Record<string, unknown>;

	const frontmatter: ParsedFrontmatter = {
		id: typeof obj.id === 'string' ? obj.id : '',
		title: typeof obj.title === 'string' ? obj.title : '',
		domain: typeof obj.domain === 'string' ? obj.domain : '',
		crossDomains: asStringArray(obj.cross_domains),
		knowledgeTypes: asStringArray(obj.knowledge_types),
		technicalDepth: asString(obj.technical_depth),
		stability: asString(obj.stability),
		relevance: asRelevanceArray(obj.relevance),
		requires: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.REQUIRES]),
		deepens: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.DEEPENS]),
		appliedBy: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.APPLIED_BY]),
		taughtBy: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.TAUGHT_BY]),
		related: asStringArray(obj[KNOWLEDGE_EDGE_YAML_KEYS.RELATED]),
		modalities: asStringArray(obj.modalities),
		estimatedTimeMinutes: asOptionalInt(obj.estimated_time_minutes),
		reviewTimeMinutes: asOptionalInt(obj.review_time_minutes),
		references: asReferenceArray(obj.references),
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

	return { frontmatter, errors };
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
		relevance: [],
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
					// haven't been authored yet. Build script records
					// `target_exists=false` on these edges so the UI can surface
					// them as gaps.
					warnings.push({
						relPath: node.relPath,
						message: `${key} -> '${target}' does not resolve to an authored node`,
					});
				}
			}
		}

		// Relevance shape
		for (const r of fm.relevance) {
			if (!r.cert || !r.bloom || !r.priority) {
				errors.push({
					relPath: node.relPath,
					message: `relevance entry requires cert, bloom, priority (got ${JSON.stringify(r)})`,
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
		const { frontmatter, errors: fmErrors } = parseFrontmatterYaml(split.yaml, relPath);
		for (const message of fmErrors) parseErrors.push({ relPath, message });

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
	if (validation.cycleChain) {
		allErrors.push({
			relPath: '(graph)',
			message: `cycle detected in requires edges: ${validation.cycleChain.join(' -> ')}`,
		});
	}

	const summary = buildCoverageSummary(nodes);

	if (allErrors.length > 0) {
		emitReport('failed', args, nodes, summary, allErrors, validation.warnings);
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
			validation.warnings,
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

	emitReport(args.dryRun ? 'dry-run success' : 'success', args, nodes, summary, [], validation.warnings);
}

// ---------------------------------------------------------------------------
// DB write pipeline -- dynamic import so --dry-run stays DB-free.
// ---------------------------------------------------------------------------

async function writeToDb(nodes: readonly ParsedNode[]): Promise<void> {
	const [{ client, db }, { knowledgeNode, knowledgeEdge }, { sql, inArray }] = await Promise.all([
		import('../libs/db/src/index'),
		import('../libs/bc/study/src/schema'),
		import('drizzle-orm'),
	]);

	try {
		await db.transaction(async (tx) => {
			// Upsert every node. `contentHash` is stored so future reads can
			// detect content changes; the ON CONFLICT set below bumps
			// `version` only when the hash differs from whatever's on disk
			// (SQL-side CASE), keeping re-seeds idempotent.
			for (const node of nodes) {
				const nextHash = node.contentHash;
				await tx
					.insert(knowledgeNode)
					.values({
						id: node.frontmatter.id,
						title: node.frontmatter.title,
						domain: node.frontmatter.domain,
						crossDomains: node.frontmatter.crossDomains,
						knowledgeTypes: node.frontmatter.knowledgeTypes,
						technicalDepth: node.frontmatter.technicalDepth,
						stability: node.frontmatter.stability,
						relevance: node.frontmatter.relevance,
						modalities: node.frontmatter.modalities,
						estimatedTimeMinutes: node.frontmatter.estimatedTimeMinutes,
						reviewTimeMinutes: node.frontmatter.reviewTimeMinutes,
						references: node.frontmatter.references,
						assessable: node.frontmatter.assessable,
						assessmentMethods: node.frontmatter.assessmentMethods,
						masteryCriteria: node.frontmatter.masteryCriteria,
						contentMd: node.body,
						contentHash: nextHash,
						version: 1,
						lifecycle: node.lifecycle,
					})
					.onConflictDoUpdate({
						target: knowledgeNode.id,
						set: {
							title: node.frontmatter.title,
							domain: node.frontmatter.domain,
							crossDomains: node.frontmatter.crossDomains,
							knowledgeTypes: node.frontmatter.knowledgeTypes,
							technicalDepth: node.frontmatter.technicalDepth,
							stability: node.frontmatter.stability,
							relevance: node.frontmatter.relevance,
							modalities: node.frontmatter.modalities,
							estimatedTimeMinutes: node.frontmatter.estimatedTimeMinutes,
							reviewTimeMinutes: node.frontmatter.reviewTimeMinutes,
							references: node.frontmatter.references,
							assessable: node.frontmatter.assessable,
							assessmentMethods: node.frontmatter.assessmentMethods,
							masteryCriteria: node.frontmatter.masteryCriteria,
							contentMd: node.body,
							contentHash: nextHash,
							version: sql<number>`CASE
								WHEN coalesce(${knowledgeNode.contentHash}, '') = ${nextHash} THEN ${knowledgeNode.version}
								ELSE ${knowledgeNode.version} + 1
							END`,
							lifecycle: node.lifecycle,
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
					await tx
						.insert(knowledgeEdge)
						.values(unique.map((e) => ({ ...e, targetExists: false })))
						.onConflictDoNothing();
				}
			}

			// Refresh target_exists on every edge in one pass. The SQL uses the
			// study schema qualifier explicitly so the statement remains valid
			// regardless of search_path.
			await tx.execute(sql`
			UPDATE study.knowledge_edge e
			SET target_exists = EXISTS (
				SELECT 1 FROM study.knowledge_node n WHERE n.id = e.to_node_id
			)
		`);
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
		for (const w of warnings) process.stdout.write(`    [warn] ${w.relPath}: ${w.message}\n`);
	}
	if (errors.length > 0) {
		process.stderr.write(`  errors: ${errors.length}\n`);
		for (const e of errors) process.stderr.write(`    [error] ${e.relPath}: ${e.message}\n`);
	}
}

main().catch((err) => {
	process.stderr.write(`build-knowledge: unexpected failure: ${(err as Error).stack ?? err}\n`);
	process.exit(1);
});

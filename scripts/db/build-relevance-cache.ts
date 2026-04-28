#!/usr/bin/env bun
/**
 * Relevance cache rebuild.
 *
 * Walks every active syllabus, every leaf, every leaf's
 * `syllabus_node_link` rows, and accumulates `(cert, bloom, priority)`
 * triples per linked `knowledge_node_id`. Highest bloom wins per
 * `(node, cert)` pair on dedup. Writes the cache to
 * `knowledge_node.relevance` JSONB.
 *
 * Cert derivation: each syllabus is the primary syllabus of one or more
 * credentials (`credential_syllabus.primacy='primary'`). Each such
 * credential's slug is a `cert`. Higher credentials inherit lower-credential
 * relevance via the reverse `credential_prereq` walk: e.g. PPL relevance
 * shows up on `private`, `commercial`, `atp`, etc. -- every credential that
 * has private as a transitive prereq.
 *
 * Priority derivation:
 * - K-triad (knowledge) leaf at the examiner-level cert -> `critical`
 * - S-triad (skill) leaf at the examiner-level cert -> `critical`
 * - R-triad (risk management) leaf at the examiner-level cert -> `standard`
 * - Anything inherited transitively -> `standard`
 * - Anything inherited at lower bloom -> `stretch`
 *
 * `--dry-run`: emits a per-node diff manifest to
 * `docs/work/build-reports/relevance-rebuild-<timestamp>.md` and
 * exits without writing the cache. The user reviews the manifest
 * before authorising the live write (cert-syllabus WP Gate A).
 *
 * Usage:
 *   bun scripts/db/build-relevance-cache.ts --dry-run
 *   bun scripts/db/build-relevance-cache.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	credential,
	credentialPrereq,
	credentialSyllabus,
	knowledgeNode,
	type SyllabusRow,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from '@ab/bc-study';
import { BLOOM_LEVELS, type BloomLevel, STUDY_PRIORITIES, type StudyPriority, SYLLABUS_STATUSES } from '@ab/constants';
import { db } from '@ab/db';
import type { RelevanceEntry } from '@ab/types';
import { eq, sql } from 'drizzle-orm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const BLOOM_RANK: Record<BloomLevel, number> = {
	[BLOOM_LEVELS.REMEMBER]: 1,
	[BLOOM_LEVELS.UNDERSTAND]: 2,
	[BLOOM_LEVELS.APPLY]: 3,
	[BLOOM_LEVELS.ANALYZE]: 4,
	[BLOOM_LEVELS.EVALUATE]: 5,
	[BLOOM_LEVELS.CREATE]: 6,
};

export interface RelevanceCacheOptions {
	dryRun?: boolean;
}

export interface RelevanceCacheReport {
	syllabiProcessed: number;
	leavesScanned: number;
	linksScanned: number;
	knowledgeNodesAffected: number;
	manifestPath: string | null;
	dryRun: boolean;
	diff: ReadonlyArray<NodeDiff>;
}

export interface NodeDiff {
	nodeId: string;
	added: RelevanceEntry[];
	removed: RelevanceEntry[];
	changed: Array<{ before: RelevanceEntry; after: RelevanceEntry }>;
}

/**
 * Compute the rebuilt cache and either emit a dry-run manifest or write
 * to `knowledge_node.relevance`.
 */
export async function buildRelevanceCache(options: RelevanceCacheOptions = {}): Promise<RelevanceCacheReport> {
	const dryRun = options.dryRun ?? false;

	// 1. Pull every active syllabus.
	const activeSyllabi: SyllabusRow[] = await db
		.select()
		.from(syllabus)
		.where(eq(syllabus.status, SYLLABUS_STATUSES.ACTIVE));

	// 2. For each syllabus, find every credential whose primary syllabus is
	//    this syllabus.
	const credentialBySyllabus = new Map<string, string[]>();
	const primaryRows = await db
		.select({ syllabusId: credentialSyllabus.syllabusId, credentialId: credentialSyllabus.credentialId })
		.from(credentialSyllabus)
		.where(eq(credentialSyllabus.primacy, 'primary'));
	for (const row of primaryRows) {
		const list = credentialBySyllabus.get(row.syllabusId) ?? [];
		list.push(row.credentialId);
		credentialBySyllabus.set(row.syllabusId, list);
	}

	// 3. Reverse credential prereq map: for each credential, which credentials
	//    transitively depend on it? (i.e. higher-cert paths).
	const allCredentials = await db.select().from(credential);
	const slugById = new Map<string, string>();
	for (const c of allCredentials) slugById.set(c.id, c.slug);

	const allEdges = await db.select().from(credentialPrereq);
	// edge: credentialId -> prereqId means "this credential requires that prereq".
	// For relevance inheritance we want: given prereqId, which credentialIds
	// have it as a (direct or transitive) prereq?
	const dependentsOf = new Map<string, Set<string>>();
	for (const edge of allEdges) {
		const list = dependentsOf.get(edge.prereqId) ?? new Set<string>();
		list.add(edge.credentialId);
		dependentsOf.set(edge.prereqId, list);
	}

	function transitiveDependents(rootId: string): Set<string> {
		const out = new Set<string>([rootId]);
		const stack = [rootId];
		while (stack.length > 0) {
			const cur = stack.pop();
			if (cur === undefined) continue;
			const direct = dependentsOf.get(cur);
			if (direct === undefined) continue;
			for (const dep of direct) {
				if (out.has(dep)) continue;
				out.add(dep);
				stack.push(dep);
			}
		}
		return out;
	}

	// 4. Walk leaves + links per syllabus.
	type Triple = { cert: string; bloom: BloomLevel; priority: StudyPriority };
	const triplesByNode = new Map<string, Triple[]>();
	let leavesScanned = 0;
	let linksScanned = 0;

	for (const syl of activeSyllabi) {
		const credentialIds = credentialBySyllabus.get(syl.id) ?? [];
		if (credentialIds.length === 0) {
			// Authored but not yet wired to a credential -- skip silently.
			continue;
		}

		// "examiner-level" certs: the credentials whose primary syllabus IS
		// this syllabus.
		const examinerCertIds = new Set(credentialIds);

		// Inherited certs: every credential that transitively depends on
		// any of the examiner-level credentials.
		const inheritedCertIds = new Set<string>();
		for (const id of credentialIds) {
			for (const dep of transitiveDependents(id)) {
				if (!examinerCertIds.has(dep)) inheritedCertIds.add(dep);
			}
		}

		const leaves = await db
			.select({
				id: syllabusNode.id,
				triad: syllabusNode.triad,
				requiredBloom: syllabusNode.requiredBloom,
			})
			.from(syllabusNode)
			.where(sql`${syllabusNode.syllabusId} = ${syl.id} AND ${syllabusNode.isLeaf} = true`);

		for (const leaf of leaves) {
			leavesScanned += 1;
			if (leaf.requiredBloom === null) continue;
			const bloom = leaf.requiredBloom as BloomLevel;
			const links = await db
				.select({ knowledgeNodeId: syllabusNodeLink.knowledgeNodeId })
				.from(syllabusNodeLink)
				.where(eq(syllabusNodeLink.syllabusNodeId, leaf.id));
			for (const link of links) {
				linksScanned += 1;
				const list = triplesByNode.get(link.knowledgeNodeId) ?? [];

				for (const certId of examinerCertIds) {
					const slug = slugById.get(certId);
					if (slug === undefined) continue;
					list.push({ cert: slug, bloom, priority: examinerPriority(leaf.triad, bloom) });
				}
				for (const certId of inheritedCertIds) {
					const slug = slugById.get(certId);
					if (slug === undefined) continue;
					list.push({ cert: slug, bloom, priority: inheritedPriority(leaf.triad, bloom) });
				}
				triplesByNode.set(link.knowledgeNodeId, list);
			}
		}
	}

	// 5. Dedup: highest bloom wins per (node, cert).
	const finalByNode = new Map<string, RelevanceEntry[]>();
	for (const [nodeId, triples] of triplesByNode) {
		const bestByCert = new Map<string, Triple>();
		for (const t of triples) {
			const prev = bestByCert.get(t.cert);
			if (prev === undefined || BLOOM_RANK[t.bloom] > BLOOM_RANK[prev.bloom]) {
				bestByCert.set(t.cert, t);
			} else if (BLOOM_RANK[t.bloom] === BLOOM_RANK[prev.bloom]) {
				// Same bloom, prefer the higher-priority record.
				if (priorityRank(t.priority) > priorityRank(prev.priority)) bestByCert.set(t.cert, t);
			}
		}
		const entries: RelevanceEntry[] = [...bestByCert.values()]
			.map((t) => ({ cert: t.cert as RelevanceEntry['cert'], bloom: t.bloom, priority: t.priority }))
			.sort((a, b) => a.cert.localeCompare(b.cert));
		finalByNode.set(nodeId, entries);
	}

	// 6. Diff against existing cache.
	const existingNodes = await db
		.select({ id: knowledgeNode.id, relevance: knowledgeNode.relevance })
		.from(knowledgeNode);
	const existingByNode = new Map<string, RelevanceEntry[]>();
	for (const n of existingNodes) existingByNode.set(n.id, n.relevance ?? []);

	const diff: NodeDiff[] = [];
	for (const [nodeId, after] of finalByNode) {
		const before = existingByNode.get(nodeId) ?? [];
		const d = diffEntries(nodeId, before, after);
		if (d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0) diff.push(d);
	}
	for (const [nodeId, before] of existingByNode) {
		if (finalByNode.has(nodeId)) continue;
		if (before.length === 0) continue;
		diff.push({ nodeId, added: [], removed: [...before], changed: [] });
	}

	// 7. Write cache (or emit manifest).
	let manifestPath: string | null = null;
	if (dryRun) {
		manifestPath = await writeManifest(diff, finalByNode.size, leavesScanned, linksScanned);
	} else {
		for (const [nodeId, entries] of finalByNode) {
			await db.update(knowledgeNode).set({ relevance: entries }).where(eq(knowledgeNode.id, nodeId));
		}
	}

	return {
		syllabiProcessed: activeSyllabi.length,
		leavesScanned,
		linksScanned,
		knowledgeNodesAffected: finalByNode.size,
		manifestPath,
		dryRun,
		diff,
	};
}

function examinerPriority(triad: string | null, _bloom: BloomLevel): StudyPriority {
	// At examiner-level: K and S are critical; R is standard. K is what the
	// applicant must know cold; S is the visible test; R is the risk overlay.
	if (triad === 'knowledge' || triad === 'skill') return STUDY_PRIORITIES.CRITICAL;
	return STUDY_PRIORITIES.STANDARD;
}

function inheritedPriority(_triad: string | null, _bloom: BloomLevel): StudyPriority {
	// Inherited certs: the cert applicant has already passed this material;
	// their priority for it is standard maintenance, not critical.
	return STUDY_PRIORITIES.STANDARD;
}

function priorityRank(p: StudyPriority): number {
	switch (p) {
		case STUDY_PRIORITIES.CRITICAL:
			return 3;
		case STUDY_PRIORITIES.STANDARD:
			return 2;
		case STUDY_PRIORITIES.STRETCH:
			return 1;
		default:
			return 0;
	}
}

function diffEntries(nodeId: string, before: RelevanceEntry[], after: RelevanceEntry[]): NodeDiff {
	const beforeByCert = new Map(before.map((e) => [e.cert, e] as const));
	const afterByCert = new Map(after.map((e) => [e.cert, e] as const));

	const added: RelevanceEntry[] = [];
	const removed: RelevanceEntry[] = [];
	const changed: Array<{ before: RelevanceEntry; after: RelevanceEntry }> = [];

	for (const [cert, a] of afterByCert) {
		const b = beforeByCert.get(cert);
		if (b === undefined) {
			added.push(a);
			continue;
		}
		if (b.bloom !== a.bloom || b.priority !== a.priority) changed.push({ before: b, after: a });
	}
	for (const [cert, b] of beforeByCert) {
		if (!afterByCert.has(cert)) removed.push(b);
	}

	return { nodeId, added, removed, changed };
}

async function writeManifest(
	diff: ReadonlyArray<NodeDiff>,
	totalNodes: number,
	leavesScanned: number,
	linksScanned: number,
): Promise<string> {
	const reportDir = resolve(REPO_ROOT, 'docs/work/build-reports');
	mkdirSync(reportDir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const path = resolve(reportDir, `relevance-rebuild-${ts}.md`);

	const lines: string[] = [];
	lines.push('# Relevance cache rebuild -- dry-run manifest');
	lines.push('');
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('## Summary');
	lines.push('');
	lines.push(`- Total knowledge nodes with computed relevance: ${totalNodes}`);
	lines.push(`- Leaves scanned: ${leavesScanned}`);
	lines.push(`- Links scanned: ${linksScanned}`);
	lines.push(`- Nodes with diff vs current cache: ${diff.length}`);
	lines.push('');

	if (diff.length === 0) {
		lines.push('No changes -- the rebuilt cache is identical to the current cache.');
		writeFileSync(path, lines.join('\n'));
		return path;
	}

	lines.push('## Per-node diff');
	lines.push('');

	for (const d of diff) {
		lines.push(`### \`${d.nodeId}\``);
		lines.push('');
		if (d.added.length > 0) {
			lines.push('Added:');
			lines.push('');
			for (const e of d.added) lines.push(`- + \`${e.cert}\` -- bloom \`${e.bloom}\`, priority \`${e.priority}\``);
			lines.push('');
		}
		if (d.removed.length > 0) {
			lines.push('Removed:');
			lines.push('');
			for (const e of d.removed) lines.push(`- - \`${e.cert}\` -- bloom \`${e.bloom}\`, priority \`${e.priority}\``);
			lines.push('');
		}
		if (d.changed.length > 0) {
			lines.push('Changed:');
			lines.push('');
			for (const c of d.changed) {
				lines.push(
					`- ~ \`${c.before.cert}\` -- bloom \`${c.before.bloom}\` -> \`${c.after.bloom}\`, priority \`${c.before.priority}\` -> \`${c.after.priority}\``,
				);
			}
			lines.push('');
		}
	}

	writeFileSync(path, lines.join('\n'));
	return path;
}

async function main(): Promise<void> {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has('--dry-run');
	const report = await buildRelevanceCache({ dryRun });
	process.stdout.write(
		`build-relevance-cache: ${report.syllabiProcessed} syllabi, ${report.leavesScanned} leaves, ${report.linksScanned} links\n`,
	);
	process.stdout.write(
		`  ${report.knowledgeNodesAffected} knowledge nodes affected; ${report.diff.length} diffs vs current cache\n`,
	);
	if (dryRun) {
		process.stdout.write(`  dry-run manifest: ${report.manifestPath}\n`);
		process.stdout.write('  Cache NOT written. Re-run without --dry-run after manifest review.\n');
	} else {
		process.stdout.write('  Cache written to knowledge_node.relevance\n');
	}
}

if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`build-relevance-cache: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}

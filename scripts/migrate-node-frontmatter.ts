#!/usr/bin/env bun
/**
 * One-shot migration: rewrite every course/knowledge/**\/node.md frontmatter
 * to replace the legacy `relevance: [{cert,bloom,priority}, ...]` array with
 * scalar `minimum_cert:` and `study_priority:` keys.
 *
 * Cert collapse: pick the lowest cert by the project's hierarchy
 *   private < instrument < commercial < cfi
 * If a node has no relevance entries, default to `private` (PPL is the floor
 * if the author hadn't decided yet -- safer than silently dropping the node
 * from cert filters).
 *
 * Priority collapse:
 *   any 'core'        -> critical
 *   any 'supporting'  -> standard
 *   any 'elective'    -> stretch
 *   no entries        -> standard (sensible default for an authored node)
 *
 * Idempotent: rewriting an already-migrated file is a no-op.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'course', 'knowledge');

const CERT_RANK: Record<string, number> = {
	private: 0,
	instrument: 1,
	commercial: 2,
	cfi: 3,
};

interface Relevance {
	cert: string;
	bloom: string;
	priority: string;
}

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const s = statSync(full);
		if (s.isDirectory()) yield* walk(full);
		else if (entry === 'node.md') yield full;
	}
}

function parseRelevance(yaml: string): Relevance[] {
	// Crude line-based parser scoped to the relevance block. Good enough for
	// the existing node.md shape (we control the source format). A real YAML
	// roundtrip would be heavier than necessary for a one-shot.
	const lines = yaml.split('\n');
	const out: Relevance[] = [];
	let inBlock = false;
	let cur: Partial<Relevance> = {};
	for (const line of lines) {
		if (/^relevance:\s*\[\s*\]\s*$/.test(line)) return [];
		if (/^relevance:\s*$/.test(line)) {
			inBlock = true;
			continue;
		}
		if (!inBlock) continue;
		// Block ends when we hit a top-level (non-indented, non-list) key.
		if (/^[a-zA-Z_]/.test(line)) {
			if (cur.cert) out.push({ cert: cur.cert, bloom: cur.bloom ?? '', priority: cur.priority ?? '' });
			break;
		}
		const m = line.match(/^\s*-\s*cert:\s*(\S+)\s*$/);
		if (m) {
			if (cur.cert) out.push({ cert: cur.cert, bloom: cur.bloom ?? '', priority: cur.priority ?? '' });
			cur = { cert: m[1] };
			continue;
		}
		const b = line.match(/^\s*bloom:\s*(\S+)\s*$/);
		if (b) {
			cur.bloom = b[1];
			continue;
		}
		const p = line.match(/^\s*priority:\s*(\S+)\s*$/);
		if (p) {
			cur.priority = p[1];
		}
	}
	if (cur.cert) out.push({ cert: cur.cert, bloom: cur.bloom ?? '', priority: cur.priority ?? '' });
	return out;
}

function pickMinimumCert(rels: Relevance[]): string {
	if (rels.length === 0) return 'private';
	let best = rels[0]?.cert ?? 'private';
	let bestRank = CERT_RANK[best] ?? 9;
	for (const r of rels) {
		const rank = CERT_RANK[r.cert] ?? 9;
		if (rank < bestRank) {
			best = r.cert;
			bestRank = rank;
		}
	}
	return CERT_RANK[best] !== undefined ? best : 'private';
}

function pickStudyPriority(rels: Relevance[]): string {
	if (rels.some((r) => r.priority === 'core')) return 'critical';
	if (rels.some((r) => r.priority === 'supporting')) return 'standard';
	if (rels.some((r) => r.priority === 'elective')) return 'stretch';
	return 'standard';
}

function rewriteFile(path: string): { changed: boolean; minimumCert: string; studyPriority: string } {
	const text = readFileSync(path, 'utf8');
	const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!m) return { changed: false, minimumCert: '', studyPriority: '' };
	const yaml = m[1] ?? '';
	const body = m[2] ?? '';

	// Already migrated?
	if (/^minimum_cert:/m.test(yaml) && /^study_priority:/m.test(yaml) && !/^relevance:/m.test(yaml)) {
		return { changed: false, minimumCert: '', studyPriority: '' };
	}

	const rels = parseRelevance(yaml);
	const minimumCert = pickMinimumCert(rels);
	const studyPriority = pickStudyPriority(rels);

	// Strip the `relevance:` block (inline `[]` or multi-line) and any
	// preceding `# === Cert relevance ===` / comment lines that introduced it.
	let newYaml = yaml.replace(/^# === Cert relevance.*$/m, '').replace(/^# Each entry: \{ cert:.*$/m, '');
	newYaml = newYaml.replace(/^relevance:\s*\[\s*\]\s*$/m, '__RELEVANCE_PLACEHOLDER__');
	if (!newYaml.includes('__RELEVANCE_PLACEHOLDER__')) {
		// Multi-line block: drop from `relevance:` until next top-level key.
		const lines = newYaml.split('\n');
		const out: string[] = [];
		let inBlock = false;
		for (const line of lines) {
			if (/^relevance:\s*$/.test(line)) {
				inBlock = true;
				out.push('__RELEVANCE_PLACEHOLDER__');
				continue;
			}
			if (inBlock) {
				if (/^[a-zA-Z_]/.test(line)) {
					inBlock = false;
					out.push(line);
				}
				continue;
			}
			out.push(line);
		}
		newYaml = out.join('\n');
	}

	const replacement = `# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: ${minimumCert}
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: ${studyPriority}`;
	newYaml = newYaml.replace('__RELEVANCE_PLACEHOLDER__', replacement);

	// Collapse runs of >=3 blank lines from the comment removals.
	newYaml = newYaml.replace(/\n{3,}/g, '\n\n');

	const next = `---\n${newYaml}\n---\n${body}`;
	if (next === text) return { changed: false, minimumCert, studyPriority };
	writeFileSync(path, next);
	return { changed: true, minimumCert, studyPriority };
}

let total = 0;
let changed = 0;
for (const path of walk(ROOT)) {
	total += 1;
	const r = rewriteFile(path);
	if (r.changed) {
		changed += 1;
		console.log(`  rewrote ${path.replace(`${process.cwd()}/`, '')} -> ${r.minimumCert} / ${r.studyPriority}`);
	}
}
console.log(`\nMigrated ${changed} of ${total} node.md files.`);
process.exit(0);

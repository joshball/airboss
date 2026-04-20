#!/usr/bin/env bun
/**
 * Scaffold a new knowledge-graph node.
 *
 * Usage:
 *   bun run knowledge:new <domain> <slug>
 *
 * Creates `course/knowledge/<domain>/<slug>/node.md` with a full frontmatter
 * template (every field present, TODO-commented for unknown values) plus the
 * seven H2 phase stubs. Refuses to overwrite existing files and rejects
 * unknown domains.
 *
 * ADR 011's "ask the questions, even when you can't answer them" principle
 * drives the template shape: every field is present even when empty so a
 * reviewer can see the gaps rather than miss them.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DOMAIN_VALUES, KNOWLEDGE_PHASE_LABELS, KNOWLEDGE_PHASE_ORDER } from '../libs/constants/src/study';

/**
 * Domains accepted by the scaffolder. Starts from DOMAIN_VALUES and adds the
 * graph-specific labels already in use by the 3 canary nodes (`performance`,
 * `procedures`). DOMAIN_VALUES is the platform source-of-truth but the graph
 * taxonomy is slightly broader -- the spec's open question 5 calls this out
 * and we list both until the constant catches up.
 */
const ACCEPTED_DOMAINS = new Set<string>([...DOMAIN_VALUES, 'performance', 'procedures']);

function fail(message: string): never {
	process.stderr.write(`knowledge:new: ${message}\n`);
	process.exit(1);
}

function nodeTemplate(domain: string, slug: string): string {
	const title = humanize(slug);
	const phaseSections = KNOWLEDGE_PHASE_ORDER.map((phase) => {
		const label = KNOWLEDGE_PHASE_LABELS[phase];
		return `## ${label}\n\n<!-- TODO: author the ${label} phase -->\n`;
	}).join('\n');

	return `---
# === Identity ===
id: ${slug}
title: ${title}
domain: ${domain}
cross_domains: []

# === Knowledge character ===
# TODO: pick one or more from: factual, conceptual, procedural, judgment, perceptual, pedagogical
knowledge_types: []
# TODO: surface | working | deep
technical_depth: working
# TODO: stable | evolving | volatile
stability: stable

# === Cert relevance (multi-dimensional) ===
# Each entry: { cert: PPL|IR|CPL|CFI, bloom: remember|understand|apply|analyze|evaluate|create, priority: core|supporting|elective }
relevance: []

# === Graph edges ===
# Author-facing collection keys; the build script normalizes on write.
requires: []
deepens: []
applied_by: []
taught_by: []
related: []

# === Content & delivery ===
# TODO: reading, cards, reps, drill, visualization, audio, video, calculation, teaching-exercise
modalities: []
# TODO: rough estimate in minutes
estimated_time_minutes: null
review_time_minutes: null

# === References ===
# Each entry: { source: e.g. "PHAK", detail: "Ch 15", note: "optional narrative" }
references: []

# === Assessment ===
assessable: true
# TODO: recall, calculation, scenario, demonstration, teaching
assessment_methods: []
# TODO: optional human-readable rationale for how this node is judged mastered
mastery_criteria: null
---

# ${title}

${phaseSections}`;
}

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function main(): void {
	const args = process.argv.slice(2);
	if (args.length !== 2) {
		fail('usage: bun run knowledge:new <domain> <slug>');
	}
	const [domain, slug] = args;

	if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
		fail(`slug must match /^[a-z][a-z0-9-]*$/ (got '${slug}')`);
	}
	if (!ACCEPTED_DOMAINS.has(domain)) {
		fail(`unknown domain '${domain}'. Accepted: ${[...ACCEPTED_DOMAINS].sort().join(', ')}`);
	}

	const repoRoot = resolve(import.meta.dir, '..');
	const targetPath = resolve(repoRoot, 'course', 'knowledge', domain, slug, 'node.md');

	if (existsSync(targetPath)) {
		fail(`file already exists: ${targetPath}`);
	}

	mkdirSync(dirname(targetPath), { recursive: true });
	writeFileSync(targetPath, nodeTemplate(domain, slug), 'utf8');

	process.stdout.write(`created ${targetPath}\n`);
}

main();

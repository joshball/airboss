/**
 * Materialize study.card rows from inline `yaml-cards` blocks in
 * `course/knowledge/**\/node.md` for a given user.
 *
 * Strategy: for each node.md that has an inline ```yaml-cards``` fenced
 * block (typically inside the `## Practice` section), delete the target
 * user's existing course-sourced cards for that node, then insert the
 * authored set. Wholesale-replace per (user, node) so re-runs are
 * idempotent. Personal cards (sourceType = 'personal') are never touched.
 *
 * Cards are linked to the knowledge graph by setting `node_id` to the
 * node's slug and `source_type = 'course'` / `is_editable = false`. Once
 * inserted, they flow through the normal `/memory/review` FSRS queue.
 *
 * Complements `scripts/build-knowledge-index.ts`, which owns the
 * knowledge_node + knowledge_edge tables. This module owns the per-user
 * card materialization only.
 *
 * Exports `seedCardsForUser(userEmail)` for the `db seed` orchestrator.
 */

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { bauthUser } from '@ab/auth/schema';
import { card, createCard } from '@ab/bc-study/server';
import { CONTENT_SOURCES, DEV_DB_HOST_PATTERN, DEV_DB_URL, ENV_VARS } from '@ab/constants';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parse as parseYaml } from 'yaml';
// Pure parser is in its own module so unit tests can exercise it
// without pulling in this file's bun-only Glob walk + DB-touching
// `@ab/bc-study/server` import chain.
import { extractCardsFromBody, type ParsedCard } from './seed-cards-parser';

const REPO_ROOT = new URL('../../', import.meta.url).pathname;
const NODE_GLOB = 'course/knowledge/**/node.md';
const FRONTMATTER_DELIM = '---';

interface NodeWithCards {
	relPath: string;
	nodeId: string;
	domain: string;
	cards: ParsedCard[];
}

export interface SeedCardsResult {
	userEmail: string;
	nodesTouched: number;
	cardsInserted: number;
	cardsRemoved: number;
}

function splitFrontmatter(text: string): { yaml: string; body: string } | null {
	if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) return null;
	const end = text.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
	if (end === -1) return null;
	const yaml = text.slice(FRONTMATTER_DELIM.length + 1, end);
	const bodyStart = end + `\n${FRONTMATTER_DELIM}`.length;
	const body = text.slice(bodyStart).replace(/^\r?\n/, '');
	return { yaml, body };
}

function collectNodesWithCards(): NodeWithCards[] {
	const glob = new Glob(NODE_GLOB);
	const results: NodeWithCards[] = [];
	for (const file of glob.scanSync({ cwd: REPO_ROOT, absolute: true })) {
		const raw = readFileSync(file, 'utf8');
		const relPath = relative(REPO_ROOT, file);
		const split = splitFrontmatter(raw);
		if (!split) continue;
		const frontmatter = parseYaml(split.yaml) as Record<string, unknown> | null;
		if (!frontmatter || typeof frontmatter.id !== 'string' || typeof frontmatter.domain !== 'string') continue;
		const cards = extractCardsFromBody(split.body, relPath);
		if (cards.length === 0) continue;
		results.push({ relPath, nodeId: frontmatter.id, domain: frontmatter.domain, cards });
	}
	return results;
}

export async function seedCardsForUser(userEmail: string): Promise<SeedCardsResult> {
	const connectionString = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
	if (!DEV_DB_HOST_PATTERN.test(connectionString)) {
		throw new Error('Refusing to seed: DATABASE_URL does not point at a local dev database.');
	}

	const nodes = collectNodesWithCards();
	if (nodes.length === 0) {
		process.stdout.write('No nodes with inline yaml-cards blocks found. Nothing to seed.\n');
		return { userEmail, nodesTouched: 0, cardsInserted: 0, cardsRemoved: 0 };
	}

	const client = postgres(connectionString);
	const db = drizzle(client);

	try {
		const [userRow] = await db
			.select({ id: bauthUser.id })
			.from(bauthUser)
			.where(eq(bauthUser.email, userEmail))
			.limit(1);
		if (!userRow) {
			throw new Error(`User not found: ${userEmail}`);
		}
		const userId = userRow.id;

		let cardsInserted = 0;
		let cardsRemoved = 0;

		process.stdout.write(`\nseed-cards: ${userEmail}\n`);
		for (const node of nodes) {
			const existing = await db
				.delete(card)
				.where(and(eq(card.userId, userId), eq(card.nodeId, node.nodeId), eq(card.sourceType, CONTENT_SOURCES.COURSE)))
				.returning({ id: card.id });
			cardsRemoved += existing.length;

			for (const c of node.cards) {
				await createCard(
					{
						userId,
						front: c.front,
						back: c.back,
						domain: node.domain,
						cardType: c.cardType,
						kind: c.kind,
						tags: c.tags,
						sourceType: CONTENT_SOURCES.COURSE,
						sourceRef: node.nodeId,
						nodeId: node.nodeId,
						isEditable: false,
						questionTier: c.questionTier,
						sourceAuthority: c.sourceAuthority,
						acsCodes: c.acsCodes,
					},
					db,
				);
				cardsInserted++;
			}
			process.stdout.write(`  ${node.nodeId.padEnd(36)} ${existing.length} removed / ${node.cards.length} inserted\n`);
		}

		process.stdout.write(`  nodes touched : ${nodes.length}\n`);
		process.stdout.write(`  cards removed : ${cardsRemoved}\n`);
		process.stdout.write(`  cards inserted: ${cardsInserted}\n`);

		return { userEmail, nodesTouched: nodes.length, cardsInserted, cardsRemoved };
	} finally {
		await client.end();
	}
}

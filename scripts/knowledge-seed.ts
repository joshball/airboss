#!/usr/bin/env bun
/**
 * Seed course-sourced study.card rows from inline `yaml-cards` blocks in
 * `course/knowledge/**\/node.md`.
 *
 * Usage:
 *   bun scripts/knowledge-seed.ts --user <email>
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
 * knowledge_node + knowledge_edge tables. This script owns the per-user
 * card materialization only.
 */

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parse as parseYaml } from 'yaml';
import { bauthUser } from '../libs/auth/src/schema';
import { card, createCard } from '../libs/bc/study/src/index';
import { CARD_TYPES, CONTENT_SOURCES, DEV_DB_HOST_PATTERN, DEV_DB_URL, ENV_VARS } from '../libs/constants/src/index';

const REPO_ROOT = new URL('../', import.meta.url).pathname;
const NODE_GLOB = 'course/knowledge/**/node.md';
const FRONTMATTER_DELIM = '---';
const YAML_CARDS_FENCE = /^```yaml-cards\s*$/;
const FENCE_CLOSE = /^```\s*$/;

interface ParsedCard {
	front: string;
	back: string;
	cardType: string;
	tags: string[];
}

interface NodeWithCards {
	relPath: string;
	nodeId: string;
	domain: string;
	cards: ParsedCard[];
}

const cardTypeSet = new Set<string>(Object.values(CARD_TYPES));

function parseArgs(argv: readonly string[]): { userEmail: string | null } {
	let userEmail: string | null = null;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--user') {
			userEmail = argv[i + 1] ?? null;
			i++;
		}
	}
	return { userEmail };
}

/** Split a node.md into its frontmatter and body. Returns null on malformed input. */
function splitFrontmatter(text: string): { yaml: string; body: string } | null {
	if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) return null;
	const end = text.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
	if (end === -1) return null;
	const yaml = text.slice(FRONTMATTER_DELIM.length + 1, end);
	const bodyStart = end + `\n${FRONTMATTER_DELIM}`.length;
	const body = text.slice(bodyStart).replace(/^\r?\n/, '');
	return { yaml, body };
}

/** Pull every `yaml-cards` fenced block out of a node body and return parsed card objects. */
function extractCardsFromBody(body: string, relPath: string): ParsedCard[] {
	const lines = body.split(/\r?\n/);
	const cards: ParsedCard[] = [];
	let i = 0;
	while (i < lines.length) {
		if (!YAML_CARDS_FENCE.test(lines[i])) {
			i++;
			continue;
		}
		const start = i + 1;
		let end = start;
		while (end < lines.length && !FENCE_CLOSE.test(lines[end])) end++;
		const block = lines.slice(start, end).join('\n');
		const parsed = parseYaml(block);
		if (!Array.isArray(parsed)) {
			throw new Error(`${relPath}: yaml-cards block did not parse to an array`);
		}
		for (let j = 0; j < parsed.length; j++) {
			const entry = parsed[j];
			if (typeof entry !== 'object' || entry === null) {
				throw new Error(`${relPath}: yaml-cards[${j}] is not an object`);
			}
			const rec = entry as Record<string, unknown>;
			if (typeof rec.front !== 'string' || rec.front.trim() === '') {
				throw new Error(`${relPath}: yaml-cards[${j}].front is required`);
			}
			if (typeof rec.back !== 'string' || rec.back.trim() === '') {
				throw new Error(`${relPath}: yaml-cards[${j}].back is required`);
			}
			const cardType = typeof rec.cardType === 'string' ? rec.cardType : CARD_TYPES.BASIC;
			if (!cardTypeSet.has(cardType)) {
				throw new Error(`${relPath}: yaml-cards[${j}].cardType '${cardType}' is not in CARD_TYPES`);
			}
			const tags: string[] = [];
			if (Array.isArray(rec.tags)) {
				for (const tag of rec.tags) {
					if (typeof tag === 'string' && tag.trim() !== '') tags.push(tag.trim());
				}
			}
			cards.push({ front: rec.front.trim(), back: rec.back.trim(), cardType, tags });
		}
		i = end + 1;
	}
	return cards;
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

async function main(): Promise<void> {
	const { userEmail } = parseArgs(process.argv.slice(2));
	if (!userEmail) {
		process.stderr.write('usage: bun scripts/knowledge-seed.ts --user <email>\n');
		process.exit(1);
	}

	const connectionString = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
	if (!DEV_DB_HOST_PATTERN.test(connectionString)) {
		process.stderr.write('Refusing to seed: DATABASE_URL does not point at a local dev database.\n');
		process.exit(1);
	}

	let nodes: NodeWithCards[];
	try {
		nodes = collectNodesWithCards();
	} catch (err) {
		process.stderr.write(`knowledge-seed: ${(err as Error).message}\n`);
		process.exit(1);
	}

	if (nodes.length === 0) {
		process.stdout.write('No nodes with inline yaml-cards blocks found. Nothing to seed.\n');
		return;
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
			process.stderr.write(`User not found: ${userEmail}\n`);
			process.exit(1);
		}
		const userId = userRow.id;

		let cardsInserted = 0;
		let cardsRemoved = 0;

		process.stdout.write(`\nknowledge-seed: ${userEmail}\n`);
		for (const node of nodes) {
			// Wholesale replace: delete existing course cards for this user+node,
			// then re-insert. createCard runs zod + creates card_state in a tx.
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
						tags: c.tags,
						sourceType: CONTENT_SOURCES.COURSE,
						sourceRef: node.nodeId,
						nodeId: node.nodeId,
						isEditable: false,
					},
					db,
				);
				cardsInserted++;
			}
			process.stdout.write(`  ${node.nodeId.padEnd(36)} ${existing.length} removed / ${node.cards.length} inserted\n`);
		}

		process.stdout.write(`\nnodes touched : ${nodes.length}\n`);
		process.stdout.write(`cards removed : ${cardsRemoved}\n`);
		process.stdout.write(`cards inserted: ${cardsInserted}\n`);
	} finally {
		await client.end();
	}
}

main().catch((err) => {
	process.stderr.write(`knowledge-seed: unexpected failure: ${(err as Error).stack ?? err}\n`);
	process.exit(1);
});

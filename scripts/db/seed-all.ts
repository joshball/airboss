#!/usr/bin/env bun
/**
 * Seed orchestrator for the local dev DB.
 *
 * Runs three phases in order, each idempotent:
 *
 *   1. users      -- better-auth rows for DEV_ACCOUNTS (scripts/db/seed-dev-users.ts)
 *   2. knowledge  -- knowledge_node + knowledge_edge from course/knowledge/**\/node.md
 *                    (scripts/build-knowledge-index.ts, full build)
 *   3. cards      -- study.card rows from inline yaml-cards blocks for every
 *                    DEV_ACCOUNTS user (scripts/db/seed-cards.ts :: seedCardsForUser)
 *
 * Usage:
 *   bun scripts/db/seed-all.ts            # all three phases
 *   bun scripts/db/seed-all.ts users      # only users
 *   bun scripts/db/seed-all.ts knowledge  # only knowledge graph build
 *   bun scripts/db/seed-all.ts cards      # only card materialization
 */

import { resolve } from 'node:path';
import { DEV_ACCOUNTS } from '../../libs/constants/src/index';
import { seedCardsForUser } from './seed-cards';

type Phase = 'users' | 'knowledge' | 'cards';

const PHASES: readonly Phase[] = ['users', 'knowledge', 'cards'] as const;
const REPO_ROOT = resolve(import.meta.dir, '..', '..');

function isPhase(value: string): value is Phase {
	return (PHASES as readonly string[]).includes(value);
}

async function runSubprocess(cmd: string[]): Promise<void> {
	const proc = Bun.spawn(cmd, { cwd: REPO_ROOT, stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`subprocess failed (exit ${code}): ${cmd.join(' ')}`);
	}
}

async function phaseUsers(): Promise<void> {
	process.stdout.write('\n=== seed: users ===\n');
	await runSubprocess(['bun', 'scripts/db/seed-dev-users.ts']);
}

async function phaseKnowledge(): Promise<void> {
	process.stdout.write('\n=== seed: knowledge ===\n');
	await runSubprocess(['bun', 'scripts/build-knowledge-index.ts']);
}

async function phaseCards(): Promise<void> {
	process.stdout.write('\n=== seed: cards ===\n');
	for (const account of DEV_ACCOUNTS) {
		await seedCardsForUser(account.email);
	}
}

const PHASE_FNS: Record<Phase, () => Promise<void>> = {
	users: phaseUsers,
	knowledge: phaseKnowledge,
	cards: phaseCards,
};

async function main(): Promise<void> {
	const target = process.argv[2];
	const phases: readonly Phase[] = target ? [target].filter(isPhase) : PHASES;

	if (target && phases.length === 0) {
		process.stderr.write(`seed-all: unknown phase '${target}'. Expected one of: ${PHASES.join(', ')}\n`);
		process.exit(1);
	}

	for (const phase of phases) {
		await PHASE_FNS[phase]();
	}

	process.stdout.write('\nseed: done.\n');
}

main().catch((err) => {
	process.stderr.write(`seed-all: ${(err as Error).stack ?? err}\n`);
	process.exit(1);
});

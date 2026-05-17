#!/usr/bin/env bun
/**
 * CLI wrapper for the course seed pipeline.
 *
 * The seed pipeline proper lives in the BC at `libs/bc/study/src/seed-courses.ts`
 * (value-exported from `@ab/bc-study/server`) -- apps depend on libs, not on
 * `scripts/`, and the hangar course editor is now a runtime consumer of the
 * pipeline. This file adds only argv parsing + the process-exit shell.
 *
 * Usage:
 *   bun scripts/db/seed-courses.ts                  # every course dir
 *   bun scripts/db/seed-courses.ts <slug>           # one course
 *   bun scripts/db/seed-courses.ts --dir <path>     # custom courses root
 *                                                   # (defaults to course/courses/)
 *
 * The dispatcher (`bun run db seed courses`) wires through to this script;
 * see `scripts/db.ts`.
 */

import { resolve } from 'node:path';
import { CourseSeedError, type SeedCoursesOptions, seedCourses } from '@ab/bc-study/server';
import { client } from '@ab/db/connection';

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	// Walk argv and split into options + positional. `--dir <path>`
	// consumes the next slot as its value; everything else that starts
	// with `-` is dropped (no other flags today). The first remaining
	// positional is treated as a course slug to scope the seed.
	let customDir: string | undefined;
	const positional: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === '--dir') {
			customDir = args[i + 1];
			i += 1;
			continue;
		}
		if (arg !== undefined && !arg.startsWith('-')) {
			positional.push(arg);
		}
	}
	const slug = positional[0];

	const options: SeedCoursesOptions = {};
	if (slug) options.slug = slug;
	if (customDir) options.coursesDir = resolve(process.cwd(), customDir);

	const summary = await seedCourses(options);
	process.stdout.write(
		`seed-courses: ${summary.coursesScanned} scanned (${summary.coursesUpserted} written, ${summary.coursesSkipped} unchanged), ` +
			`${summary.stepsScanned} step rows scanned (${summary.stepsUpserted} written, ${summary.stepsSkipped} unchanged)\n`,
	);
}

if (import.meta.main) {
	main()
		.catch((err) => {
			if (err instanceof CourseSeedError) {
				process.stderr.write(`seed-courses: ${err.message}\n`);
			} else {
				process.stderr.write(`seed-courses: ${(err as Error).stack ?? err}\n`);
			}
			process.exitCode = 1;
		})
		.finally(() => client.end());
}

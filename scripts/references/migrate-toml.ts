/**
 * One-shot migration: read the in-memory AVIATION_REFERENCES + SOURCES
 * arrays, emit `libs/db/seed/glossary.toml` and `libs/db/seed/sources.toml`.
 *
 * Run once (committed for reproducibility). After this lands, the TOML
 * files are authoritative and the TS array literals are deleted.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AVIATION_REFERENCES } from '../../libs/aviation/src/references/aviation';
import { SOURCES } from '../../libs/aviation/src/sources/registry';
import { encodeReferences, encodeSources } from '../../libs/aviation/src/toml-codec';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const GLOSSARY_PATH = join(REPO_ROOT, 'libs/db/seed/glossary.toml');
const SOURCES_PATH = join(REPO_ROOT, 'libs/db/seed/sources.toml');

async function writeTarget(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, 'utf8');
	console.log(`wrote ${path} (${content.length} bytes)`);
}

async function main(): Promise<void> {
	const glossaryToml = encodeReferences(AVIATION_REFERENCES);
	const sourcesToml = encodeSources(SOURCES);
	await writeTarget(GLOSSARY_PATH, glossaryToml);
	await writeTarget(SOURCES_PATH, sourcesToml);
	console.log(`references=${AVIATION_REFERENCES.length} sources=${SOURCES.length}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

#!/usr/bin/env bun

/**
 * Hazard product decoder CLI.
 *
 * Reads raw AWC / NWS bulletin text from stdin, a file, or an inline
 * --text argument, and renders a decoded, pilot-friendly view.
 *
 *   bun run hazards                            # help
 *   bun run hazards decode --stdin             # paste/pipe input
 *   bun run hazards decode --file path.txt     # read from file
 *   bun run hazards decode --text "WSUS31 ..." # one-liner
 *
 *   --tz <iana>        local timezone for the dual-time display (default: UTC)
 *   --no-color         disable ANSI color
 *   --raw              include the source text under the decoded view
 *   --json             machine-readable output
 *
 * Phase 1 supports Convective SIGMET and Severe Thunderstorm Warning.
 * The flag scaffold (--sigmet, --svr, --airmet, ...) is reserved for
 * Phase 2-3 product additions and accepted as no-ops today.
 */

import { readFileSync } from 'node:fs';
import { decodeHazardText, formatHazards } from '@ab/wx-explain';

interface DecodeArgs {
	source: { kind: 'stdin' } | { kind: 'file'; path: string } | { kind: 'text'; text: string };
	tz: string;
	color: boolean;
	includeRaw: boolean;
	asJson: boolean;
}

function printIndex(): void {
	console.log('Usage: bun run hazards <command> [options]');
	console.log('');
	console.log('Commands:');
	console.log('  decode      Decode pasted / piped / file bulletin text');
	console.log('  help        Show this index');
	console.log('');
	console.log('Decode options:');
	console.log('  --stdin              read raw text from stdin');
	console.log('  --file <path>        read raw text from a file');
	console.log('  --text "<bulletin>"  inline raw text');
	console.log('  --tz <iana>          local timezone (default: UTC)');
	console.log('  --no-color           disable ANSI color');
	console.log('  --raw                include the source text below the decoded view');
	console.log('  --json               machine-readable output');
	console.log('');
	console.log('Supported in Phase 1: Convective SIGMET, Severe Thunderstorm Warning');
	console.log('Reserved for later phases: --sigmet, --airmet, --cwa, --tor, --mcd, --ww (no-op today)');
}

async function commandDecode(rest: string[]): Promise<number> {
	const args = parseDecodeArgs(rest);
	if (!args) return 1;
	const raw = await readSource(args.source);
	if (raw.trim() === '') {
		console.error('hazards: no input received');
		return 1;
	}
	const result = decodeHazardText(raw);
	if (args.asJson) {
		console.log(JSON.stringify(result, null, 2));
		return 0;
	}
	const out = formatHazards(result.hazards, {
		color: args.color,
		tz: args.tz,
		includeRaw: args.includeRaw,
	});
	console.log(out);
	if (result.unrecognized.length > 0) {
		console.error('');
		console.error(`hazards: ${result.unrecognized.length} unrecognized block(s) skipped`);
	}
	return result.hazards.length > 0 ? 0 : 2;
}

function parseDecodeArgs(rest: string[]): DecodeArgs | null {
	let source: DecodeArgs['source'] | null = null;
	let tz = 'UTC';
	let color = process.stdout.isTTY && process.env.NO_COLOR == null;
	let includeRaw = false;
	let asJson = false;

	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		switch (arg) {
			case '--stdin':
				source = { kind: 'stdin' };
				break;
			case '--file': {
				const path = rest[++i];
				if (!path) {
					console.error('hazards decode: --file requires a path');
					return null;
				}
				source = { kind: 'file', path };
				break;
			}
			case '--text': {
				const text = rest[++i];
				if (!text) {
					console.error('hazards decode: --text requires a quoted bulletin');
					return null;
				}
				source = { kind: 'text', text };
				break;
			}
			case '--tz': {
				const value = rest[++i];
				if (!value) {
					console.error('hazards decode: --tz requires an IANA name');
					return null;
				}
				tz = value;
				break;
			}
			case '--no-color':
				color = false;
				break;
			case '--color':
				color = true;
				break;
			case '--raw':
				includeRaw = true;
				break;
			case '--json':
				asJson = true;
				break;
			case '--sigmet':
			case '--airmet':
			case '--cwa':
			case '--tor':
			case '--mcd':
			case '--ww':
			case '--svr':
			case '--aviation':
			case '--public':
			case '--severe':
				// Reserved -- product filtering ships in Phase 2-3. Accept
				// silently so docs/help can advertise the flag scaffold.
				break;
			default:
				console.error(`hazards decode: unknown flag "${arg}"`);
				return null;
		}
	}
	if (!source) {
		console.error('hazards decode: one of --stdin / --file / --text is required');
		return null;
	}
	return { source, tz, color, includeRaw, asJson };
}

async function readSource(source: DecodeArgs['source']): Promise<string> {
	switch (source.kind) {
		case 'stdin':
			return readStdin();
		case 'file':
			return readFileSync(source.path, 'utf8');
		case 'text':
			return source.text;
	}
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString('utf8');
}

const argv = process.argv.slice(2);
const [head, ...rest] = argv;
let exitCode = 0;
switch (head) {
	case undefined:
	case 'help':
	case '--help':
	case '-h':
		printIndex();
		break;
	case 'decode':
		exitCode = await commandDecode(rest);
		break;
	default:
		console.error(`hazards: unknown command "${head}"`);
		printIndex();
		exitCode = 1;
}
process.exit(exitCode);

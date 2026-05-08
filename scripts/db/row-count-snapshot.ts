/**
 * One-shot row-count + content-hash digest of the seeded reference tables.
 * Used by the COPY-ingest perf branch to verify parity between the row-by-row
 * baseline and the bulk path. Pure read; safe to run any time.
 *
 * Output is deterministic so a `diff` between two runs is the parity check.
 */

import { client } from '@ab/db/connection';

interface Snapshot {
	readonly references: number;
	readonly sections: number;
	readonly figures: number;
	readonly sectionsByDepth: Record<number, number>;
	readonly sectionsContentMdLength: number;
	readonly figuresWithDimensions: number;
}

async function snapshot(): Promise<Snapshot> {
	const [refRow] = await client`SELECT count(*)::int AS n FROM study.reference`;
	const [secRow] = await client`SELECT count(*)::int AS n FROM study.reference_section`;
	const [figRow] = await client`SELECT count(*)::int AS n FROM study.reference_figure`;
	const depthRows = await client<
		{ depth: number; n: number }[]
	>`SELECT depth, count(*)::int AS n FROM study.reference_section GROUP BY depth ORDER BY depth`;
	const [lenRow] =
		await client`SELECT COALESCE(SUM(length(content_md))::bigint, 0)::text AS s FROM study.reference_section`;
	const [figDimRow] =
		await client`SELECT count(*)::int AS n FROM study.reference_figure WHERE width IS NOT NULL AND height IS NOT NULL`;

	const sectionsByDepth: Record<number, number> = {};
	for (const row of depthRows) sectionsByDepth[row.depth] = row.n;

	const refN = (refRow as { n: number } | undefined)?.n ?? 0;
	const secN = (secRow as { n: number } | undefined)?.n ?? 0;
	const figN = (figRow as { n: number } | undefined)?.n ?? 0;
	const lenS = (lenRow as { s: string } | undefined)?.s ?? '0';
	const figDimN = (figDimRow as { n: number } | undefined)?.n ?? 0;

	return {
		references: refN,
		sections: secN,
		figures: figN,
		sectionsByDepth,
		sectionsContentMdLength: Number.parseInt(lenS, 10),
		figuresWithDimensions: figDimN,
	};
}

async function main(): Promise<void> {
	const s = await snapshot();
	console.log(JSON.stringify(s, null, 2));
	await client.end();
}

void main();

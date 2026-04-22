# data/sources/

Downloaded source binaries for the reference extraction pipeline (14 CFR XML, AIM PDF, POH PDFs, NTSB CSV dumps, etc.). Organized by `SourceType`.

Per reference-system architecture [decision #2](../../docs/work/todos/20260422-reference-system-architecture.md), the binaries themselves are **gitignored**. The sidecar `<source-id>.meta.json` files next to each binary are **committed** so a fresh clone can re-download and verify.

## Layout

```text
data/sources/
  README.md                     This file.
  cfr/
    .gitkeep                    Placeholder so the folder lives in git.
    <source-id>.xml             Downloaded CFR XML (gitignored).
    <source-id>.xml.meta.json   Sidecar metadata (committed).
  aim/                          Same pattern for AIM PDFs.
  phak/                         PHAK.
  afh/                          Airplane Flying Handbook.
  ifh/                          Instrument Flying Handbook.
  pcg/                          Pilot/Controller Glossary.
  poh/                          Aircraft POHs, one file per make/model/year.
  ntsb/                         NTSB accident CSV dumps.
  aopa/                         AOPA article archives.
  ac/                           FAA Advisory Circulars.
  faa-safety/                   FAASTeam notices.
  sop/                          Standard operating procedures.
```

## Sidecar `.meta.json` shape

One `<source-id>.meta.json` per downloaded binary, next to the binary. Committed even when the binary is not. Schema: `SourceMeta` from `libs/aviation/src/sources/meta.ts`.

```json
{
  "sourceId": "cfr-14",
  "version": "revised-2026-01-01",
  "url": "https://www.govinfo.gov/bulkdata/CFR/2026/title-14/CFR-2026-title14.xml",
  "checksum": "sha256-hex-string",
  "downloadedAt": "2026-04-22T15:30:00.000Z",
  "format": "xml",
  "sizeBytes": 12582912
}
```

## Workflow

1. Download the binary. Drop it at the path the registry entry names (`libs/aviation/src/sources/registry.ts`).
2. Compute its sha256 (`shasum -a 256 data/sources/cfr/cfr-14.xml`).
3. Write `<source-id>.meta.json` next to it with the real checksum, size, and download timestamp.
4. Update the corresponding entry in `libs/aviation/src/sources/registry.ts` -- swap `PENDING_DOWNLOAD` sentinels for the real checksum and `downloadedAt` value.
5. Run `bun run check` -- the validator verifies the on-disk sha256 matches the registry entry.
6. Run extraction: `bun scripts/references/extract.ts --source <type>`.

## Size report

`bun scripts/references/size-report.ts` tallies everything under `data/sources/` and flags each file as commit / LFS / external-storage per the thresholds in the design doc. Run periodically to catch when a new source pushes a type over 5 MB (LFS) or 100 MB (external).

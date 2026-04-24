---
title: 'Design: Hangar sources v1'
product: hangar
feature: hangar-sources-v1
type: design
status: unread
review_status: pending
---

# Design: Hangar sources v1

## Flow diagram component

Single Svelte component under `apps/hangar/src/lib/components/FlowDiagram.svelte`. Accepts a typed `FlowState` prop:

```typescript
interface FlowState {
  content: { wikiLinkCount: number; helpPageCount: number; tbdCount: number };
  manifest: { citedCount: number; scannedAt: string | null; scanJobId: string | null };
  validation: { errors: number; warnings: number; runAt: string | null; validateJobId: string | null };
  sources: SourceRowState[];
  glossary: { referenceCount: number; sourceCount: number };
}

interface SourceRowState {
  id: string;
  type: string;
  title: string;
  version: string | null;
  state: 'pending' | 'downloaded' | 'extracted';
  citedBy: number;
  verbatimMaterialised: number;
  activeJob: { id: string; kind: JobKind } | null;
}
```

Nodes are sub-components: `ContentNode.svelte`, `ManifestNode.svelte`, `ValidationNode.svelte`, `SourceRow.svelte`, `RegistryMergeNode.svelte`, `GlossaryNode.svelte`.

Arrows: SVG paths between node centres. `activeJob != null` on a connected node toggles a CSS class that animates `stroke-dashoffset` via `--motion-dash-duration` token.

Keyboard: each node is a `<section>` with `role="group"`; each button is a native `<button>`. Tab order flows visually.

## Job handler shape

```typescript
// libs/hangar-jobs/src/handlers/references.ts

import { spawn } from 'bun';

export const fetchHandler: JobHandler<'fetch'> = {
  kind: 'fetch',
  async run(job, ctx) {
    const { sourceId, url } = job.payload as { sourceId: string; url: string };
    await ctx.log('event', `fetch starting for ${sourceId} from ${url}`);
    const proc = spawn(['bun', 'run', 'references', 'download', '--id', sourceId], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = new Response(proc.stdout);
    const err = new Response(proc.stderr);
    const [outText, errText, code] = await Promise.all([out.text(), err.text(), proc.exited]);
    for (const line of outText.split('\n')) if (line) await ctx.log('stdout', line);
    for (const line of errText.split('\n')) if (line) await ctx.log('stderr', line);
    if (code !== 0) throw new Error(`fetch exit ${code}`);
    return { kind: 'fetch', sha256: parseShaFromOutput(outText) };
  },
};
```

(The actual implementation streams incrementally via a reader rather than awaiting the full text — simplified here for readability.)

## Upload handler

```typescript
// Not subprocess-based
export const uploadHandler: JobHandler<'upload'> = {
  kind: 'upload',
  async run(job, ctx) {
    const { sourceId, tmpPath, originalName, size } = job.payload;
    const source = await getSource(sourceId);
    const dest = sourceBinaryPath(source);

    // Archive current if exists + version changed
    if (await exists(dest) && source.version && payloadVersion !== source.version) {
      const archive = archivePath(source);
      await rename(dest, archive);
      await ctx.log('event', `archived ${dest} -> ${archive}`);
    }

    await rename(tmpPath, dest);
    const sha = await sha256OfFile(dest);
    if (sha === source.checksum) {
      await ctx.log('event', `no change (sha match)`);
      return { kind: 'upload', outcome: 'no-change' };
    }

    await updateSource(source.id, {
      checksum: sha,
      downloadedAt: new Date(),
      sizeBytes: size,
      rev: source.rev + 1,
    });
    await auditWrite({ action: 'upload', targetType: 'hangar.source', targetId: sourceId, actorId: job.actorId });
    return { kind: 'upload', outcome: 'replaced', sha };
  },
};
```

## Preview components

Per-extension previewer. Only load the component that matches.

```text
apps/hangar/src/lib/components/preview/
  XmlPreview.svelte     (prism-highlighted, pretty-printed)
  JsonPreview.svelte    (prism-highlighted)
  MarkdownPreview.svelte (reuse MarkdownBody from libs/help)
  PdfPreview.svelte     (<object type="application/pdf">)
  CsvPreview.svelte     (DataTable with first 50 rows)
  BinaryPreview.svelte  ("no preview" + Download link)
```

Dispatch table in `files/+page.svelte` keyed on extension.

## Diff renderer

```typescript
interface DiffResult {
  changed: ChangedId[];
  added: string[];
  removed: string[];
}

interface ChangedId {
  id: string;
  hunks: Hunk[];
}

interface Hunk {
  contextBefore: string[];
  removed: string[];
  added: string[];
  contextAfter: string[];
}
```

Component: `DiffViewer.svelte`. Per-id collapsible `<details>`. Theme tokens for added lines (`--signal-success-bg` background tint), removed (`--signal-error-bg`), context (`--surface-base`).

## Concurrency

```text
        ┌─────────────┐
        │ user clicks │
        └──────┬──────┘
               │ enqueueJob({ target_id: X })
               ▼
        hangar.job row
               │
               │ worker pick-next
               ▼
     ┌─────────────────────┐
     │ lock: no running    │
     │ job with target_id  │
     │ = X                 │
     └─────┬───────────────┘
           │
   ┌───────┴────────┐
   │                │
   ▼                ▼
 run now      requeue
 (status       (stay queued;
 running)      skip this cycle;
               worker picks up
               once X is free)
```

## Theme token usage (examples)

```svelte
<!-- Source row states -->
<style>
  .row                        { background: var(--surface-base); color: var(--ink-1); }
  .row:hover                  { background: var(--surface-hover); }
  .row.state-pending          { color: var(--ink-2); }
  .row.state-downloaded       { color: var(--ink-1); }
  .row.state-extracted .pill  { background: var(--signal-success-bg); color: var(--signal-success-ink); }
  .row.busy .pill             { background: var(--signal-warn-bg); color: var(--signal-warn-ink); }
</style>
```

## Constants additions

```typescript
// libs/constants/src/sources.ts
export const SOURCE_ACTION_LIMITS = {
  MAX_UPLOAD_BYTES: 500 * 1024 * 1024,
  DOWNLOAD_TIMEOUT_MS: 120_000,
  DOWNLOAD_MAX_RETRIES: 3,
  ARCHIVE_RETENTION: 3,
} as const;

// libs/constants/src/jobs.ts (extended)
export const JOB_KINDS = {
  SYNC_TO_DISK: 'sync-to-disk',
  FETCH: 'fetch',
  UPLOAD: 'upload',
  EXTRACT: 'extract',
  BUILD: 'build',
  DIFF: 'diff',
  VALIDATE: 'validate',
  SIZE_REPORT: 'size-report',
} as const;
```

## Notes for the agent

- When porting FIRC components: grab the structural code + accessibility behaviour (keyboard, ARIA, focus trap). Discard all colour values, spacing numbers, and transition timings; replace with tokens.
- The flow diagram is the biggest visual deliverable. Get the structure + token compliance right before polishing animation.
- Every job handler must be cancellable — the worker's `ctx.isCancelled()` should be checked at loop boundaries inside long-running handlers.

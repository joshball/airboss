---
title: 'Design: Hangar registry'
product: hangar
feature: hangar-registry
type: design
status: unread
review_status: pending
---

# Design: Hangar registry

## Data flow

```text
  Author edits in hangar /glossary UI
             │
             ▼
  Zod validate + rev-check
             │
             ▼
  UPDATE hangar.reference SET ..., rev = rev+1, dirty = true
             │
             ▼                       audit.event insert
  (rows stay dirty until a sync)
             │
             ▼
  "Sync all pending" action
             │
             ▼
  enqueueJob({ kind: 'sync-to-disk', actor })
             │
             ▼
  Worker picks up job row
             │
             ├── detect-drift: pull dirty rows
             ├── detect-conflict: sha(disk.toml) vs sync_log.last_sha?
             ├── emit: toml-codec(snapshot) -> glossary.toml + sources.toml
             ├── git add + commit
             ├── mode = pr? -> push + gh pr create
             ├── mark rows dirty = false
             └── sync_log insert (outcome, sha, pr url)
```

## Schemas

### `hangar.reference`

```typescript
{
  id: varchar(128) primary key,      // slug, e.g. 'cfr-14-91-155'
  rev: integer not null default 1,   // optimistic lock
  display_name: text not null,
  aliases: jsonb not null default '[]',
  paraphrase: text not null,
  tags: jsonb not null,              // 5-axis ReferenceTags
  sources: jsonb not null default '[]',  // SourceCitation[]
  related: jsonb not null default '[]',  // string[]
  deleted_at: timestamptz,
  dirty: boolean not null default false,
  last_synced_sha: varchar(40),
  last_synced_at: timestamptz,
  updated_at: timestamptz not null default now(),
  updated_by: varchar(128)
}
```

### `hangar.source`

```typescript
{
  id: varchar(64) primary key,
  rev: integer not null default 1,
  type: varchar(64) not null,        // source type enum
  title: text not null,
  version: text,
  url: text,
  locator_shape: jsonb,              // schema description for this source type
  checksum: varchar(64),             // sha256 of downloaded binary
  downloaded_at: timestamptz,
  format: varchar(32),               // 'xml' | 'pdf' | 'csv' | ...
  size_bytes: bigint,
  dirty: boolean not null default false,
  last_synced_sha: varchar(40),
  last_synced_at: timestamptz,
  updated_at: timestamptz not null default now(),
  updated_by: varchar(128)
}
```

### `hangar.sync_log`

```typescript
{
  id: varchar(64) primary key,       // sync_ULID
  actor_id: varchar(128) not null,
  kind: text not null,               // 'commit-local' | 'pr'
  files: jsonb not null,             // ["libs/db/seed/glossary.toml", ...]
  commit_sha: varchar(40),
  pr_url: text,
  outcome: text not null,            // 'success' | 'conflict' | 'failed' | 'noop'
  message: text,
  started_at: timestamptz not null default now(),
  finished_at: timestamptz
}
```

### `hangar.job` + `hangar.job_log`

```typescript
job {
  id: varchar(64) primary key,       // job_ULID
  kind: text not null,
  target_type: text,
  target_id: varchar(128),
  status: text not null,             // queued | running | complete | failed | cancelled
  progress: jsonb,
  result: jsonb,
  error: text,
  actor_id: varchar(128) not null,
  created_at: timestamptz not null default now(),
  started_at: timestamptz,
  finished_at: timestamptz
}

job_log {
  id: bigserial primary key,
  job_id: varchar(64) not null references job(id),
  seq: integer not null,
  stream: text not null,             // stdout | stderr | event
  line: text not null,
  at: timestamptz not null default now()
}
-- unique (job_id, seq) for deterministic ordering
```

## Worker

```typescript
// libs/hangar-jobs/src/worker.ts

export interface JobHandler<K extends JobKind> {
  kind: K;
  run(job: Job, ctx: HandlerContext): Promise<JobResult>;
}

export interface HandlerContext {
  log: (stream: 'stdout' | 'stderr' | 'event', line: string) => Promise<void>;
  progress: (update: JobProgress) => Promise<void>;
  isCancelled: () => boolean;
}

export function startWorker(opts: {
  handlers: JobHandler<JobKind>[];
  pollIntervalMs?: number;
}): WorkerHandle;
```

Per-`targetId` serialisation: the worker's pick-next query is

```sql
select id
  from hangar.job j
 where status = 'queued'
   and (
     target_id is null
     or not exists (
       select 1 from hangar.job k
        where k.target_id = j.target_id
          and k.status = 'running'
     )
   )
 order by created_at asc
 for update skip locked
 limit 1;
```

## Sync algorithm (detail)

```typescript
// libs/hangar-sync/src/run.ts (paraphrased)

export async function runSync(input: SyncInput): Promise<SyncOutcome> {
  return db.transaction(async (tx) => {
    // 1. Advisory lock (single sync at a time)
    await tx.execute(sql`select pg_advisory_xact_lock(${SYNC_LOCK_KEY})`);

    // 2. Read dirty rows
    const refs = await tx.select().from(reference).where(eq(reference.dirty, true));
    const srcs = await tx.select().from(source).where(eq(source.dirty, true));
    if (refs.length === 0 && srcs.length === 0) return { outcome: 'noop' };

    // 3. Conflict check
    const onDiskSha = await sha256OfFile(GLOSSARY_PATH);
    const lastSync = await tx.select().from(syncLog)
      .where(eq(syncLog.outcome, 'success'))
      .orderBy(desc(syncLog.finishedAt))
      .limit(1);
    if (lastSync[0]?.fileHashes?.glossary !== onDiskSha) {
      return { outcome: 'conflict', diskDiff: await diffAgainstDb(onDiskSha), dbDiff: refs };
    }

    // 4. Emit snapshot + diff
    const allRefs = await tx.select().from(reference).where(isNull(reference.deletedAt));
    const nextGlossary = encodeReferences(toDomain(allRefs));
    const currentGlossary = await Bun.file(GLOSSARY_PATH).text();
    if (nextGlossary === currentGlossary) {
      // no-op after dirty rows were flipped back to clean elsewhere
      await markClean(tx, refs, srcs);
      return { outcome: 'noop' };
    }

    // 5. Write files
    await Bun.write(GLOSSARY_PATH, nextGlossary);
    await Bun.write(SOURCES_PATH, nextSources);

    // 6. Commit
    const sha = await gitCommit({
      files: [GLOSSARY_PATH, SOURCES_PATH],
      message: syncMessage(input.actorId, refs.length, srcs.length),
    });

    // 7. PR mode?
    const prUrl = input.mode === 'pr' ? await pushAndPr(sha) : null;

    // 8. Mark clean + log
    await markClean(tx, refs, srcs, sha);
    await tx.insert(syncLog).values({ ..., commitSha: sha, prUrl, outcome: 'success' });
    return { outcome: 'success', sha, prUrl };
  });
}
```

## Theme token usage (examples)

Wrong:

```svelte
<style>
  .row { background: #222; color: #eee; border-bottom: 1px solid #444; }
</style>
```

Right (names from [04-VOCABULARY.md](../../platform/theme-system/04-VOCABULARY.md)):

```svelte
<style>
  .row {
    background: var(--surface-base);
    color: var(--ink-1);
    border-bottom: 1px solid var(--edge-subtle);
  }
  .row:hover { background: var(--surface-hover); }
  .row[aria-selected='true'] { background: var(--surface-selected); }
  .dirty-badge { background: var(--signal-warn-bg); color: var(--signal-warn-ink); }
</style>
```

Sync action button:

```svelte
<button class="primary">Sync all pending</button>
<style>
  .primary {
    background: var(--action-primary-rest);
    color: var(--action-primary-ink);
  }
  .primary:hover { background: var(--action-primary-hover); }
  .primary:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  .primary:disabled { background: var(--disabled-bg); color: var(--disabled-ink); }
</style>
```

If any role above is missing from the vocabulary, stop and add it there first — do not invent local names.

## Open questions (resolved in spec; restating here)

- **Why not just serve the TOML parsed directly to hangar without a DB mirror?** Edits + optimistic locks + concurrent-write safety require transactional semantics. Files don't give you that.
- **Why a per-target-id serialisation in the worker instead of global?** Two fetches on different sources *should* run in parallel. Two fetches on the same source must not. Per-target is the tightest lock that matches the real constraint.
- **Why polling at 1 Hz, not SSE or Websockets?** Simpler server, fewer moving parts, good enough at `<100` active viewers. SSE is an option if the UX feels sluggish; not a required feature.
- **Why keep the audit log a separate table from `hangar.job_log`?** Audit is the durable cross-cutting record ("who did what"). Job log is per-job streaming output. They have different retention, different readers, different shapes.

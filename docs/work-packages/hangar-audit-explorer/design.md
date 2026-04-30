# Design: Hangar Audit Explorer

Companion to [spec.md](./spec.md). Notes the route shape, page composition, filter semantics, query patterns, and the boundary against sibling surfaces.

## Route shape

| Route                       | Purpose                                                                            | Loader inputs                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/admin/audit`              | Filtered list of `audit.audit_log` rows newest-first, cursor-paginated.            | `userId`, search params: `actor`, `targetType`, `targetId`, `op`, `window`, `from`, `to`, `cursor` |
| `/admin/audit/[id]`         | Single audit row in full: actor card, before / after / metadata panes, cross-links | `userId`, `id`                                                                            |

Both routes are gated `requireRole(ROLES.ADMIN)` at the page-server level. Layout-level gate (`AUTHOR | OPERATOR | ADMIN`) is too permissive for raw audit data.

## Page composition

### List (`/admin/audit`)

```text
[ PageHeader: "Audit log" -- subtitle: filter summary ("17 events -- last 24h, actor Abby") ]
[ Filter bar:
    Actor (search)        Target type (select)    Target id (text)
    Op (select)           Window: [1h] [24h*] [7d] [30d] [all] [custom] [Clear]
    (when custom):        From [datetime]  To [datetime]
]
[ Optional cap-banner ("Showing first 50 events. Refine the filters to narrow.") ]
[ Table:
    Time  |  Actor (name + email mono)   |  Op       |  Target type   |  Target id (mono)  |
    ----  |  ----                        |  ----     |  ----          |  ----              |
    rows newest-first; whole row clickable -> /admin/audit/[id]
]
[ "Show more" button when nextCursor present ]
[ EmptyState when zero rows match the filters ]
```

Default ordering: `(timestamp desc, id desc)`. The id tiebreaker is essential -- two rows can share a millisecond timestamp, and cursor-based pagination needs a deterministic order.

### Detail (`/admin/audit/[id]`)

```text
[ Breadcrumbs: Admin > Audit > <id-prefix> ]
[ Header:
    op-badge   Target type / target id   Timestamp (UTC + local)
    Audit row id (mono, copyable)
]
[ Actor card:
    Avatar(?)   Name (or "system")
                email
                Role pill
                "View user" -> /users/[id]
                "View all from this actor" -> /admin/audit?actor=<id>&window=all
]
[ Two columns side-by-side:
    Before (jsonb pretty)         After (jsonb pretty)
    [Copy]                        [Copy]
    (empty pane gets explicit "no before -- this is a create" copy)
]
[ Metadata pane (jsonb pretty, full-width below) ]
[ Footer link: "View all on this target" -> /admin/audit?targetType=<t>&targetId=<id>&window=all ]
```

The detail page reads exactly one row + one actor join. No additional queries.

## Filter semantics

### Time window

| Preset    | Semantics                                                              |
| --------- | ---------------------------------------------------------------------- |
| `1h`      | `timestamp >= now() - interval '1 hour'`                                |
| `24h`     | `timestamp >= now() - interval '24 hours'` (default)                   |
| `7d`      | `timestamp >= now() - interval '7 days'`                                |
| `30d`     | `timestamp >= now() - interval '30 days'`                               |
| `all`     | No time bound                                                          |
| `custom`  | Use `from` (inclusive) and `to` (inclusive) ISO datetimes               |

Resolution rule:

1. If `from` or `to` are present, treat as `custom` regardless of `window`.
2. Else if `window` is set, use that preset.
3. Else default `24h`.

### Actor filter

`?actor=<userId>` filters by exact `actor_id` match. The free-text actor search (`actorSearch` in load data, debounced from the input) hits a small JSON endpoint that returns up to 20 user matches; selecting one populates `?actor=<userId>`. The text in the search box is a UI affordance only -- the URL carries the resolved id.

For "system writes only" filtering: `?actor=null` is reserved (the literal string `null`); the BC translates it to `actor_id IS NULL`. A small "system only" toggle next to the actor search exposes this.

### Target filter

`?targetType` matches `target_type` exactly. `?targetId` matches `target_id` exactly. They compose: `targetType=hangar.source` alone returns every source-touching row; adding `targetId=src_01H...` narrows to one source's history.

### Op filter

`?op=create | update | delete | action`. Exact match.

### Pagination cursor

Encoded as `${timestampISO}::${id}`. Decoded into `(timestamp, id)` tuple, used in a `(timestamp, id) < (cursorTs, cursorId)` keyset compare. Hard limit 200 rows per response; default page size 50.

URL example with all filters set:

```text
/admin/audit
  ?actor=usr_01H...
  &targetType=hangar.source
  &op=update
  &window=7d
  &cursor=2026-04-30T12%3A34%3A56.789Z%3A%3Aaud_01H...
```

## Query patterns

### `listAuditEntries`

```sql
-- Composed via Drizzle; shown as SQL for clarity. No raw SQL in the codebase.

select
  al.id, al.timestamp, al.actor_id, al.op, al.target_type, al.target_id, al.metadata,
  bu.name  as actor_name,
  bu.email as actor_email
from audit.audit_log al
left join bauth_user bu on bu.id = al.actor_id
where
  (:actor_id is null or al.actor_id = :actor_id or (:actor_id_is_null and al.actor_id is null))
  and (:target_type is null or al.target_type = :target_type)
  and (:target_id   is null or al.target_id   = :target_id)
  and (:op          is null or al.op          = :op)
  and (:from        is null or al.timestamp  >= :from)
  and (:to          is null or al.timestamp  <= :to)
  and (:cursor_ts   is null or (al.timestamp, al.id) < (:cursor_ts, :cursor_id))
order by al.timestamp desc, al.id desc
limit :limit + 1;  -- fetch one extra to detect nextCursor
```

The `+1 limit` lets the BC return `nextCursor` when more rows exist, without a count query.

Index usage:

- Actor + window: `audit_log_actor_idx (actor_id, timestamp)` -- direct hit.
- Target + window: `audit_log_target_idx (target_type, target_id, timestamp)` -- direct hit.
- Unfiltered window (default 24h, all actors / targets): seq scan + sort by timestamp. Acceptable while row count stays modest. Captured as a deferred risk in spec.md.

### `getAuditEntry`

```sql
select
  al.id, al.timestamp, al.actor_id, al.op, al.target_type, al.target_id,
  al.before, al.after, al.metadata,
  bu.name  as actor_name,
  bu.email as actor_email,
  bu.role  as actor_role
from audit.audit_log al
left join bauth_user bu on bu.id = al.actor_id
where al.id = :id
limit 1;
```

One round-trip. Returns `null` when missing (the route emits 404).

### `searchActorIds`

```sql
select id, name, email
from bauth_user
where name ilike :pattern or email ilike :pattern
order by name asc, email asc
limit 20;
```

Hard-capped at 20 to keep the typeahead responsive. Same `escapeLikePattern` helper as `/users`.

## Filter bar UX

```text
[ Actor: __________ (typeahead)         ]   [ "system writes only" toggle ]
[ Target type: <select>                 ]   [ Target id: __________      ]
[ Op: <select>                          ]
[ Window: [1h] [24h*] [7d] [30d] [all] [custom] ]
( when custom: [From: __________] [To: __________] )
[ Clear filters ]
```

- All inputs feed `replaceState` (debounced 150ms for text, immediate for selects + chips). No reload on each keystroke; SvelteKit handles the navigation.
- The "1h / 24h / ... / custom" group is a chip / segmented control. The active chip mirrors the URL's `window=` value.
- "Clear filters" returns the URL to `/admin/audit` (default 24h applies implicitly).

## Empty + cap states

| State                     | Trigger                                                              | Copy                                                               |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Empty -- no filters       | Audit log is empty (cold dev DB)                                      | "No audit events yet. Mutations will appear here."                 |
| Empty -- with filters     | Filter combo returns zero rows                                        | "No events match these filters. Try widening the time window."      |
| Cap reached               | First page returned the hard cap                                      | "Showing first 200 events. Refine the filters to narrow."          |
| Detail 404                | `/admin/audit/<id>` for a missing id                                  | Standard 404 page                                                   |

## Boundary against sibling surfaces

| Concern                                       | Owned by                                                    | Why                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/admin/audit*`                               | this WP                                                     | The cross-cutting audit explorer.                                                                  |
| `/admin/audit-ping`                           | [hangar-scaffold](../hangar-scaffold/spec.md)                | Heartbeat diagnostic; stays until a separate cleanup WP retires it.                                |
| `/users` + `/users/[id]` audit list           | [extract-hangar-bc](../extract-hangar-bc/spec.md) and PR #226 | Per-user actor-scoped audit (last 20). This WP supersedes that view's depth but not its placement. |
| `auditWrite` calls inside BCs                 | each BC                                                     | Writers stay where they are. This WP is read-only.                                                 |
| `/jobs` job log                               | [hangar-registry](../hangar-registry/spec.md)                | Job lifecycle is a separate stream from audit; jobs surface to `/jobs` not `/admin/audit`.         |
| Cited-by panel mounting on audit detail       | n/a                                                         | Audit rows aren't citations -- no cited-by panel here.                                              |

## Design principles applied

| Principle                                  | Application                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Debrief Culture                            | Audit visibility is a debrief substrate. Every mutation is inspectable; nothing about the system is secret. |
| Read-before-write                          | This WP is the read surface that makes future admin-write surfaces (role change, ban, revoke) trustworthy. |
| Surface-typed apps (Option 7)              | Hangar owns admin surfaces. Audit explorer is hangar's, not study's.                                     |
| Discovery-first vs assertion-first         | Not applicable to admin tooling; admin surfaces are functional, not pedagogical.                         |

## Performance

- `listAuditEntries` typical query: actor or target filter present -> direct index hit, sub-50ms.
- Unfiltered default-window query: seq scan + sort over rows in the last 24h. Modest while row count stays low; if v1 grows past hundreds of thousands of total rows, add `audit_log(timestamp desc)` index. Captured as a deferred risk.
- Detail page: one indexed PK lookup + one actor join. Sub-10ms.
- Actor typeahead: `ilike` over `bauth_user.name + email`, capped at 20. Same shape as `/users` search; acceptable for the current user count.
- jsonb panes pretty-print client-side. No server-side formatting cost.

## Risks

| Risk                                                                                              | Mitigation                                                                                          |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Unfiltered scans get slow as `audit_log` grows                                                     | Deferred index on `timestamp desc`; spec lists this with an explicit trigger (latency >200ms).     |
| jsonb payloads contain sensitive data (e.g. raw user input)                                       | ADMIN-only gate is the floor; redaction at write-time is per-BC concern, out of scope for this WP. |
| Cursor URLs become stale if rows are deleted (audit is append-only by ADR 004 so this is theoretical) | Cursor decode tolerates a missing row; "Show more" still works because the keyset compare doesn't require the cursor row to exist. |
| `before` / `after` jsonb panes are illegible for deeply nested updates                             | v1 ships side-by-side; v2 adds a real diff view if user feedback says it's needed (in spec deferred list). |
| ADMIN-only gate drift if layout-level gate widens                                                  | Belt-and-suspenders: page-server gate AND layout gate; e2e asserts the lower-role redirect.        |

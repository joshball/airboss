# Tracking system

Frontmatter-driven system for managing work, bugs, and shipped PRs. Files on disk are the source of truth. Aggregator views are generated. The hangar reads the same data the CLI reads.

This doc is the long-form explainer. The CLI's `bun run track help` is the quick reference; if you want the short version, run that.

## Mental model

Three kinds of things flow through the system.

### Work packages

Features, projects, anything you commit to building. Each lives in its own directory:

```text
docs/work-packages/<id>/
  spec.md           # required, carries frontmatter
  tasks.md          # optional - phased build plan
  test-plan.md      # optional - manual smoke-test scenarios
  design.md         # optional - medium+ features
  user-stories.md   # optional - large features
```

A WP travels through statuses: `draft -> signed-off -> in-flight -> shipped`. Side branches: `abandoned` (intentionally dropped), `superseded` (replaced by a different WP).

### Bugs

Known broken things, lighter-weight than WPs. One markdown file per bug at `docs/bugs/<id>.md`. Promoted to a WP only when the fix needs design.

### Log entries

One per merged PR at `docs/log/YYYY-MM-DD-PR-NNN-*.md`. The shipping record. Drives `docs/work/SHIPPED.md` so NOW.md doesn't become a god-doc of "just shipped" prose.

## The frontmatter contract

The system's load-bearing piece is [ADR 025](../decisions/025-wp-frontmatter-contract/decision.md) - the WP frontmatter contract. Every WP carries this YAML block at the top of its `spec.md`:

```yaml
---
id: my-feature                              # matches dir name (kebab-case)
title: Human-readable title
product: study | hangar | sim | flightbag | avionics | platform | course | none
category: product | feature | content | docs | platform   # exactly one
status: draft | signed-off | in-flight | shipped | abandoned | superseded
agent_review_status: pending | done         # agent flips after self-review
human_review_status: pending | walked | signed-off   # YOU ONLY (lint enforces)
created: 2026-05-08
shipped_date: 2026-05-08                    # required when status: shipped
shipped_prs: [671, 697]                     # PRs that closed the WP
depends_on: [other-wp-id]
unblocks: [downstream-wp-id]
owner: agent | user
tags: [free, form]
---
```

The vocab is closed; lint rejects anything off-list.

### The two review-status fields

`agent_review_status` is agent-controlled. Agents flip it to `done` after a self-review pass (lint clean, tests green, etc.).

`human_review_status` is **user-only**. Lint compares `git config user.email` against the registered user email and rejects any agent commit that touches this field. Three states:

- `pending` - default, you haven't walked the test plan
- `walked` - you walked it but found issues
- `signed-off` - you walked it and you're satisfied

This is the load-bearing fix for "agents flip review_status on their own work and call it done." They can't anymore.

### The shipped-transition rule

`status: shipped` requires `human_review_status: signed-off`. Lint enforces it. The CLI pre-flights it. So a WP cannot reach "shipped" without you actually walking the test plan and signing off.

Because of this rule, "shipped in code" and "WP closed" are different states. A PR can ship code that's `status: in-flight` until you walk it.

## The CLI surface

Three top-level commands. Daily-use entry points.

### `bun run track`

The umbrella. Workflow-shaped. Use this most of the time.

| Subcommand                 | What it does                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `track` (no args)          | Same as `track help`                                                                                    |
| `track help`               | Comprehensive help (commands + workflows)                                                               |
| `track status`             | Dashboard: WP counts by state, open bugs, recent PRs, hints                                             |
| `track next`               | Lists WPs ready to walk (signed-off + deps shipped + human-review pending), with reasoning              |
| `track ship`               | Interactive flow: pick from `next` list, walk, sign-off, ship, regenerate, format. Composes everything. |
| `track ship <wp-id>`       | Same as above but skips the picker                                                                      |
| `track ship <wp-id> --yes` | Skip the confirmation prompt entirely                                                                   |
| `track generate`           | Re-emit BOARD.md, SHIPPED.md, per-product ROADMAP.md                                                    |
| `track format [paths]`     | Markdown formatter (table align, blank lines, fence tags). Default = dirty files.                       |
| `track archive`            | Rolling archive preview (60-day default, dry-run)                                                       |
| `track archive --apply`    | Execute the archive                                                                                     |
| `track log <pr-number>`    | Emit one log entry from `gh pr view <pr>`                                                               |

### `bun run wp`

Power-user CLI for work packages. Use directly when you want fine-grained control over filtering or mutation.

| Subcommand                         | What it does                                                               |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `wp list [filters]`                | Table of WPs. Filters compose with AND. Output: table / `--json` / `--md`. |
| `wp show <wp-id>`                  | Render the full WP (spec + tasks + test-plan)                              |
| `wp show <wp-id> --section <name>` | Render only one sub-doc (`spec`, `tasks`, `test-plan`)                     |
| `wp next`                          | Plain-table version of `track next`                                        |
| `wp blocked`                       | WPs whose `depends_on` includes a non-shipped WP                           |
| `wp set <id> <field> <value>`      | Mutate one whitelisted field                                               |

`wp list` filters: `--product`, `--category`, `--status`, `--human-review`, `--agent-review`, `--tag`. Negation: `--status '!shipped'`.

`wp set` whitelist: `status`, `agent_review_status`, `human_review_status`, `category`, `product`, `owner`, `shipped_date`, `shipped_prs`, `depends_on`, `unblocks`, `tags`. Aliases: `human-review`, `agent-review`, `shipped-date`, `shipped-prs`, `depends-on`.

### `bun run bug`

Power-user CLI for bugs. Same shape as `wp`, lighter schema.

| Subcommand                     | What it does                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `bug list [filters]`           | Table of bugs. Filters: `--product`, `--severity`, `--status`, `--tag`       |
| `bug show <bug-id>`            | Render one bug                                                               |
| `bug new <slug>`               | Scaffold `docs/bugs/<slug>.md` (flags: `--title`, `--product`, `--severity`) |
| `bug set <id> <field> <value>` | Mutate. Whitelist: `status`, `severity`, `fix_pr`, `fix_wp`, `tags`          |
| `bug index`                    | Regenerate `docs/bugs/INDEX.md`                                              |

Bug schema:

```yaml
---
id: bug-some-slug
title: Human-readable title
product: study | hangar | sim | flightbag | avionics | platform | course | none
severity: blocking | major | minor | nit
status: open | wontfix | duplicate | fixed
discovered_pr: 712      # optional
discovered_date: 2026-05-08
fix_pr: null            # set when fixed
fix_wp: null            # set if promoted to a WP
tags: [free, form]
---
```

## Common workflows

### "What should I work on?"

```bash
bun run track status      # dashboard
bun run track next        # walk-ready candidates with reasoning
```

If `next` is empty: nothing's ready. Try one of:

```bash
bun run wp list --status draft         # WPs that need spec signoff
bun run wp blocked                     # WPs waiting on deps
bun run wp list --status in-flight     # WPs you started walking but didn't finish
```

### "I walked a test plan and everything works"

```bash
bun run track ship                     # interactive picker
# or:
bun run track ship some-wp-id          # explicit
```

The flow:

1. Loads the WP, prints metadata
2. Tells you where the test plan lives
3. Prompts for confirmation (skip with `-y`)
4. Sets `human_review_status: signed-off`
5. Sets `status: shipped` (auto-fills `shipped_date`)
6. Regenerates BOARD / ROADMAPs / SHIPPED
7. Formats any newly-changed markdown
8. Tells you exactly which files to stage and commit

### "I walked it but the test plan needs revision"

Don't ship. Mark the partial walk:

```bash
bun run wp set some-wp-id human-review walked
# fix things
# walk again, then:
bun run track ship some-wp-id          # now signs off and ships
```

### "I found a bug but don't have scope to fix it now"

```bash
bun run bug new bug-some-thing
# edit docs/bugs/bug-some-thing.md to add repro + severity
```

When the fix lands later (in a PR):

```bash
bun run bug set bug-some-thing status fixed
bun run bug set bug-some-thing fix_pr 712
bun run bug index                       # refresh the index
```

If the fix needs design (multi-PR, schema change, etc.), promote to a WP instead:

```bash
bun run bug set bug-some-thing fix_wp some-new-wp-id
# create the WP under docs/work-packages/some-new-wp-id/
```

### "Show me all references work that isn't shipped"

```bash
bun run wp list --tag references --status '!shipped' --md
```

`category: content` will catch most reference work too — they overlap. Tags are free-form so you can slice however you want.

### "I just merged a PR"

```bash
bun run track log 712              # emits docs/log/2026-05-08-PR-712-...md
git add docs/log/                  # stage and commit (later, in your next PR)
```

The log entry's frontmatter is auto-filled from `gh pr view`. If the PR body mentions a WP id (`some-wp-id`) or bug id (`bug-some-thing`), those cross-references populate too.

### "Periodic housekeeping" (monthly-ish)

```bash
bun run track archive            # preview what would move
bun run track archive --apply    # execute
bun run track generate           # rebuild views (in case anything drifted)
bun run check                    # confirm clean
```

The archive moves files in `docs/work/{handoffs,walkthroughs,reviews,build-reports}/` older than 60 days into `docs/.archive/<dir>/<year>/`. Skips `_template.md`, `INDEX.md`, `README.md`. Uses `git mv` so blame survives.

## What's enforced and where

The contracts wouldn't hold without enforcement. Here's where each rule lives:

| Rule                                                         | Enforced by                                           |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| WP frontmatter validates against schema                      | `scripts/lint/wp-frontmatter.ts` (in `bun run check`) |
| Agents cannot mutate `human_review_status`                   | Lint diff check vs `git config user.email`            |
| `status: shipped` requires `human_review_status: signed-off` | Zod `superRefine` in schema + CLI pre-flight          |
| `status: shipped` requires `shipped_date`                    | Zod `superRefine`                                     |
| Generated files match WP frontmatter                         | `tracking-generate` step in `bun run check`           |
| Markdown is formatted                                        | `md-format` step in `bun run check`                   |
| Bug frontmatter validates                                    | `bug-frontmatter` step in `bun run check`             |

If `bun run check` is green, the system is consistent. If it's red, something has drifted.

## What lives where

```text
docs/
  work-packages/<id>/      Each work package: spec.md + optional sub-docs
  bugs/<id>.md             Each bug: frontmatter + body
    INDEX.md               Generated bug index
  log/<date>-PR-<n>-*.md   Per-PR log entries
  work/
    NOW.md                 Curated "what I'm focused on"
    BOARD.md               Generated WP board
    SHIPPED.md             Generated PR log
    todos/                 Per-session todos
    handoffs/              Session-end handoffs (auto-archive 60d)
    walkthroughs/          Manual smoke-test walkthroughs (auto-archive 60d)
    reviews/               Code/design review reports (auto-archive 60d)
    build-reports/         Build artifacts (auto-archive 60d)
  products/<app>/
    ROADMAP.md             Generated per-product roadmap
  decisions/
    025-wp-frontmatter-contract/   ADR for the system
  platform/
    TRACKING.md            This doc
  .archive/                Where archived files go (preserves dir structure)

libs/
  constants/src/{work-package,bug}.ts    Closed vocabularies
  types/src/{work-package,bug}.ts        Zod schemas

scripts/
  track.ts                 The umbrella dispatcher
  wp.ts                    Work-package CLI
  bug.ts                   Bug CLI
  log-pr.ts                Emits log entries from gh pr view
  lib/
    wp-loader.ts           Reads work-packages + frontmatter
    bug-loader.ts          Reads bugs + frontmatter
    log-loader.ts          Reads log entries + frontmatter
  lint/
    wp-frontmatter.ts      Schema + ownership lint
    bugs.ts                Bug frontmatter lint
  tracking/
    generate.ts            Emits BOARD/SHIPPED/ROADMAPs
    archive.ts             Rolling archive

apps/hangar/src/routes/(app)/roadmap/
  +page.svelte             /roadmap index, faceted filters
  [wp_id]/+page.svelte     WP detail page
  [wp_id]/raw/+server.ts   JSON dump for debugging
```

## In-app surface

The hangar at `/roadmap` reads the same data the CLI reads. Server-loads frontmatter on each request via `wp-loader.ts`.

- `/roadmap` — index, faceted filters (product, category, status, human_review, tag), URL-shareable
- `/roadmap/[wp-id]` — detail with tabs over Spec / Tasks / Test plan / Design / User stories. Dependency sidebar. Shipped-PR links to GitHub.
- `/roadmap/[wp-id]/raw` — JSON dump for debugging

Read-only today. Mutations are CLI-only (`bun run wp set`).

## What's NOT in this system

These have their own homes; don't conflate them with WPs / bugs / logs.

| Thing                  | Lives at                               | Why separate                                   |
| ---------------------- | -------------------------------------- | ---------------------------------------------- |
| Session todos          | `docs/work/todos/YYYYMMDD-NN-TODO.md`  | Per-session, disposable, not tracked long-term |
| Ideas (unevaluated)    | `docs/platform/IDEAS.md`               | Funnel for things that haven't earned a WP     |
| ADRs (architecture)    | `docs/decisions/`                      | Immutable once approved                        |
| Product visions / PRDs | `docs/products/<app>/`, `docs/vision/` | Long-lived strategy, not active work           |

## Design rationale

Why this shape?

### Why frontmatter, not a database?

WPs and bugs ARE the spec. Putting them in a database means two sources of truth (database + git history). Putting them in markdown means git is the database, history is free, and you can edit them without an admin UI. The hangar `/roadmap` view reads frontmatter at request time; no sync issues.

### Why generated views?

The previous NOW.md was 319 lines mixing "just shipped" history, in-flight work, follow-ons, build order, deferred items, and a links section. It rotted within a week of any author leaving it alone. Generated views derive from frontmatter; they cannot drift from truth without `bun run check` failing.

### Why a separate `track` command instead of putting everything under `wp`?

`wp` is the noun-shaped CLI. It's high-frequency and stays focused on WP operations. `track` is the workflow-shaped umbrella for cross-cutting actions: status (reads everything), ship (composes wp set + generate + format), archive (operates on docs/work/), log (operates on docs/log/). They serve different mental models.

### Why is `track ship` a composite, not a sequence of CLI calls?

Closing a WP correctly takes 4 separate operations: set human-review, set status, regenerate views, format markdown. People forget steps. The composite makes the right thing the easy thing. The underlying primitives (`bun run wp set`, etc.) are still available for power users.

### Why does `human_review_status` need to be lint-enforced?

Without enforcement, agents flipped their own work to `review_status: done` because the prompt said to. The user had never actually walked any test plan. The lint rule (compare `git config user.email` to the registered user) makes the contract physical instead of aspirational.

## See also

- [ADR 025: WP frontmatter contract](../decisions/025-wp-frontmatter-contract/decision.md)
- [The work package itself](../work-packages/tracking-system-overhaul/spec.md)
- `bun run track help` - the quick reference
- `bun run wp help` - WP CLI reference
- `bun run bug help` - bug CLI reference

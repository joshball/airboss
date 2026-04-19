# Local Development Environment

How to run the full FIRC Boss stack locally in a way that mirrors production.

## Architecture

```text
Browser -> Caddy (TLS termination) -> SvelteKit dev servers (Vite)
                                   -> PostgreSQL (OrbStack)
```

Caddy reverse-proxies subdomain requests to the correct app port. This is the same topology as production -- Caddy (or equivalent) in front, app processes behind it.

## Domains

All apps use `*.firc.test` subdomains. DNS resolves `*.firc.test` to `127.0.0.1`.

| App    | Domain             | Port |
| ------ | ------------------ | ---- |
| sim    | `sim.firc.test`    | 7600 |
| hangar | `hangar.firc.test` | 7610 |
| ops    | `ops.firc.test`    | 7620 |
| runway | `runway.firc.test` | 7640 |

Production equivalents: `sim.fircboss.com`, `hangar.fircboss.com`, `ops.fircboss.com`, `fircboss.com` (apex).

## Reverse Proxy Setup

Two options. Use ldrp if you have it, standalone Caddy if you don't.

### Option A: ldrp (preferred)

ldrp manages Caddy, dnsmasq, `/etc/hosts`, and TLS as a single tool. Source: `~/.chezball/tools/ldrp/`.

**First-time setup:**

```sh
ldrp init                  # sets up dnsmasq, resolver, Caddy
caddy trust                # trust Caddy's local CA (browser TLS)
```

**Register FIRC apps** (from project root):

```sh
ldrp add sim.firc.test 7600 --group firc --path apps/sim
ldrp add hangar.firc.test 7610 --group firc --path apps/hangar
ldrp add ops.firc.test 7620 --group firc --path apps/ops
ldrp add runway.firc.test 7640 --group firc --path apps/runway
```

Or run `ldrp add` with no args in the project root -- it auto-detects monorepo apps.

Caddy runs as a background daemon; ldrp starts/reloads it when apps are added or removed.

**Key files:**

| File                       | Purpose                           |
| -------------------------- | --------------------------------- |
| `~/.config/ldrp/Caddyfile` | ldrp-managed reverse proxy config |
| `~/.config/ldrp/apps.json` | ldrp app registry                 |

**Useful commands:**

```sh
ldrp status                # show registered apps
ldrp doctor                # check infrastructure health
ldrp edit caddy            # open managed Caddyfile in $EDITOR
```

### Option B: Standalone Caddy

For machines without ldrp. You handle DNS and Caddy yourself.

**Prerequisites:**

1. `brew install caddy`
2. DNS resolving `*.firc.test` to `127.0.0.1` (dnsmasq, `/etc/hosts`, etc.)
3. One-time: `caddy trust` to install Caddy's local CA

**Run Caddy with the bundled Caddyfile:**

```sh
caddy run --config docs/devops/Caddyfile       # foreground
caddy start --config docs/devops/Caddyfile     # background
caddy stop                                      # stop background
caddy reload --config docs/devops/Caddyfile    # reload after edits
```

The Caddyfile at `docs/devops/Caddyfile` is a standalone config that maps all 4 local domains to their ports. Caddy uses its built-in local CA for TLS -- no mkcert needed.

**DNS without ldrp (manual):**

You need dnsmasq or equivalent resolving `*.firc.test` to `127.0.0.1`. Alternatively, add them to `/etc/hosts`:

```text
127.0.0.1  sim.firc.test hangar.firc.test ops.firc.test runway.firc.test
```

## Dev Server Commands

All commands operate on all four apps at once.

```sh
bun run dev              # Show help
bun run dev start        # Start all (foreground, logs to terminal, Ctrl+C stops all)
bun run dev start --bg   # Start all (background, logs to .tmp/logs/<app>.log)
bun run dev stop         # Graceful shutdown (SIGTERM)
bun run dev restart      # Stop + start (foreground)
bun run dev restart --bg # Stop + start (background)
bun run dev kill         # Force-kill (SIGKILL)
bun run dev status       # Show running/stopped, PIDs, URLs
```

### Foreground vs Background

**Foreground** (`start`) -- all Vite output streams to your terminal. Ctrl+C sends SIGTERM to all apps. Best for active development where you want to see logs in real time.

**Background** (`start --bg`) -- each app's stdout/stderr goes to `.tmp/logs/<app>.log`. The command exits immediately. Tail logs with:

```sh
tail -f .tmp/logs/*.log
```

### Process Tracking

PID files are stored in `.tmp/pids/<app>.pid`. Stale PIDs (from crashed processes) are cleaned up automatically on every `dev` command. The `status` command always reflects actual process state, not just what the PID file says.

## Cookie Domain and Cross-App Auth

The session cookie is scoped to `.firc.test` via better-auth's `crossSubDomainCookies`. A cookie set on `.firc.test` is sent to `sim.firc.test`, `hangar.firc.test`, etc. -- that's how cross-app session sharing works. Production uses the same pattern on `.fircboss.com`.

Config: `libs/constants/src/hosts.ts` defines `COOKIE_DOMAIN_DEV` (`.firc.test`) and `COOKIE_DOMAIN_PROD` (`.fircboss.com`). better-auth uses these via `advanced.crossSubDomainCookies` in `libs/auth/src/server.ts`. The shared `forwardAuthCookies` in `libs/auth/src/cookies.ts` also sets the domain when forwarding Set-Cookie headers.

## Allowed Hosts

Vite blocks requests from unrecognized hostnames by default. Each app's `vite.config.ts` allows its `.firc.test` domain. Host values come from `libs/constants/src/hosts.ts`.

## How Caddy and SvelteKit Route Groups Interact

Short answer: they don't. Caddy is a dumb pipe -- it routes by subdomain to the correct app port. All request handling happens inside SvelteKit.

```text
Caddy                             SvelteKit (inside each app)
─────                             ──────────────────────────
sim.firc.test/* -----> :7600 ->   Root layout (+layout.server.ts)
hangar.firc.test/* --> :7610 ->     ├── route in /(public)?  -> skip auth
ops.firc.test/* ----> :7620 ->     │     (login, register)
runway.firc.test/* -> :7640 ->     └── route in /(app)?     -> require auth + role
                                        (everything else)
```

Each app has two SvelteKit route groups:

- **`(public)/`** -- login, register. No auth required. Root layout detects `route.id?.startsWith('/(public)')` and skips the session check.
- **`(app)/`** -- everything else. Root layout redirects to `/login` if no session. The `(app)` group layout adds the app shell (header, nav, sidebar) and enforces role checks (e.g., hangar requires AUTHOR/OPERATOR/ADMIN per ADR-009).

These parenthesized directories are SvelteKit "route groups" -- they affect layout nesting but don't appear in the URL. `/login` lives at `(public)/login/+page.svelte`, `/course` lives at `(app)/course/+page.svelte`. The URL has no `(public)` or `(app)` segment.

Caddy never sees this. It proxies `hangar.firc.test/login` and `hangar.firc.test/scenarios` to the same port. SvelteKit decides which layout chain to use based on the file system path.

## Files

| File                          | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `scripts/dev.ts`              | Dev server lifecycle (start/stop/restart/kill/status) |
| `docs/devops/Caddyfile`       | Standalone reverse proxy config (option B)            |
| `libs/constants/src/hosts.ts` | Canonical host definitions                            |
| `libs/constants/src/ports.ts` | Port assignments                                      |
| `.tmp/pids/`                  | PID files (gitignored)                                |
| `.tmp/logs/`                  | Background log files (gitignored)                     |
| `docker-compose.yml`          | PostgreSQL + Mailpit                                  |

## See Also

- [ADR 007: Auth Topology](../decisions/007-AUTH_TOPOLOGY.md) -- subdomain routing, cookie scope, session sharing
- [Deployment Options](DEPLOYMENT_OPTIONS.md) -- production platform evaluation

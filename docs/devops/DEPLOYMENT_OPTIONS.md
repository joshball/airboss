# Deployment Options

Research as of 2026-03-25. Prices are approximate minimums for our setup (4 SvelteKit apps + PostgreSQL).

## Platform Comparison

| Platform              | Min cost   | DB                        | Deploy model     | Best for                                      |
| --------------------- | ---------- | ------------------------- | ---------------- | --------------------------------------------- |
| **Railway**           | ~$10-20/mo | Managed Postgres included | Git push         | Simplest. Get to market fast.                 |
| **Fly.io**            | ~$15-25/mo | Managed Postgres          | Push deploy      | Multi-region. Multiple processes per machine. |
| **Hetzner + Coolify** | ~$8-12/mo  | Self-managed Postgres     | Self-hosted PaaS | Cheapest with full control.                   |
| **Render**            | ~$28-50/mo | Managed Postgres ($7+/mo) | Git push         | Simple but expensive for multiple services.   |
| **Vercel**            | $0-20/mo   | Vercel Postgres (Neon)    | Zero-config      | Best DX but serverless model hurts us.        |
| **Netlify**           | $0-19/mo   | BYO (no managed DB)       | Git deploy       | Static-first. Weak for our use case.          |
| **Cloudflare**        | ~$5/mo     | D1 (SQLite) or external   | Workers + Pages  | Edge-first. Runtime limitations.              |
| **Hetzner bare**      | ~$4-8/mo   | Self-managed              | Full DIY         | Cheapest. Most ops work.                      |

## Detailed Breakdown

### Railway

- $5/mo Hobby or $20/mo Pro, includes that much in resource usage
- Overage billed on top of subscription
- Managed Postgres included in usage allowance
- Git push deploy, very simple
- Good for early stage

### Fly.io

- Pay-as-you-go (no subscription tiers since Oct 2024)
- Shared-CPU 256MB VM: ~$1.94/mo each
- Dedicated IPv4: $2/mo per app
- Realistic single app: ~$10-20/mo
- 4 apps: ~$15-25/mo depending on sizing
- Can run multiple processes on one machine to save cost
- Managed Postgres available
- Good for multi-region when needed

### Hetzner + Coolify

- Hetzner CX23 VPS: ~$4-8/mo (price increase ~30% April 2026)
- Coolify: free (self-hosted, open source)
- One VPS runs all apps + Postgres
- Heroku-like deploy UI via Coolify
- Full control, cheapest option
- More setup upfront

### Render

- $7/mo minimum per web service
- 4 services = $28/mo base before DB
- Managed Postgres: $7+/mo additional
- Git push deploy
- Gets expensive fast with multiple services

### Vercel

- Hobby: free. Pro: $20/user/mo
- Zero-config SvelteKit deploy (best DX)
- Vercel Postgres (Neon): serverless connection model
- Problems: cold starts, connection limits, unpredictable cost at scale
- $20/user/mo for teams -- scales expensive
- Serverless model wrong for interactive 16-hour course

### Netlify

- Free tier: 100 build minutes (reduced from 300)
- Pro: $19/mo
- SSR runs as serverless functions
- No managed Postgres -- bring your own
- SvelteKit via adapter-netlify
- Weaker SSR/server support than alternatives

### Cloudflare

- Workers paid: $5/mo base + $0.50/million requests
- Pages static assets: free and unlimited
- No native Postgres -- need D1 (SQLite) or external DB via Hyperdrive
- Edge runtime: limited Node.js API access
- SvelteKit adapter exists but edge constraints apply

## Recommendation

**Serverless platforms** (Vercel, Netlify, Cloudflare) are poor fits because:

- Postgres connection pooling is painful (cold starts, limits)
- We need long-running processes (tick engine, background jobs)
- Cost scales per-request, unpredictable for a 16-hour interactive course
- Edge runtime restrictions limit Node.js API access

**Traditional server platforms** (Railway, Fly.io, Render, Hetzner) are better because:

- Persistent Postgres connections, no cold starts
- Long-running processes supported
- Predictable costs based on provisioned resources

**Plan:** Start with Railway (simplest, ~$10-20/mo). Move to Hetzner + Coolify when we want more control. Scale to Fly.io if we need multi-region.

## Decision Status

Deferred. Does not affect code architecture. Lib boundaries support any deployment model.

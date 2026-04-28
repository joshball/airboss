# apps/avionics

Glass-cockpit trainer surface. Lives at `https://avionics.airboss.test`
in dev (port 9630). Mirrors the study/sim/hangar shape: SvelteKit +
Svelte 5 runes, shared `@ab/themes` token system, cross-subdomain
auth via `bauth_session_token`, no per-app login UI.

This phase ships the empty app shell only. The PFD components, the
home card grid, the scan trainer, the MFD, and the aircraft selector
land in the subsequent phases of the
[avionics-app-scaffold](../../docs/products/avionics/work-packages/avionics-app-scaffold/)
work package.

## What's here today

- Auth read (cross-subdomain `bauth_session_token`)
- Theme picker (full light/dark, no surface lock -- avionics
  participates in the global theme system)
- Aircraft-selection cookie hydration (`avionics_selected_aircraft`,
  per-app domain). Default `c172`.
- `/` placeholder page so the dev server boots

## Out-of-repo developer action (one-time)

Add to `/etc/hosts`:

```text
127.0.0.1 avionics.airboss.test
```

Then `bun run dev avionics` and visit `https://avionics.airboss.test`.

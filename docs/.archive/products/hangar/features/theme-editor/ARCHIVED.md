# Archived: hangar theme-editor feature (2026-04-25)

This feature package described a hangar-specific theme editor: a UI for editing theme tokens, previewing variants, and exporting to the codebase.

## Why this was archived

Theme picking is now route-driven via the shared picker (PR #190) plus a registry, and the underlying token system was rewritten end-to-end in the eight-package [Theme System Overhaul](../../../../../work-packages/theme-system-overhaul/README.md). A separate "theme editor" feature in hangar is dead: there is no editor UI to build, and no live code in `apps/hangar/src/` references this feature.

The spec referenced abandoned vocabulary (`--t-*` prefixed tokens, `data-theme-id`, the `aviation` / `glass-cockpit` / `workbench` / `focus` / `brand` family split) that no longer exists.

## Where to look instead

- Shared theme picker spec: [docs/work-packages/theme-system-overhaul/09-theme-picker/spec.md](../../../../../work-packages/theme-system-overhaul/09-theme-picker/spec.md)
- Theme picker shared lib: [docs/work-packages/theme-system-overhaul/10-theme-picker-shared-lib/spec.md](../../../../../work-packages/theme-system-overhaul/10-theme-picker-shared-lib/spec.md)
- Picker implementation: `libs/themes/picker/`
- Token vocabulary (current): [docs/platform/theme-system/04-VOCABULARY.md](../../../../../platform/theme-system/04-VOCABULARY.md)
- Quick reference: [docs/platform/theme-system/QUICK_REFERENCE.md](../../../../../platform/theme-system/QUICK_REFERENCE.md)

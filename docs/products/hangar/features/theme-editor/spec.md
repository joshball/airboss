---
title: Theme Editor Spec
product: hangar
feature: theme-editor
type: spec
status: done
---

# Theme Editor Spec

## Overview

Add an appearance editor to Hangar settings so authors can switch themes, choose light or dark mode, and adjust a single interface scale that changes typography and spacing together across the active theme.

## Data

| Field       | Type            | Notes                                                                                  |
| ----------- | --------------- | -------------------------------------------------------------------------------------- |
| `themeId`   | string          | Current theme choice (`glass-cockpit`, `aviation`)                                     |
| `themeMode` | `light \| dark` | Active theme mode                                                                      |
| `scale`     | number or null  | User override as a multiplier over the theme default. `null` means "use theme default" |

Persistence is local to the browser via `localStorage`.

## Behavior

- Theme settings live in Hangar's existing Settings page under an Appearance panel.
- Theme choice updates `data-theme-id` on `<html>`.
- Mode choice updates `data-theme-mode` on `<html>`.
- Scale updates `--t-user-scale` on `<html>` and flows into theme tokens.
- The editor shows the effective scale, allows precise numeric entry, and offers a reset back to the current theme default.
- Changing the scale affects both type and spacing because both derive from `--t-base-size`.

## Validation

- Only registered theme IDs may be applied.
- Mode must be `light` or `dark`.
- Scale is clamped to the supported range before storage.

## Edge Cases

- If no preference is stored, the active theme's defaults are used.
- Invalid stored values are ignored and fall back safely.
- Switching themes while using theme default should adopt the new theme's default size automatically.

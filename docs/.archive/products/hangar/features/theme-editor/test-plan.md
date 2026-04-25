---
title: Theme Editor Test Plan
product: hangar
feature: theme-editor
type: test-plan
status: done
---

# Theme Editor Test Plan

## Setup

1. Start Hangar locally.
2. Sign in and open `/settings`.

## Theme Selection

1. Choose `Aviation`.
2. Confirm the visual theme changes immediately.
3. Refresh the page.
4. Confirm `Aviation` is still active.

## Mode Selection

1. Switch from light to dark.
2. Confirm the page updates immediately.
3. Refresh the page.
4. Confirm the chosen mode persists.

## Base Size

1. Move the base-size slider to a larger value.
2. Confirm page titles, labels, buttons, and spacing all grow together.
3. Enter a smaller size in the numeric input.
4. Confirm the editor preview and the surrounding UI update immediately.
5. Refresh the page.
6. Confirm the chosen size persists.

## Reset to Theme Default

1. Click the theme-default reset button.
2. Confirm the effective size returns to the current theme default.
3. Switch themes while still using theme default.
4. Confirm the effective size updates to the new theme's default size.

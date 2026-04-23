# `libs/themes/sim/` (reserved)

Reserved for the upcoming `sim/glass` theme. Nothing ships from this directory
in package #1; package #7 lands the full avionics palette, instrument tokens,
and the vocabulary extension (`libs/themes/sim/vocab.ts`) that exposes
`--instrument-*` names to sim's primitives.

Until package #7, the sim app renders against the default `airboss/default`
theme via `ThemeProvider` at its root layout.

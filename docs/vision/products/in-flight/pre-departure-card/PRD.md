---
name: Pre-Departure Card
id: prd:fly:pre-departure-card
tagline: One-page glanceable summary for today's flight
status: idea
priority: 4
prd_depth: light
category: in-flight
platform_mode:
  - in-flight
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
complexity: low
personal_need: 3
depends_on:
  - prd:pre:route-walkthrough
surfaces:
  - mobile
  - print
content_reuse:
  - airports
  - weather-data
last_worked: null
---

# Pre-Departure Card

## What it does

A single glanceable page for the cockpit: today's route, top 3 risks, divert options, and a memory items refresher. Everything you need on one card, nothing you don't.

## Core features

- Auto-generated from your Route Walkthrough (prd:pre:route-walkthrough) data
- Top 3 risks for this flight highlighted prominently
- Diversion airports with frequencies and runway info
- Key memory items for your aircraft type
- Print-friendly and mobile-optimized for kneeboard use

## Notes

This is an output product -- it assembles data from other products (prd:pre:route-walkthrough, prd:pre:diversion-drill, prd:pre:cold-start-recall) into a single artifact. Low complexity because it's layout and aggregation, not new logic. Value is in the curation: what to include and what to leave off.

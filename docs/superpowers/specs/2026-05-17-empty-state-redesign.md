# Empty State Redesign

**Date:** 2026-05-17
**Status:** Approved

## Problem

The current `EmptyState.vue` uses an animated morphing blob and glass-morphism card — a pattern that reads as AI-generated template rather than a deliberate design decision. Specific issues:

- `blob-bounce` keyframe animation on the icon background is gimmicky
- Glass card (`backdrop-filter: blur`, semi-transparent background, rounded border) adds visual noise without meaning
- Icon at 4rem is oversized relative to the text
- Title at `font-weight: 400` reads as body text, not a heading
- `fade-up` animation on the action slot is unnecessary motion

## Solution

Redesign the shared `EmptyState` component (Option A: Clean & Intentional). All 8 pages that use the component inherit the improvement automatically. No per-page changes needed.

## Design

**Icon treatment:** Replace the blob with a fixed 72px circle — soft purple fill (`rgba(138, 43, 226, 0.08)`), 1px purple-tinted border (`rgba(138, 43, 226, 0.14)`). Static, no animation. Icon scales to 2.25rem.

**Container:** Remove the glass card entirely. `.empty-state` becomes a plain centered column with generous padding (`5rem 2rem`). No background, no blur, no border.

**Typography:**
- Title: `font-weight: 600`, `font-size: 1.5rem`, color `#1a2332` (slightly darker for contrast)
- Description: `font-size: 0.9375rem`, `max-width: 340px`, `line-height: 1.65`, color `#6b7280`

**Motion:** All animations removed (blob-bounce, fade-up).

## Files Changed

| File | Change |
|---|---|
| `components/EmptyState.vue` | Full template + style rewrite |

Props and slot API unchanged — no page-level changes required.

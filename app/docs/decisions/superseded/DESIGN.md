# Kusuo — Design System

Direction: **Signal**, adjusted. A dark instrument for reading your own behaviour. Dense, precise, quiet. The restraint of a logbook in the task rows; the information density of a dashboard below them.

Committed dark only. Kusuo does not follow the phone's light/dark setting — this was an explicit choice, not an omission. There is no light palette to maintain.

## Colour

All colour is defined as CSS custom properties on `:root`. No component declares a literal hex value.

```css
:root{
  /* ground */
  --bg:        #0d1418;  /* app background */
  --surface:   #0f191e;  /* rows, sheets, inputs */
  --surface-2: #101f21;  /* completed rows */
  --line:      #182228;  /* dividers, borders */

  /* text */
  --text:      #dfe9ea;  /* primary */
  --text-2:    #7f9296;  /* secondary, completed habit names */
  --text-3:    #5f7378;  /* labels, axis, metadata */

  /* meaning */
  --done:      #48a08d;  /* completed, positive trend */
  --focus:     #e0a75f;  /* current value, today marker, endpoint */
  --empty:     #18272c;  /* heatmap cell, no activity */
}
```

Heatmap ramp, low to high: `--empty` → `#1f3f42` → `#2f6f6a` → `--done`.

Two rules that hold the palette together:

- **Only two hues carry meaning.** `--done` (teal) for completion and positive movement, `--focus` (amber) for the present moment and current values. Everything else is neutral.
- **There is no red.** Missing a day is not an error, and colouring absence as danger contradicts the product's stated voice. Absence is shown as `--empty` — a gap, not an alarm.

## Type

```
Display / UI   Archivo          500, 600, 700
Data           JetBrains Mono   400, 500
```

Every number in the app is JetBrains Mono with `font-variant-numeric: tabular-nums`. Streaks, percentages, dates, axis labels, counts. This is what makes the app read as an instrument rather than a document, and it is not optional.

Scale, in px: `10 · 11.5 · 13 · 14.5 · 16 · 19 · 24 · 30`

Uppercase labels (`--text-3`, 10px, JetBrains Mono) carry `letter-spacing: .16em`. Headings get `text-wrap: balance`.

## Layout

- Spacing scale: `4 · 8 · 12 · 16 · 20 · 26 · 36`
- Radii: `2` on data cells, `4` on rows and containers, `999` never — pills belong to a warmer product than this one
- Sibling groups use flex or grid with `gap`. No per-element margins.
- Minimum tap target 44×44pt, including the completion control.
- `100dvh` for full-height, never `100vh`. Respect `env(safe-area-inset-*)` top and bottom.

## Screen order

The task list sits **above** the history. This is the single most important layout decision in the app: the five-second job is ticking things off, so the grid must not be the first thing seen at 6am. History is directly below, one thumb-scroll away, plainly visible — never hidden, never leading.

## Motion

Minimal and functional. Completion is a 120ms state change, not an animation. No page transitions, no spring physics, no celebratory motion of any kind. Everything honours `prefers-reduced-motion`.

## States

Every screen defines four: empty, populated, error, and offline. The empty state explains what to do next in one sentence and does not encourage.

## The partner surface

The partner's data uses the same palette and the same restraint, with two additions and one prohibition.

- **A partner's record is rendered one step quieter than your own.** Their habit names sit at `--text-2`, their completion marks at a desaturated `--done`. Present, legible, secondary. You are looking at their day, not being reported to about it.
- **Staleness is stated, never hidden.** The Partner screen carries a plain mono line — `synced 4 min ago` — at `--text-3`. When offline it says so. The app never presents old data as current.
- **A partner's gap is `--empty` and nothing else.** No colour change, no border, no icon, no emphasis of any kind on a missed day. Absence renders as absence. This is the rule that keeps the product from becoming a scoreboard, and it holds even when a gap is long.

There is no visual language for comparison in this design system — no side-by-side bars, no two-series charts, no combined totals. If a component would let you read one person's number against the other's at a glance, it does not get built.

## Mac read-only build

Same design system, wider layout. Write affordances — completion controls, add and edit buttons, the reflection form — are **absent**, not disabled. A permanent, quiet line in the header reads `Viewing only — log on your phone`.

# Prompt for Claude Design — rebuild the Nocturne token stylesheet

Paste everything below the line into Claude Design.

---

I need the design-system stylesheet for **Nocturne**, the dark theme behind my Kusuo Redesign
canvas. The canvas HTML references the tokens but does not define them, and the original
`_ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/styles.css` is missing. Rebuild that file.

## What Kusuo is

A personal habit and training tracker, iPhone-first, installed to the home screen. It is a quiet
instrument for reading your own behaviour — habits ticked off in the morning, weight-training
sessions logged set by set, a calendar and personal records.

It states what is true and stops. No gamification, no celebration, no trophies or badges or XP, no
streak-anxiety mechanics. Copy on a bad week reads as reassuring, never punitive. Destructive
actions do not get a red button — they read through an outlined button, a warning icon and explicit
copy. So the palette carries **no alert red and no success green**: absence is shown as absence, not
as danger.

The look is dark, calm and precise. Hairline rules, outlined primary actions, one accent used as
both line and glow, Phosphor icons.

## Deliverable

One CSS file. A single `:root` block defining exactly the twenty custom properties below, and
nothing else. No resets, no component classes, no utility classes, no `@media` blocks — the theme is
committed dark-only and does not follow the system light/dark setting.

## The twenty tokens, and what each one actually does

I counted these usages in the canvas, so please treat them as the real contract rather than
guessing at intent.

**Ground**

| Token | Role |
| --- | --- |
| `--color-bg` | App background behind every screen. Used 67 times as `background`. |
| `--color-surface` | Cards, rows, sheets and inputs sitting on the background. 21 uses. |
| `--color-text` | Primary foreground. Used 571 times as `color`, and also as a light `background` for inverted chips (85 uses) and as a border (30). |

**Accent — a nine-step violet ramp, 100 lightest through 900 darkest**

`--color-accent` is the base step and the most-used colour after text: 93 backgrounds, 63 as
`color`, 32 borders, 19 `box-shadow` glows.

- `--color-accent-100`, `-200`, `-300`, `-400` are used as **foreground text on the dark
  background** (`-200` alone appears 47 times). They must be light enough to read.
- `--color-accent-500` through `-900` are used as **fills, borders and left-rules** (`-700` 58
  backgrounds, `-800` 55 backgrounds plus 19 `border-left` hairlines). They must be dark enough to
  sit under light text.

**Neutral — only three steps are referenced**

- `--color-neutral-800` — the standard hairline border, 52 uses. This is the most important
  neutral: it must be visible against `--color-bg` without ever reading as a hard line.
- `--color-neutral-700` — a slightly stronger border, and a `box-shadow` colour in 5 places.
- `--color-neutral-600` — the strongest of the three, used twice as a border.

**Shadows**

`--shadow-sm`, `--shadow-md`, `--shadow-lg`. Full `box-shadow` values, tuned for a near-black
surface: low spread, high blackness, no coloured or glowing shadow. On dark UI a shadow reads as
depth only when it is genuinely darker than the surface beneath it.

**Type**

`--font-body`. A system font stack — the app is a PWA on iPhone, so it should feel native and cost
no download. Put `-apple-system` and `BlinkMacSystemFont` first.

## Hard constraints

1. **Anchor colours already in the canvas, which must not shift:**
   - `#05050c` — the phone screen background inside the iOS frames. `--color-bg` should be this or
     within a hair of it: a near-black with a cold blue cast, not a neutral grey.
   - `#9184d9` — the canvas link colour, drawn from the accent. Build the ramp so that
     `--color-accent` lands on or very near this violet.
   - `#b5abfc` — the canvas link hover, one step lighter. This is roughly where `--color-accent-300`
     or `-200` should sit.

2. **`--color-text` must be near-white and fully opaque.** The canvas builds its entire secondary
   type scale by mixing it down — `color-mix(in srgb, var(--color-text) 45%, transparent)` appears
   174 times, and there are 759 `color-mix` calls in total, at 9%, 10%, 12%, 16%, 40%, 45%, 50%,
   55%, 60% and 65%. Every one of those steps has to stay legible or fade to a usable hairline, so a
   text colour that is already dim or already translucent breaks the whole scale. The low
   percentages (9–16%) are used as fills and dividers, not as text.

3. **Contrast, checked and stated.** Against `--color-bg`:
   - `--color-text` at 4.5:1 or better, and comfortably above it — aim past 12:1 so the 45% mix is
     still readable.
   - `--color-text` mixed to 45% must still clear 4.5:1. Tell me the number you get.
   - `--color-accent-100` through `-300` must clear 4.5:1 as body text.
   - `--color-accent` must clear 3:1 as an interactive element and icon colour.
   - `--color-neutral-800` needs to be perceptible as a border without reaching 3:1 — it is a
     hairline, not a line.

4. **No red and no green anywhere in the palette**, per the product rules above.

5. The ramp must be perceptually even. Do not generate the nine steps by naive lightness
   interpolation in sRGB — the middle of a violet ramp goes muddy that way. Work in OKLCH or a
   similar perceptual space and keep chroma from collapsing at the dark end.

## Output

Give me the finished CSS file, and under it a short table of the eleven colour tokens with their
resolved hex values and the measured contrast ratio against `--color-bg`. If any of my constraints
conflict with each other, say which and what you did instead — I would rather know than get a file
that quietly missed one.

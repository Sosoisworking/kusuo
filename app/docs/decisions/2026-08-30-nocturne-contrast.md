> **SUPERSEDED 31 August 2026** by `2026-08-31-nocturne-contrast-corrected.md`.
>
> Everything below was computed against `--color-bg: #05050c` and `--color-text: #eaeaf2`. Neither
> is a Nocturne token: `#05050c` is the canvas frame colour behind the iPhone mockups, mistaken for
> the app background while the real stylesheet was missing from the repo. The real ground is
> `#161826`. The arithmetic here is correct; its inputs are not. **Do not implement the
> `--color-text-muted: #76767f` fix — against the real ground the 55% mix clears AA and no solid
> token is needed.** Kept for its reasoning.

# Decision — the Nocturne muted text step must be a solid token

**Date:** 30 August 2026
**Status:** Binding on the Nocturne redesign

## The problem

The Nocturne palette anchors on a near-black ground, `--color-bg: #05050c`, and derives muted text with an alpha mix of the body colour:

```css
color-mix(in srgb, var(--color-text) 45%, transparent)
```

With `--color-text: #eaeaf2`, that resolves over the ground to `#6c6c74`, which measures **3.903:1**.

WCAG AA requires **4.5:1** for normal-size text. 3:1 is sufficient only for non-text UI and for large text — 24px, or 18.66px bold.

## It cannot be fixed by adjusting the text colour

To clear 4.5:1 against `#05050c`, the mixed result needs a relative luminance of 0.1825, which for a near-neutral works out to roughly 118 per channel. Solving the mix:

```
0.45 × X + 0.55 × 5 = 118
X = 256.1
```

Past the top of the 0–255 range. The ground and the mix percentage are in conflict; no source colour resolves it.

## The fix

**Define the muted step as a literal value rather than a mix.** The 255 ceiling exists only because `color-mix(…, transparent)` over a near-black ground has a hard upper bound. A solid token has no such limit.

```css
--color-text-muted: #76767f;  /* 4.52:1 on #05050c */
```

Verified: relative luminance 0.1834, contrast ratio 4.516:1.

This keeps the near-black ground and keeps a single muted step. The alternative — lifting `--color-bg` to roughly `#12131f` — sacrifices the near-black that gives the palette its character, for no gain over the solid token.

## Where each step may be used

| Step | Resolves to | Ratio | Valid for |
|---|---|---|---|
| `--color-text` `#eaeaf2` | — | 16.98:1 | anything |
| 55% mix | `#83838a` | 5.40:1 | any text, including small |
| **`--color-text-muted` `#76767f`** | — | **4.52:1** | any text, including small |
| 45% mix | `#6c6c74` | 3.90:1 | hairlines, icon strokes, disabled states, text ≥24px **only** |

**The 45% step must not carry labels, meta text, or inactive tab labels.** Those render at 9–13px in this design, which is exactly the case requiring 4.5:1. An earlier note claimed 3.90:1 was "sound for the labels, meta and inactive tab text it's mostly doing" — that inverts the rule. 3:1 covers non-text UI and large text; small text needs 4.5:1.

## Verification

All ratios above were computed independently using the WCAG relative-luminance formula (sRGB linearisation, 0.2126R + 0.7152G + 0.0722B, `(L1+0.05)/(L2+0.05)`), not taken from a tool. Recompute before changing any value here.

**Re-verified 31 August 2026**, independently and from scratch: 16.981:1, 3.904:1, 5.404:1, 4.517:1. The table stands. One correction: the 55% mix resolves to `#83838b`, not `#83838a` — a rounding difference that does not change the ratio.

### Two conditions this decision rests on

1. **`--color-text: #eaeaf2` is an assumption, not a fact.** That value appears nowhere in the repository — it belongs to the missing `_ds/nocturne-.../styles.css`. Every ratio above is derived from it. When the real stylesheet is exported, recompute all four rows before relying on any of them; if the exported text colour is darker, `--color-text-muted` moves too.
2. **`#76767f` has no headroom.** It is the first solid neutral step that clears 4.5:1 against `#05050c`. Any darkening fails the threshold, so it is a floor rather than a comfortable choice.

# Decision — the muted text step, recomputed against the real Nocturne ground

**Date:** 31 August 2026
**Status:** Binding. Supersedes `2026-08-30-nocturne-contrast.md`, which was computed against the wrong background.

## What was wrong

The 30 August decision assumed:

```
--color-bg:   #05050c
--color-text: #eaeaf2
```

Neither is a Nocturne token. `#05050c` is the **canvas frame colour** — the fill behind the iPhone
mockups in `Kusuo Redesign.dc.html`, which appears four times as a literal in that file. It was
mistaken for the app background because the real stylesheet was missing from the repo and there was
nothing to check against.

The actual stylesheet was read on 31 August out of the Claude Design project
(`_ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/styles.css`, 295 lines). Its `:root` block is
copied to `docs/nocturne-tokens.css`. The real values are:

```
--color-bg:   #161826    /* not #05050c — a full 20 steps lighter */
--color-text: #e9e9ed
```

## Recomputed, WCAG relative luminance, against `#161826`

| Step | Resolves to | Ratio | Valid for |
|---|---|---|---|
| `--color-text` `#e9e9ed` | — | **14.54:1** | anything |
| 65% mix | `#9fa0a7` | 6.76:1 | any text |
| 60% mix | `#95959d` | 5.92:1 | any text |
| **55% mix** | `#8a8b93` | **5.19:1** | any text — **use this for small muted text** |
| 50% mix | `#80808a` | 4.50:1 | passes, but exactly at the threshold |
| **45% mix** | `#757680` | **3.91:1** | hairlines, icon strokes, disabled, text ≥24px **only** |
| 40% mix | `#6a6c76` | 3.37:1 | large text and non-text UI only |
| 16% / 12% / 9% mixes | `#383946` / `#2f313e` / `#292b38` | 1.54 / 1.37 / 1.26:1 | fills and dividers, never text |
| `--color-accent` `#9184d9` | — | **5.45:1** | any text, and interactive elements |
| `--color-accent-100` … `-400` | `#f5f4ff` … `#b5abfc` | 16.15 → 8.55:1 | any text |
| `--color-accent-500` `#968ae0` | — | 5.88:1 | any text |
| `--color-neutral-600` `#75798c` | — | 4.08:1 | large text and non-text UI |
| `--color-neutral-700` `#595d6c` | — | 2.69:1 | borders and fills only |
| `--color-neutral-800` `#3f424d` | — | 1.76:1 | hairline borders — correct as used |

## What holds and what changes

**Holds:** the 45% mix still fails AA for small text — 3.91:1, essentially the same number the old
decision found, arrived at honestly this time. It must not carry labels, meta text, or inactive tab
labels. Those render at 9–13px in this design and need 4.5:1.

**Changes:** the old decision's central claim — that no mix percentage can work, because the maths
demands a source value of 256.1, past the top of the range — was an artefact of the wrong ground.
Against the real `#161826` the 50% mix already clears 4.5:1 and the 55% mix clears it comfortably.

**So `--color-text-muted: #76767f` is not needed and should not be added.** Use the 55% mix for
small muted text. 55% is preferred over 50% because 50% lands exactly on 4.50:1 with no headroom,
and the design system's own canvas already uses a 55% step.

**Also better than assumed:** `--color-accent` was expected to need a 3:1 exemption as a
non-text element. At 5.45:1 it passes AA as body text outright, so accent-coloured labels and the
active tab label are fine at any size.

## Verification

Computed from the sRGB relative-luminance formula (linearise each channel,
`0.2126R + 0.7152G + 0.0722B`, then `(L1 + 0.05) / (L2 + 0.05)`), not read from a tool. The mixes
are `color-mix(in srgb, var(--color-text) N%, transparent)` composited over `--color-bg`.

Recompute before changing any value here. Unlike the superseded decision, every input above is a
real token from the shipped stylesheet rather than an assumption.

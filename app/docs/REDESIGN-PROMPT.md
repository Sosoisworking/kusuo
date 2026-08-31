# Kusuo redesign prompt — habits + training

Implementation brief for the Kusuo PWA (`Kusuo/app`). Reference design: `Kusuo Redesign.dc.html`
(26 screens, iPhone frames, Nocturne tokens). Read that file for exact layout, copy and spacing;
this document states intent, scope and rules.

## What changes

Kusuo keeps its habit core and gains a real training module ported from Push to Play
(https://r4in3k-creator.github.io/Push-to-Play/): split templates, set-by-set logging, a training
calendar and personal records — rebuilt in Kusuo's calm voice, not Push to Play's.

Navigation grows from five tabs to six:

| Tab | Icon (Phosphor) | Contents |
| --- | --- | --- |
| Today | `sun-horizon` | Week strip, next-up card, habit list, Reflect + Goals as collapsed cards |
| Train | `barbell` | Active split day, Start session, exercise list, session flow |
| Splits | `cards` | Six programme templates, active split, split editor |
| Calendar | `calendar-blank` | Month grid with category dots, Habits / Training toggle, day detail |
| Records | `list-numbers` | Per-lift records and habit bests, Habits / Training toggle, kg/lb |
| Settings | `gear` | Units, week start, theme, defaults; "Your data" sub-screen |

Reflect and Goals lose their tabs and become collapsed cards at the bottom of Today (they keep
their own full screens, reached by tapping the card). Account moves behind the profile menu — the
initials button in the Today and Train headers.

## Screens to build

Primary: Today, Train, Splits, Calendar, Records, Settings, Settings → Your data.
Secondary: session flow, exercise detail, split editor, directory, add-custom-exercise sheet,
calendar day detail, profile menu, share, import, account, reset confirm, export confirm.
Onboarding: four steps — welcome → you (name, units, bodyweight, height, experience) → first
habits → pick a split. Every onboarding field is skippable.

## Training model

Append-only, same architecture rule as habits. Nothing is a mutable flag; nothing auto-increments.

- `Exercise` — uuid, name, category (`push` | `pull` | `legs` | `abs`), muscleGroup, equipment,
  referenceUrl?, isCustom. Seed set follows the ExRx.net directory (categories and the 3-day PPL
  template); attribute it in the UI and do not imply affiliation.
- `Split` — uuid, name, days: `SplitDay[]`. `SplitDay` — uuid, label, entries: `{exerciseId, sets, reps}[]`.
  Six seeded templates: PPL (3-day), PPL + Abs (4), PPL + Upper/Lower (5), Upper/Lower (4),
  Full body (3), Bro split (5). A user's edits to a template persist as their copy.
- `SessionEvent` — uuid, timestamp, splitDayId, exerciseId, setIndex, weightKg, reps, rpe?.
  One event per logged set. Weight is always stored in kg; display converts.
- `SessionCompleted` — uuid, date, splitDayId. Logging a session also emits the `Fitness` habit
  completion for that date (one obvious tick, not two places to tap).

Records are **derived by replay**, never stored: heaviest single set, estimated 1RM (Epley),
best set volume, total session volume, rep PR at a given weight. Habit records likewise: best
streak, best month.

## Behaviour

- **Train opens session-first**: a Start session card for today's split day, the day's exercises
  below, recent sessions after. Not a tray.
- **Session flow is one exercise at a time**: set table with weight, reps and RPE; logging a set
  advances focus to the next set. **There is no rest timer anywhere in the app** — do not add one.
- **Split editor**: drag handle to reorder, swipe a row left to reveal Remove, `Swap` on each row
  opens the directory. One gesture per row at a time.
- **Directory**: text search plus filters for category, muscle group, equipment, recently used and
  "mine". Add-custom is a bottom sheet.
- **Calendar and Records are shared surfaces** with a Habits / Training segmented toggle. Calendar
  day dots encode category; day detail leads with a summary (dots, volume, sets, habits done) and
  puts the set-by-set breakdown below.
- **Units**: kg default with an lb toggle in Settings and inline on Records.
- **Week starts** Monday by default, switchable to Sunday; it drives the week strip, calendar and
  heatmaps.
- **Share**: plain text for one session or a date range, with a `KUS2` import code behind a toggle
  (on by default). Copy, share sheet, or save as file.
- **Import**: paste a whole message (find the code automatically) or pick a file. Imports arrive as
  a new split day; nothing existing is overwritten.
- **Reset all data** covers everything — habits, completions, sessions, records, reflections. It
  lives in Settings → Your data behind a warning panel and a confirm dialog that requires typing
  `RESET` and offers "Export first".
- **Read-only Mac still holds** for training: the iPhone is the only writer. No write UI on desktop,
  not even disabled controls.

## Rules that do not bend

1. No gamification. Records are facts, stated plainly — no trophies, badges, XP, levels or targets.
   Copy on a bad week reads as reassuring, never punitive.
2. No rest timer, no notifications, no reminders.
3. No accounts, no server, no telemetry, no AI. Local-first via IndexedDB; export is the only copy
   that leaves the device.
4. Event-sourced and UUID-keyed throughout, so a future multi-device merge stays a set union.
5. Nocturne design system only: every colour, size, radius and shadow from `var(--*)` tokens.
   Outlined primary actions, hairline rules fading at their ends, one accent used as line and glow,
   Phosphor icons, no new colours — including for destructive actions, which read through an
   outlined button, a warning icon and explicit copy.
6. 44×44pt minimum tap targets; safe-area and `100dvh` aware; six tabs fit at 402px with 19px icons
   and 9px labels.
7. Five-second open: today's habits and the next action visible immediately. Nothing gates the core
   loop behind navigation.

## Suggested slice order

1. Six-tab shell + revised Today (Reflect/Goals as cards).
2. Exercise and split data model, seeded templates, Splits tab.
3. Train tab + session flow + `SessionEvent` writes + Fitness auto-tick.
4. Calendar (training side, then the Habits toggle) + day detail.
5. Records derivation + Records tab + units toggle.
6. Split editor, directory, add-custom.
7. Settings rebuild, Your data, export/import/share, reset confirm.
8. Four-step onboarding.
9. Exercise detail, profile menu, account.

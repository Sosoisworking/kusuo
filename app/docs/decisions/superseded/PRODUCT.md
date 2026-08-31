# Kusuo — Product Brief

Written from the design interview on 30 August 2026, revised the same day after the couples decision. This file and `DESIGN.md` are the contract every later decision checks against. If the code and this document disagree, one of them is a bug.

## What Kusuo is

A personal growth system for two people who live their lives separately but want to see each other's effort.

Each person keeps their own habits, their own record, their own private practice. Some of those habits are shared with their partner — chosen deliberately, one at a time. Neither person can change the other's record.

It is not a motivational app, and it is not a social network. It does not congratulate, nudge, rank, or compare. It shows what is true and stops.

## The two users

**Soso** — iPhone, builds and maintains it. Habits include reading, Japanese, Quran, and fitness.

**His partner** — a real second user, not a hypothetical. The couples idea was Soso's; she is willing. That distinction matters: **her habits and her reasons must shape the design, not just his.** Anything built for "the partner" as an abstraction will be wrong. Before the pairing work begins, her actual habits and what she'd want to see need to be gathered the same way Soso's were.

## The one job

Open the app, see today, tick things off. Under five seconds, no navigation, no confirmation dialogs. Seeing your partner's day is a glance below that — never the first thing, never in the way.

## Privacy is the product

The default is private. A habit is visible to a partner only when its owner explicitly shares it, one habit at a time, and can be unshared at any moment.

Reading and fitness might be shared. Quran and Japanese might never be. That is not a settings edge case — it is the central design commitment, and it is what separates this from a surveillance app. **Nothing is shared by default. Ever.**

Reflections — mood, energy, notes, wins — are never shared with a partner in any configuration. There is no setting for it.

### What changed about data

Earlier drafts of this document promised that no data ever leaves the device. That is no longer strictly true and the change is stated plainly rather than buried:

- Your own record stays local and is the source of truth. The app works offline.
- **Only the habits you explicitly share** — their names and completion events — are sent to a server so your partner can see them.
- Reflections, private habits, and everything else never leave the device.
- Unpairing revokes access in both directions immediately. Each person keeps their own local history.

## Voice

Factual and unsentimental. The app states what is true and stops.

- It does not use either person's name.
- It does not comment on performance — yours or your partner's. Especially not your partner's.
- No exclamation marks anywhere in the interface.
- Empty states explain what to do next; they do not encourage.

### The bad week

Miss four days and the app shows it plainly. The streak resets to zero and the gap stays visible. No grace day, no streak protection, no "back to it" message.

**This rule applies to your own record only.** How a partner's bad week is presented is a separate and much more delicate question — see below.

### The partner's bad week

This is the hardest design problem in the product, and getting it wrong turns the app into a resentment engine.

Rules:

- The app never editorialises about a partner's record. No "she's fallen behind", no comparison, no combined score, no ranking, no shared streak that either person can break for the other.
- A partner's gaps are visible but never emphasised. Absence is shown as absence, never as an alert, a colour change, or anything that reads as a flag.
- There are no notifications about a partner's behaviour. The app never tells one person that the other did or did not do something.
- **The app provides no way to react, comment, encourage, or nudge.** It is a window, not a feed. Talking about it happens in real life, where tone exists.

That last rule is the one to revisit after a month of real use. Starting with zero social features is deliberate: every one that gets added is a thing that can nag. If both people find they want a way to acknowledge something, one can be added then, designed on purpose.

## Anti-references

- **No composite scores.** No discipline score, no growth score, no XP, no levels — and emphatically no couple score. A single number comparing two people is the worst possible object in this product.
- **No leaderboards, streaks-versus, or competition** of any kind between partners.
- **No celebration.** No confetti, no badges, no achievement unlocks.
- **No streak anxiety mechanics.** Nothing that exists to make missing a day feel expensive, to either person.
- **No cards inside cards**, no decorative gradients, no emoji as interface furniture.

## Scope

Everything in the legacy specification ships: habits, goals, reflection, weekly review, monthly review — plus pairing and partner view. Roughly a month, treated as a target rather than a deadline.

Prior attempts at this project stalled because life got busy, not because of scope or technical walls. The build is therefore cut into slices that each survive a two-week interruption: every slice leaves the app working and installed, and no slice depends on remembering where the last one left off.

## Model decisions

**Frequency is chosen per habit by the user.** Daily, a number of times per week, or specific weekdays.

**Reflection has its own screen** and is never shared.

**Goals work two ways.** Some group the habits that serve them; others carry a numeric target advanced by hand. Goals are private in v1.

**First-run templates:** Reading, Japanese, Quran, fitness.

## Home-screen identity

Label: **Kusuo**. Icon direction not yet chosen.

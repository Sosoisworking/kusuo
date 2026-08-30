import type { SplitEntry } from '../db/schema'

export interface SplitDayTemplate {
  label: string
  entries: SplitEntry[]
}

export interface SplitTemplate {
  /** Stable slug. Instantiating a template mints fresh UUIDs for the split and
   *  its days and records this id as `seededFrom`, so the user's copy stays
   *  traceable while their session history keeps pointing at ids they own. */
  id: string
  name: string
  days: SplitDayTemplate[]
}

const e = (exerciseId: string, sets: number, reps: number): SplitEntry => ({ exerciseId, sets, reps })

const PUSH_DAY: SplitDayTemplate = {
  label: 'Push',
  entries: [
    e('ex-barbell-bench-press', 4, 6),
    e('ex-incline-dumbbell-press', 3, 10),
    e('ex-overhead-press', 3, 8),
    e('ex-lateral-raise', 3, 15),
    e('ex-triceps-pushdown', 3, 12),
  ],
}

const PULL_DAY: SplitDayTemplate = {
  label: 'Pull',
  entries: [
    e('ex-deadlift', 3, 5),
    e('ex-pull-up', 4, 8),
    e('ex-seated-cable-row', 3, 10),
    e('ex-face-pull', 3, 15),
    e('ex-barbell-curl', 3, 10),
  ],
}

const LEGS_DAY: SplitDayTemplate = {
  label: 'Legs',
  entries: [
    e('ex-back-squat', 4, 6),
    e('ex-romanian-deadlift', 3, 8),
    e('ex-leg-press', 3, 12),
    e('ex-lying-leg-curl', 3, 12),
    e('ex-standing-calf-raise', 4, 15),
  ],
}

const ABS_DAY: SplitDayTemplate = {
  label: 'Abs',
  entries: [
    e('ex-hanging-leg-raise', 3, 12),
    e('ex-cable-crunch', 3, 15),
    e('ex-plank', 3, 1),
    e('ex-side-plank', 3, 1),
  ],
}

const UPPER_DAY: SplitDayTemplate = {
  label: 'Upper',
  entries: [
    e('ex-barbell-bench-press', 4, 6),
    e('ex-barbell-row', 4, 8),
    e('ex-dumbbell-shoulder-press', 3, 10),
    e('ex-lat-pulldown', 3, 10),
    e('ex-dumbbell-curl', 3, 12),
    e('ex-triceps-pushdown', 3, 12),
  ],
}

const LOWER_DAY: SplitDayTemplate = {
  label: 'Lower',
  entries: [
    e('ex-back-squat', 4, 6),
    e('ex-romanian-deadlift', 3, 8),
    e('ex-bulgarian-split-squat', 3, 10),
    e('ex-lying-leg-curl', 3, 12),
    e('ex-seated-calf-raise', 4, 15),
  ],
}

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    id: 'split-ppl-3',
    name: 'Push / Pull / Legs',
    days: [PUSH_DAY, PULL_DAY, LEGS_DAY],
  },
  {
    id: 'split-ppl-abs-4',
    name: 'Push / Pull / Legs + Abs',
    days: [PUSH_DAY, PULL_DAY, LEGS_DAY, ABS_DAY],
  },
  {
    id: 'split-ppl-upper-lower-5',
    name: 'Push / Pull / Legs + Upper / Lower',
    days: [PUSH_DAY, PULL_DAY, LEGS_DAY, UPPER_DAY, LOWER_DAY],
  },
  {
    id: 'split-upper-lower-4',
    name: 'Upper / Lower',
    days: [
      { ...UPPER_DAY, label: 'Upper A' },
      { ...LOWER_DAY, label: 'Lower A' },
      {
        label: 'Upper B',
        entries: [
          e('ex-incline-barbell-press', 4, 8),
          e('ex-dumbbell-row', 4, 10),
          e('ex-lateral-raise', 3, 15),
          e('ex-chin-up', 3, 8),
          e('ex-hammer-curl', 3, 12),
          e('ex-overhead-triceps-extension', 3, 12),
        ],
      },
      {
        label: 'Lower B',
        entries: [
          e('ex-front-squat', 4, 8),
          e('ex-hip-thrust', 3, 10),
          e('ex-walking-lunge', 3, 12),
          e('ex-leg-extension', 3, 15),
          e('ex-standing-calf-raise', 4, 15),
        ],
      },
    ],
  },
  {
    id: 'split-full-body-3',
    name: 'Full body',
    days: [
      {
        label: 'Full body A',
        entries: [
          e('ex-back-squat', 3, 6),
          e('ex-barbell-bench-press', 3, 6),
          e('ex-barbell-row', 3, 8),
          e('ex-plank', 3, 1),
        ],
      },
      {
        label: 'Full body B',
        entries: [
          e('ex-deadlift', 3, 5),
          e('ex-overhead-press', 3, 8),
          e('ex-lat-pulldown', 3, 10),
          e('ex-hanging-leg-raise', 3, 12),
        ],
      },
      {
        label: 'Full body C',
        entries: [
          e('ex-front-squat', 3, 8),
          e('ex-incline-dumbbell-press', 3, 10),
          e('ex-seated-cable-row', 3, 10),
          e('ex-cable-crunch', 3, 15),
        ],
      },
    ],
  },
  {
    id: 'split-bro-5',
    name: 'Bro split',
    days: [
      {
        label: 'Chest',
        entries: [
          e('ex-barbell-bench-press', 4, 8),
          e('ex-incline-dumbbell-press', 3, 10),
          e('ex-machine-chest-press', 3, 12),
          e('ex-cable-fly', 3, 15),
        ],
      },
      {
        label: 'Back',
        entries: [
          e('ex-deadlift', 3, 5),
          e('ex-pull-up', 4, 8),
          e('ex-barbell-row', 3, 10),
          e('ex-seated-cable-row', 3, 12),
        ],
      },
      {
        label: 'Shoulders',
        entries: [
          e('ex-overhead-press', 4, 8),
          e('ex-dumbbell-shoulder-press', 3, 10),
          e('ex-lateral-raise', 4, 15),
          e('ex-rear-delt-fly', 3, 15),
        ],
      },
      { ...LEGS_DAY, label: 'Legs' },
      {
        label: 'Arms',
        entries: [
          e('ex-barbell-curl', 3, 10),
          e('ex-hammer-curl', 3, 12),
          e('ex-close-grip-bench-press', 3, 10),
          e('ex-triceps-pushdown', 3, 12),
          e('ex-preacher-curl', 3, 12),
        ],
      },
    ],
  },
]

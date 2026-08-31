import type { ExerciseCategory } from '../db/schema'

export interface ExerciseSeed {
  /**
   * Stable slug, not a random UUID: seeding must be idempotent across
   * installs and app versions, and the split templates reference these by id.
   * Custom exercises the user adds get a crypto.randomUUID() instead.
   */
  id: string
  name: string
  category: ExerciseCategory
  muscleGroup: string
  equipment: string
}

/**
 * Movement directory. The push/pull/legs/abs grouping and the muscle-group
 * naming follow ExRx.net's exercise directory, which the UI credits. No
 * affiliation or endorsement is implied, and no reference URLs are stored —
 * a link that rots is worse than no link.
 */
export const EXERCISE_SEED: ExerciseSeed[] = [
  // Push
  { id: 'ex-barbell-bench-press', name: 'Barbell bench press', category: 'push', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'ex-incline-barbell-press', name: 'Incline barbell press', category: 'push', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'ex-dumbbell-bench-press', name: 'Dumbbell bench press', category: 'push', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'ex-incline-dumbbell-press', name: 'Incline dumbbell press', category: 'push', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'ex-machine-chest-press', name: 'Machine chest press', category: 'push', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'ex-cable-fly', name: 'Cable fly', category: 'push', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'ex-push-up', name: 'Push-up', category: 'push', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { id: 'ex-overhead-press', name: 'Overhead press', category: 'push', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { id: 'ex-dumbbell-shoulder-press', name: 'Dumbbell shoulder press', category: 'push', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex-lateral-raise', name: 'Lateral raise', category: 'push', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex-cable-lateral-raise', name: 'Cable lateral raise', category: 'push', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'ex-triceps-pushdown', name: 'Triceps pushdown', category: 'push', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'ex-overhead-triceps-extension', name: 'Overhead triceps extension', category: 'push', muscleGroup: 'Triceps', equipment: 'Dumbbell' },
  { id: 'ex-close-grip-bench-press', name: 'Close-grip bench press', category: 'push', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { id: 'ex-dip', name: 'Dip', category: 'push', muscleGroup: 'Triceps', equipment: 'Bodyweight' },

  // Pull
  { id: 'ex-deadlift', name: 'Deadlift', category: 'pull', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'ex-barbell-row', name: 'Barbell row', category: 'pull', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'ex-pull-up', name: 'Pull-up', category: 'pull', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: 'ex-chin-up', name: 'Chin-up', category: 'pull', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: 'ex-lat-pulldown', name: 'Lat pulldown', category: 'pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex-seated-cable-row', name: 'Seated cable row', category: 'pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex-dumbbell-row', name: 'Dumbbell row', category: 'pull', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { id: 'ex-face-pull', name: 'Face pull', category: 'pull', muscleGroup: 'Rear delts', equipment: 'Cable' },
  { id: 'ex-rear-delt-fly', name: 'Rear delt fly', category: 'pull', muscleGroup: 'Rear delts', equipment: 'Dumbbell' },
  { id: 'ex-barbell-curl', name: 'Barbell curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'ex-dumbbell-curl', name: 'Dumbbell curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex-hammer-curl', name: 'Hammer curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex-preacher-curl', name: 'Preacher curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'ex-shrug', name: 'Shrug', category: 'pull', muscleGroup: 'Traps', equipment: 'Dumbbell' },

  // Legs
  { id: 'ex-back-squat', name: 'Back squat', category: 'legs', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'ex-front-squat', name: 'Front squat', category: 'legs', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'ex-leg-press', name: 'Leg press', category: 'legs', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'ex-bulgarian-split-squat', name: 'Bulgarian split squat', category: 'legs', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'ex-walking-lunge', name: 'Walking lunge', category: 'legs', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'ex-leg-extension', name: 'Leg extension', category: 'legs', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'ex-romanian-deadlift', name: 'Romanian deadlift', category: 'legs', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
  { id: 'ex-lying-leg-curl', name: 'Lying leg curl', category: 'legs', muscleGroup: 'Hamstrings', equipment: 'Machine' },
  { id: 'ex-hip-thrust', name: 'Hip thrust', category: 'legs', muscleGroup: 'Glutes', equipment: 'Barbell' },
  { id: 'ex-standing-calf-raise', name: 'Standing calf raise', category: 'legs', muscleGroup: 'Calves', equipment: 'Machine' },
  { id: 'ex-seated-calf-raise', name: 'Seated calf raise', category: 'legs', muscleGroup: 'Calves', equipment: 'Machine' },

  // Abs
  { id: 'ex-hanging-leg-raise', name: 'Hanging leg raise', category: 'abs', muscleGroup: 'Abs', equipment: 'Bodyweight' },
  { id: 'ex-cable-crunch', name: 'Cable crunch', category: 'abs', muscleGroup: 'Abs', equipment: 'Cable' },
  { id: 'ex-plank', name: 'Plank', category: 'abs', muscleGroup: 'Abs', equipment: 'Bodyweight' },
  { id: 'ex-ab-wheel-rollout', name: 'Ab wheel rollout', category: 'abs', muscleGroup: 'Abs', equipment: 'Other' },
  { id: 'ex-russian-twist', name: 'Russian twist', category: 'abs', muscleGroup: 'Obliques', equipment: 'Other' },
  { id: 'ex-side-plank', name: 'Side plank', category: 'abs', muscleGroup: 'Obliques', equipment: 'Bodyweight' },
  // Added for the Batman split. Named as Soso writes them, so the split reads
  // back the way it was given.
  { id: 'ex-machine-incline-chest-press', name: 'Machine incline chest press', category: 'push', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'ex-pec-deck', name: 'Machine pec deck', category: 'push', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'ex-machine-lateral-raise', name: 'Machine lateral raise', category: 'push', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'ex-plate-loaded-shoulder-press', name: 'Plate-loaded shoulder press', category: 'push', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'ex-front-raise', name: 'Front delt raise', category: 'push', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex-cable-front-raise', name: 'Cable front delt raise', category: 'push', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'ex-archer-pull', name: 'Archer pull', category: 'pull', muscleGroup: 'Rear delts', equipment: 'Cable' },
  { id: 'ex-hibah-cris-cross', name: "Hibah's cris cross", category: 'pull', muscleGroup: 'Rear delts', equipment: 'Cable' },
  { id: 'ex-bayesian-curl', name: 'Bayesian curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'ex-cable-bar-curl', name: 'Cable bar curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'ex-cable-hammer-curl', name: 'Cable hammer curl', category: 'pull', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'ex-close-grip-cable-row', name: 'Close-grip cable row', category: 'pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex-single-arm-lat-pulldown', name: 'Single-arm lat pulldown', category: 'pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex-t-bar-row', name: 'Chest-supported T-bar row', category: 'pull', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'ex-cable-pullover', name: 'Cable pullover', category: 'pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex-weighted-pull-up', name: 'Weighted pull-up', category: 'pull', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: 'ex-plate-loaded-row', name: 'Plate-loaded upper back row', category: 'pull', muscleGroup: 'Back', equipment: 'Machine' },
  { id: 'ex-kneeling-cable-pulldown', name: 'Kneeling cable pulldown', category: 'pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex-triceps-extension', name: 'Triceps extension', category: 'push', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'ex-single-arm-pushdown', name: 'Single-arm triceps pushdown', category: 'push', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'ex-hip-abduction', name: 'Hip abduction', category: 'legs', muscleGroup: 'Glutes', equipment: 'Machine' },
  { id: 'ex-hip-adduction', name: 'Hip adduction', category: 'legs', muscleGroup: 'Adductors', equipment: 'Machine' },

  // Cardio
  { id: 'ex-stair-master', name: 'Stair master', category: 'cardio', muscleGroup: 'Conditioning', equipment: 'Machine' },
  { id: 'ex-treadmill', name: 'Treadmill', category: 'cardio', muscleGroup: 'Conditioning', equipment: 'Machine' },
  { id: 'ex-bike', name: 'Bike', category: 'cardio', muscleGroup: 'Conditioning', equipment: 'Machine' },
]

export const EXERCISE_ATTRIBUTION =
  'Movement categories follow the ExRx.net exercise directory. Not affiliated with or endorsed by ExRx.net.'

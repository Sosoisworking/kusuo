import type { FrequencyType } from '../db/schema'

export interface HabitTemplate {
  id: string
  name: string
  frequencyType: FrequencyType
  frequencyValue: number
  /**
   * The habit a finished training session ticks off. Exactly one template
   * carries this. Onboarding stores the created habit's id in
   * `settings.trainingHabitId`; without it, `finishSession` has nothing to tick
   * and training never reaches the habit record.
   */
  isTraining?: boolean
}

export const STARTER_TEMPLATES: HabitTemplate[] = [
  { id: 'reading', name: 'Reading', frequencyType: 'daily', frequencyValue: 1 },
  { id: 'japanese', name: 'Japanese', frequencyType: 'daily', frequencyValue: 1 },
  { id: 'fitness', name: 'Fitness', frequencyType: 'weekly', frequencyValue: 3, isTraining: true },
]

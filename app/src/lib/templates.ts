import type { FrequencyType } from '../db/schema'

export interface HabitTemplate {
  id: string
  name: string
  frequencyType: FrequencyType
  frequencyValue: number
}

export const STARTER_TEMPLATES: HabitTemplate[] = [
  { id: 'reading', name: 'Reading', frequencyType: 'daily', frequencyValue: 1 },
  { id: 'japanese', name: 'Japanese', frequencyType: 'daily', frequencyValue: 1 },
  { id: 'fitness', name: 'Fitness', frequencyType: 'weekly', frequencyValue: 3 },
]

import { describe, expect, it } from 'vitest'
import { STARTER_TEMPLATES } from './templates'

describe('STARTER_TEMPLATES', () => {
  it('marks exactly one template as the training habit', () => {
    const training = STARTER_TEMPLATES.filter((t) => t.isTraining)
    expect(training).toHaveLength(1)
    expect(training[0].id).toBe('fitness')
  })

  it('gives every template a distinct id', () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

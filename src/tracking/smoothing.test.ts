import { describe, it, expect } from 'vitest'
import { lerp, lerpVec3, smoothExpressions, BlinkStabilizer } from './smoothing'

describe('smoothing', () => {
  describe('lerp', () => {
    it('returns current value when factor is 1 (instant snap)', () => {
      expect(lerp(0, 10, 1)).toBe(10)
    })

    it('returns previous value when factor is 0 (frozen)', () => {
      expect(lerp(5, 10, 0)).toBe(5)
    })

    it('interpolates linearly between previous and current', () => {
      expect(lerp(0, 100, 0.3)).toBeCloseTo(30, 5)
      expect(lerp(0, 100, 0.5)).toBeCloseTo(50, 5)
      expect(lerp(80, 100, 0.4)).toBeCloseTo(88, 5)
    })

    it('works with negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBeCloseTo(0, 5)
    })

    it('works with small values', () => {
      expect(lerp(0, 0.02, 0.35)).toBeCloseTo(0.007, 5)
    })
  })

  describe('lerpVec3', () => {
    it('interpolates each component independently', () => {
      const prev = { x: 0, y: 10, z: -5 }
      const curr = { x: 10, y: 20, z: 5 }
      const result = lerpVec3(prev, curr, 0.5)

      expect(result.x).toBeCloseTo(5, 5)
      expect(result.y).toBeCloseTo(15, 5)
      expect(result.z).toBeCloseTo(0, 5)
    })

    it('does not mutate inputs', () => {
      const prev = { x: 0, y: 0, z: 0 }
      const curr = { x: 1, y: 1, z: 1 }
      lerpVec3(prev, curr, 0.5)

      expect(prev.x).toBe(0)
      expect(prev.y).toBe(0)
      expect(curr.x).toBe(1)
      expect(curr.y).toBe(1)
    })

    it('returns new object', () => {
      const prev = { x: 0, y: 0, z: 0 }
      const curr = { x: 1, y: 1, z: 1 }
      const result = lerpVec3(prev, curr, 0.5)

      expect(result).not.toBe(prev)
      expect(result).not.toBe(curr)
    })
  })

  describe('smoothExpressions', () => {
    it('smooths expression weights by factor', () => {
      const prev = { happy: 0.5, sad: 0.2 }
      const curr = { happy: 1.0, sad: 0.4 }
      const result = smoothExpressions(prev, curr, 0.35)

      expect(result.happy).toBeCloseTo(0.5 + (1.0 - 0.5) * 0.35, 5)
      expect(result.sad).toBeCloseTo(0.2 + (0.4 - 0.2) * 0.35, 5)
    })

    it('starts from zero for new expressions', () => {
      const prev: Record<string, number> = {}
      const curr = { happy: 0.8 }
      const result = smoothExpressions(prev, curr, 0.35)

      expect(result.happy).toBeCloseTo(0 + 0.8 * 0.35, 5)
    })

    it('decays expressions that are no longer active', () => {
      const prev = { happy: 0.5 }
      const curr: Record<string, number> = {}
      const result = smoothExpressions(prev, curr, 0.3)

      // happy = lerp(0.5, 0, 0.3) = 0.5 * 0.7 = 0.35
      expect(result.happy).toBeCloseTo(0.35, 5)
    })

    it('removes expressions that decay below 0.001', () => {
      const prev = { happy: 0.001 }
      const curr: Record<string, number> = {}
      const result = smoothExpressions(prev, curr, 0.1)

      // happy = lerp(0.001, 0, 0.1) = 0.001 * 0.9 = 0.0009 < 0.001 → removed
      expect(result).not.toHaveProperty('happy')
    })

    it('does not mutate inputs', () => {
      const prev = { happy: 0.5 }
      const curr = { happy: 0.8 }
      smoothExpressions(prev, curr, 0.5)

      expect(prev.happy).toBe(0.5)
      expect(curr.happy).toBe(0.8)
    })

    it('returns empty for empty inputs', () => {
      const result = smoothExpressions({}, {}, 0.5)
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('BlinkStabilizer', () => {
    it('starts with eyes open (returns 0)', () => {
      const stabilizer = new BlinkStabilizer()
      expect(stabilizer.process(0, 0)).toBe(0)
    })

    it('does not register blink on first closed frame', () => {
      const stabilizer = new BlinkStabilizer()
      expect(stabilizer.process(0.9, 0.9)).toBe(0)
    })

    it('registers blink after closeThreshold frames', () => {
      const stabilizer = new BlinkStabilizer(0.25, 0.75, 2, 2)

      // Frame 1: eyes closed — not yet blinking
      expect(stabilizer.process(0.9, 0.9)).toBe(0)

      // Frame 2: eyes closed — now blinking
      expect(stabilizer.process(0.9, 0.9)).toBe(1)
    })

    it('stays blinking until open frames threshold met', () => {
      const stabilizer = new BlinkStabilizer(0.25, 0.75, 2, 2)

      // Start blinking
      stabilizer.process(0.9, 0.9)
      stabilizer.process(0.9, 0.9)

      // One open frame — still blinking
      expect(stabilizer.process(0.1, 0.1)).toBe(1)

      // Two open frames — blink ends
      expect(stabilizer.process(0.1, 0.1)).toBe(0)
    })

    it('ignores brief flicker below close threshold', () => {
      const stabilizer = new BlinkStabilizer(0.25, 0.75, 2, 2)

      // Brief flicker — not enough frames
      expect(stabilizer.process(0.5, 0.5)).toBe(0)
      expect(stabilizer.process(0.1, 0.1)).toBe(0)
    })

    it('uses average of left and right blink', () => {
      const stabilizer = new BlinkStabilizer(0.25, 0.75, 1, 1)

      // Left eye fully closed, right eye half closed → avg 0.75 > 0.25
      expect(stabilizer.process(1.0, 0.5)).toBe(1)
    })

    it('reset clears all state', () => {
      const stabilizer = new BlinkStabilizer(0.25, 0.75, 2, 2)

      stabilizer.process(0.9, 0.9)
      stabilizer.process(0.9, 0.9)
      stabilizer.reset()

      // After reset, should need closeThreshold frames again
      expect(stabilizer.process(0.9, 0.9)).toBe(0)
    })

    it('works with default thresholds', () => {
      const stabilizer = new BlinkStabilizer()

      // Default closeThreshold = 0.25, need 2 frames at avg > 0.25
      expect(stabilizer.process(0.5, 0.5)).toBe(0)
      expect(stabilizer.process(0.5, 0.5)).toBe(1)
    })
  })
})
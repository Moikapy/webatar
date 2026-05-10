import { describe, it, expect } from 'vitest'
import { lerp, clamp, degToRad, radToDeg, distance3D, distance2D } from './math'

describe('utils/math', () => {
  describe('lerp', () => {
    it('returns b when t=1', () => {
      expect(lerp(0, 10, 1)).toBe(10)
    })
    it('returns a when t=0', () => {
      expect(lerp(5, 10, 0)).toBe(5)
    })
    it('interpolates in the middle', () => {
      expect(lerp(0, 100, 0.5)).toBe(50)
    })
    it('works with negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0)
    })
  })

  describe('clamp', () => {
    it('clamps to max', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })
    it('clamps to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })
    it('returns value when in range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })
  })

  describe('degToRad', () => {
    it('converts 180 degrees to pi', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI, 5)
    })
    it('converts 90 degrees to pi/2', () => {
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 5)
    })
    it('converts 0 to 0', () => {
      expect(degToRad(0)).toBe(0)
    })
  })

  describe('radToDeg', () => {
    it('converts pi to 180', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180, 5)
    })
    it('converts pi/2 to 90', () => {
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 5)
    })
    it('roundtrip with degToRad', () => {
      expect(radToDeg(degToRad(45))).toBeCloseTo(45, 5)
    })
  })

  describe('distance3D', () => {
    it('calculates distance between two points', () => {
      expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5, 5)
    })
    it('returns 0 for same point', () => {
      expect(distance3D({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0)
    })
  })

  describe('distance2D', () => {
    it('calculates 2D distance', () => {
      expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 5)
    })
    it('returns 0 for same point', () => {
      expect(distance2D({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0)
    })
  })
})
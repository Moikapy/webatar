import { describe, it, expect } from 'vitest'
import {
  computeFacePositionOffset,
  computeHipPositionOffset,
  faceAreaToDepthScale,
} from './auto-calibrate'

// ─── computeFacePositionOffset ───────────────────────────────────────────

describe('computeFacePositionOffset', () => {
  const defaultDist = 3.5
  const defaultFov = 40
  const defaultAr = 16 / 9

  it('returns null for empty landmarks', () => {
    expect(computeFacePositionOffset([], defaultDist, defaultFov, defaultAr)).toBeNull()
  })

  it('centers when face is at center (0.5, 0.5)', () => {
    const landmarks = [
      { x: 0.4, y: 0.3 }, // index 0 (not nose tip)
      { x: 0.5, y: 0.5 }, // index 1 (nose tip — at center)
    ]
    const result = computeFacePositionOffset(landmarks, defaultDist, defaultFov, defaultAr)
    expect(result).not.toBeNull()
    expect(result!.offsetX).toBeCloseTo(0, 3)
    expect(result!.offsetY).toBeCloseTo(0, 3)
  })

  it('pans right when face is on the right', () => {
    const landmarks = [
      { x: 0.4, y: 0.3 },
      { x: 0.7, y: 0.5 }, // nose tip 20% right of center
    ]
    const result = computeFacePositionOffset(landmarks, defaultDist, defaultFov, defaultAr)
    expect(result).not.toBeNull()
    expect(result!.offsetX).toBeGreaterThan(0) // camera moves right
  })

  it('pans up when face is above center', () => {
    const landmarks = [
      { x: 0.4, y: 0.3 },
      { x: 0.5, y: 0.3 }, // nose tip above center (y=0.3 < 0.5)
    ]
    const result = computeFacePositionOffset(landmarks, defaultDist, defaultFov, defaultAr)
    expect(result).not.toBeNull()
    expect(result!.offsetY).toBeGreaterThan(0) // camera goes up (positive Y)
  })

  it('respects panScale of 0 — no offset', () => {
    const landmarks = [
      { x: 0.4, y: 0.3 },
      { x: 0.8, y: 0.2 }, // way off center
    ]
    const result = computeFacePositionOffset(landmarks, defaultDist, defaultFov, defaultAr, 0)
    expect(result).not.toBeNull()
    expect(result!.offsetX).toBeCloseTo(0, 3)
    expect(result!.offsetY).toBeCloseTo(0, 3)
  })

  it('scales offset with panScale', () => {
    const landmarks = [
      { x: 0.4, y: 0.3 },
      { x: 0.7, y: 0.5 },
    ]
    const result1 = computeFacePositionOffset(landmarks, defaultDist, defaultFov, defaultAr, 1.0)
    const result2 = computeFacePositionOffset(landmarks, defaultDist, defaultFov, defaultAr, 0.5)
    expect(result2!.offsetX).toBeCloseTo(result1!.offsetX * 0.5, 3)
  })

  it('larger camera distance produces larger world-space offset', () => {
    const landmarks = [
      { x: 0.4, y: 0.3 },
      { x: 0.7, y: 0.5 },
    ]
    const near = computeFacePositionOffset(landmarks, 2.0, defaultFov, defaultAr)
    const far = computeFacePositionOffset(landmarks, 5.0, defaultFov, defaultAr)
    // Farther camera = larger visible area = larger offset for same normalized movement
    expect(Math.abs(far!.offsetX)).toBeGreaterThan(Math.abs(near!.offsetX))
  })
})

// ─── computeHipPositionOffset ───────────────────────────────────────────

describe('computeHipPositionOffset', () => {
  it('returns null for fewer than 25 landmarks', () => {
    expect(computeHipPositionOffset([], { baseY: 0, scaleX: 1, scaleY: 1 })).toBeNull()
    expect(computeHipPositionOffset([{ x: 0, y: 0, z: 0 }], { baseY: 0, scaleX: 1, scaleY: 1 })).toBeNull()
  })

  it('computes hip center from left and right hips', () => {
    const landmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i === 23 ? -0.2 : i === 24 ? 0.2 : 0,
      y: i === 23 ? 0.8 : i === 24 ? 0.8 : 0,
      z: 0,
      visibility: 0.9,
    }))
    const result = computeHipPositionOffset(landmarks, { baseY: 0, scaleX: 1, scaleY: 1 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(0, 3)  // (-0.2 + 0.2) / 2 = 0
    expect(result!.y).toBeCloseTo(0.8, 3) // baseY + 0.8 * 1.0
  })

  it('respects scale factors', () => {
    const landmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i === 23 ? -0.3 : i === 24 ? 0.3 : 0,
      y: i === 23 ? 0.5 : i === 24 ? 0.5 : 0,
      z: 0,
      visibility: 0.9,
    }))
    const result = computeHipPositionOffset(landmarks, { baseY: -0.1, scaleX: 0.5, scaleY: 0.8 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(0, 3)      // 0 * 0.5 = 0
    expect(result!.y).toBeCloseTo(0.3, 3)     // -0.1 + 0.5 * 0.8 = 0.3
  })

  it('returns null when hip visibility is too low', () => {
    const landmarks = Array.from({ length: 33 }, (_, i) => ({
      x: 0, y: 0, z: 0,
      visibility: i === 23 ? 0.2 : i === 24 ? 0.1 : 0.9,
    }))
    expect(computeHipPositionOffset(landmarks, { baseY: 0, scaleX: 1, scaleY: 1 })).toBeNull()
  })
})

// ─── faceAreaToDepthScale ────────────────────────────────────────────────

describe('faceAreaToDepthScale', () => {
  it('returns 1.0 for empty landmarks', () => {
    expect(faceAreaToDepthScale([])).toBe(1.0)
  })

  it('returns 1.0 when face area matches reference', () => {
    const landmarks = [
      { x: 0.3, y: 0.3 },
      { x: 0.7, y: 0.8 },
    ]
    // area = (0.7-0.3) * (0.8-0.3) = 0.4 * 0.5 = 0.2
    const result = faceAreaToDepthScale(landmarks, 0.2)
    expect(result).toBeCloseTo(1.0, 3)
  })

  it('returns > 1.0 for small face (further away)', () => {
    const smallFace = [
      { x: 0.45, y: 0.45 },
      { x: 0.55, y: 0.55 },
    ]
    // area = 0.1 * 0.1 = 0.01, which is smaller than reference 0.08
    const result = faceAreaToDepthScale(smallFace, 0.08)
    expect(result).toBeGreaterThan(1.0)
  })

  it('returns < 1.0 for large face (closer)', () => {
    const largeFace = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]
    // area = 0.8 * 0.8 = 0.64, which is larger than reference 0.08
    const result = faceAreaToDepthScale(largeFace, 0.08)
    expect(result).toBeLessThan(1.0)
  })
})
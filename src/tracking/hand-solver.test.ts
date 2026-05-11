import { describe, it, expect } from 'vitest'
import {
  solveHandFingers,
  solveHands,
  ZERO_FINGER,
} from './hand-solver'

// ─── Utilities ─────────────────────────────────────────────────────────────

/** Create a simple landmark at (x, y, z) */
function lm(x: number, y: number, z: number, visibility = 1.0) {
  return { x, y, z, visibility }
}

/** Create a flat hand (all joints straightened) — wrist at origin, fingers extending upward */
function flatHandLandmarks(): Array<{ x: number; y: number; z: number; visibility: number }> {
  const landmarks: Array<{ x: number; y: number; z: number; visibility: number }> = []

  // 0: WRIST — at origin
  landmarks.push(lm(0.5, 0.7, 0))

  // THUMB: 1-4 — extends to the left and slightly up
  landmarks.push(lm(0.38, 0.65, 0))  // 1: THUMB_CMC
  landmarks.push(lm(0.30, 0.58, 0))  // 2: THUMB_MCP
  landmarks.push(lm(0.22, 0.52, 0))  // 3: THUMB_IP
  landmarks.push(lm(0.15, 0.48, 0))  // 4: THUMB_TIP

  // INDEX: 5-8 — extends straight up
  landmarks.push(lm(0.36, 0.55, 0))  // 5: INDEX_MCP
  landmarks.push(lm(0.36, 0.45, 0))  // 6: INDEX_PIP
  landmarks.push(lm(0.36, 0.37, 0))  // 7: INDEX_DIP
  landmarks.push(lm(0.36, 0.30, 0))  // 8: INDEX_TIP

  // MIDDLE: 9-12 — extends straight up
  landmarks.push(lm(0.44, 0.53, 0))  // 9: MIDDLE_MCP
  landmarks.push(lm(0.44, 0.42, 0))  // 10: MIDDLE_PIP
  landmarks.push(lm(0.44, 0.33, 0))  // 11: MIDDLE_DIP
  landmarks.push(lm(0.44, 0.26, 0))  // 12: MIDDLE_TIP

  // RING: 13-16 — extends straight up
  landmarks.push(lm(0.52, 0.55, 0))  // 13: RING_MCP
  landmarks.push(lm(0.52, 0.45, 0))  // 14: RING_PIP
  landmarks.push(lm(0.52, 0.37, 0))  // 15: RING_DIP
  landmarks.push(lm(0.52, 0.30, 0))  // 16: RING_TIP

  // PINKY: 17-20 — extends straight up
  landmarks.push(lm(0.59, 0.58, 0))  // 17: PINKY_MCP
  landmarks.push(lm(0.59, 0.50, 0))  // 18: PINKY_PIP
  landmarks.push(lm(0.59, 0.43, 0))  // 19: PINKY_DIP
  landmarks.push(lm(0.59, 0.37, 0))  // 20: PINKY_TIP

  return landmarks
}

/** Create a fist (all fingers curled) — tips near wrist */
function fistLandmarks(): Array<{ x: number; y: number; z: number; visibility: number }> {
  const landmarks: Array<{ x: number; y: number; z: number; visibility: number }> = []

  // 0: WRIST
  landmarks.push(lm(0.5, 0.7, 0))

  // THUMB: curled across palm
  landmarks.push(lm(0.40, 0.63, 0.02))  // 1: THUMB_CMC
  landmarks.push(lm(0.38, 0.55, 0.04))  // 2: THUMB_MCP
  landmarks.push(lm(0.42, 0.50, 0.06))  // 3: THUMB_IP
  landmarks.push(lm(0.46, 0.48, 0.08))  // 4: THUMB_TIP

  // INDEX: curled — tip near MCP level
  landmarks.push(lm(0.38, 0.55, 0.05))  // 5: INDEX_MCP
  landmarks.push(lm(0.37, 0.50, 0.08))  // 6: INDEX_PIP
  landmarks.push(lm(0.38, 0.52, 0.10))  // 7: INDEX_DIP
  landmarks.push(lm(0.39, 0.55, 0.12))  // 8: INDEX_TIP

  // MIDDLE: curled
  landmarks.push(lm(0.46, 0.53, 0.04))  // 9: MIDDLE_MCP
  landmarks.push(lm(0.45, 0.48, 0.07))  // 10: MIDDLE_PIP
  landmarks.push(lm(0.46, 0.50, 0.09))  // 11: MIDDLE_DIP
  landmarks.push(lm(0.47, 0.53, 0.11))  // 12: MIDDLE_TIP

  // RING: curled
  landmarks.push(lm(0.54, 0.55, 0.04))  // 13: RING_MCP
  landmarks.push(lm(0.53, 0.50, 0.07))  // 14: RING_PIP
  landmarks.push(lm(0.54, 0.52, 0.09))  // 15: RING_DIP
  landmarks.push(lm(0.55, 0.55, 0.11))  // 16: RING_TIP

  // PINKY: curled
  landmarks.push(lm(0.60, 0.58, 0.04))  // 17: PINKY_MCP
  landmarks.push(lm(0.59, 0.54, 0.07))  // 18: PINKY_PIP
  landmarks.push(lm(0.60, 0.56, 0.09))  // 19: PINKY_DIP
  landmarks.push(lm(0.61, 0.59, 0.11))  // 20: PINKY_TIP

  return landmarks
}

// ─── solveHandFingers ──────────────────────────────────────────────────────

describe('solveHandFingers', () => {
  it('returns zero rotations for empty landmarks', () => {
    const result = solveHandFingers([])
    expect(result).toEqual(ZERO_FINGER)
  })

  it('returns zero rotations for fewer than 21 landmarks', () => {
    const result = solveHandFingers([lm(0.5, 0.5, 0)])
    expect(result).toEqual(ZERO_FINGER)
  })

  it('returns small curl angles for a flat/open hand', () => {
    const result = solveHandFingers(flatHandLandmarks())

    // Flat hand should have near-zero curl (joints nearly straight)
    expect(Math.abs(result.indexProximal.x)).toBeLessThan(1.0)
    expect(Math.abs(result.indexIntermediate.x)).toBeLessThan(1.0)
    expect(Math.abs(result.middleProximal.x)).toBeLessThan(1.0)
    expect(Math.abs(result.ringProximal.x)).toBeLessThan(1.0)
    expect(Math.abs(result.littleProximal.x)).toBeLessThan(1.0)
  })

  it('returns larger curl angles for a fist', () => {
    const result = solveHandFingers(fistLandmarks())

    // Fist should have significant curl angles
    expect(result.indexProximal.x).toBeGreaterThan(0)
    expect(result.middleProximal.x).toBeGreaterThan(0)
    expect(result.indexIntermediate.x).toBeGreaterThan(0)
  })

  it('produces rotation values for all 15 finger bones', () => {
    const result = solveHandFingers(flatHandLandmarks())

    // All 15 bones should have values (not undefined)
    const bones = [
      'thumbProximal', 'thumbIntermediate', 'thumbDistal',
      'indexProximal', 'indexIntermediate', 'indexDistal',
      'middleProximal', 'middleIntermediate', 'middleDistal',
      'ringProximal', 'ringIntermediate', 'ringDistal',
      'littleProximal', 'littleIntermediate', 'littleDistal',
    ] as const

    for (const bone of bones) {
      expect(result[bone]).toBeDefined()
      expect(result[bone].x).toBeTypeOf('number')
      expect(result[bone].y).toBeTypeOf('number')
      expect(result[bone].z).toBeTypeOf('number')
    }
  })
})

// ─── solveHands ────────────────────────────────────────────────────────────

describe('solveHands', () => {
  it('returns zero rotations when no hands detected', () => {
    const result = solveHands([], [])
    expect(result.left).toEqual(ZERO_FINGER)
    expect(result.right).toEqual(ZERO_FINGER)
  })

  it('maps "Left" handedness to left hand', () => {
    const landmarks = [flatHandLandmarks()]
    const handedness = [{ category: 'Left', score: 0.9 }]

    const result = solveHands(landmarks, handedness)

    // Left hand should have computed values
    expect(result.left.indexProximal.x).not.toBe(0)
    // Right hand should still be zero
    expect(result.right).toEqual(ZERO_FINGER)
  })

  it('maps "Right" handedness to right hand', () => {
    const landmarks = [flatHandLandmarks()]
    const handedness = [{ category: 'Right', score: 0.9 }]

    const result = solveHands(landmarks, handedness)

    // Right hand should have computed values
    expect(result.right.indexProximal.x).not.toBe(0)
    // Left hand should still be zero
    expect(result.left).toEqual(ZERO_FINGER)
  })

  it('handles two hands simultaneously', () => {
    const landmarks = [flatHandLandmarks(), flatHandLandmarks()]
    const handedness = [
      { category: 'Left', score: 0.9 },
      { category: 'Right', score: 0.9 },
    ]

    const result = solveHands(landmarks, handedness)

    // Both hands should have computed values
    expect(result.left.indexProximal.x).not.toBe(0)
    expect(result.right.indexProximal.x).not.toBe(0)
  })

  it('does not crash with mismatched landmarks/handedness arrays', () => {
    // MediaPipe might give landmarks without handedness in edge cases
    const landmarks = [flatHandLandmarks()]
    const handedness: Array<{ category: string; score: number }> = []

    // Should not crash, defaults to Right
    const result = solveHands(landmarks, handedness)
    expect(result.right.indexProximal.x).not.toBe(0)
  })
})
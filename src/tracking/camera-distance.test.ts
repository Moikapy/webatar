import { describe, it, expect } from 'vitest'
import { computeCameraDistance, smoothCameraDistance } from './camera-distance'

describe('computeCameraDistance', () => {
  it('returns default distance when face is not detected (empty landmarks)', () => {
    const result = computeCameraDistance([], { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })
    expect(result).toBe(2.5)
  })

  it('returns closer distance when face is larger (closer to camera)', () => {
    // Large face bounding box = close to camera
    const largeFace = [
      { x: 0.2, y: 0.1, z: 0 },  // forehead
      { x: 0.8, y: 0.9, z: 0 },  // chin
      { x: 0.5, y: 0.5, z: 0 },  // nose
    ]
    // Small face bounding box = far from camera
    const smallFace = [
      { x: 0.4, y: 0.35, z: 0 },
      { x: 0.6, y: 0.65, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
    ]

    const closeResult = computeCameraDistance(largeFace, { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })
    const farResult = computeCameraDistance(smallFace, { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })

    expect(closeResult).toBeLessThan(farResult)
  })

  it('clamps distance to minDistance', () => {
    // Very large face = very close
    const hugeFace = [
      { x: 0.0, y: -0.5, z: 0 },
      { x: 1.0, y: 1.5, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
    ]
    const result = computeCameraDistance(hugeFace, { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })
    expect(result).toBeGreaterThanOrEqual(1.0)
  })

  it('clamps distance to maxDistance', () => {
    // Very small face = very far
    const tinyFace = [
      { x: 0.49, y: 0.49, z: 0 },
      { x: 0.51, y: 0.51, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
    ]
    const result = computeCameraDistance(tinyFace, { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })
    expect(result).toBeLessThanOrEqual(5.0)
  })

  it('uses z-depth of nose tip when available', () => {
    // In MediaPipe, more negative z = closer to camera
    // z=-0.5 = closer, z=-0.1 = further
    const closeNose = [
      { x: 0.4, y: 0.35, z: 0, visibility: 1 },
      { x: 0.6, y: 0.65, z: 0, visibility: 1 },
      { x: 0.5, y: 0.5, z: -0.5, visibility: 1 },  // z=-0.5 = closer to camera
    ]
    const farNose = [
      { x: 0.4, y: 0.35, z: 0, visibility: 1 },
      { x: 0.6, y: 0.65, z: 0, visibility: 1 },
      { x: 0.5, y: 0.5, z: -0.1, visibility: 1 },  // z=-0.1 = further from camera
    ]

    const closeResult = computeCameraDistance(closeNose, { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })
    const farResult = computeCameraDistance(farNose, { defaultDistance: 2.5, minDistance: 1.0, maxDistance: 5.0 })

    // Close nose should give a SMALLER distance (avatar appears closer)
    expect(closeResult).toBeLessThan(farResult)
  })
})

describe('smoothCameraDistance', () => {
  it('returns current when previous is null', () => {
    const result = smoothCameraDistance(null, 2.5, 0.3)
    expect(result).toBe(2.5)
  })

  it('smooths toward current from previous', () => {
    const result = smoothCameraDistance(3.0, 2.0, 0.3)
    // 3.0 + (2.0 - 3.0) * 0.3 = 3.0 - 0.3 = 2.7
    expect(result).toBeCloseTo(2.7, 5)
  })

  it('with factor=0 returns previous (frozen)', () => {
    const result = smoothCameraDistance(3.0, 5.0, 0)
    expect(result).toBe(3.0)
  })

  it('with factor=1 returns current (instant)', () => {
    const result = smoothCameraDistance(3.0, 5.0, 1)
    expect(result).toBe(5.0)
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FaceTracker } from './face-tracker'

// Mock MediaPipe FaceLandmarker
const mockDetectForVideo = vi.fn().mockReturnValue({
  faceBlendshapes: [[
    { categoryName: 'eyeBlinkLeft', score: 0.8 },
    { categoryName: 'eyeBlinkRight', score: 0.8 },
    { categoryName: 'jawOpen', score: 0.5 },
    { categoryName: 'mouthSmileLeft', score: 0.6 },
    { categoryName: 'mouthSmileRight', score: 0.6 },
  ]],
  faceLandmarks: [[
    { x: 0.5, y: 0.4, z: 0, visibility: 1 },  // nose tip
    { x: 0.5, y: 0.3, z: 0, visibility: 1 },   // forehead
    { x: 0.5, y: 0.8, z: 0, visibility: 1 },   // chin
  ]],
})

const mockFaceLandmarker = {
  detectForVideo: mockDetectForVideo,
  setOptions: vi.fn(),
  close: vi.fn(),
}

// Mock the MediaPipe module
vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue(mockFaceLandmarker),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue('/fake/wasm/path'),
  },
}))

describe('FaceTracker', () => {
  let tracker: FaceTracker

  beforeEach(() => {
    vi.clearAllMocks()
    tracker = new FaceTracker()
  })

  describe('initialization', () => {
    it('creates a FaceTracker instance', () => {
      expect(tracker).toBeDefined()
    })

    it('starts in idle state', () => {
      expect(tracker.state).toBe('idle')
    })

    it('has no results before tracking starts', () => {
      expect(tracker.lastResult).toBeNull()
    })
  })

  describe('init', () => {
    it('transitions from idle to ready after successful init', async () => {
      await tracker.init()
      expect(tracker.state).toBe('ready')
    })

    it('transitions to error if MediaPipe fails to load', async () => {
      // Create a tracker that will fail on init
      // We need to re-mock the module for this test
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision') as unknown as { FaceLandmarker: { createFromOptions: ReturnType<typeof vi.fn> } }
      ;(FaceLandmarker.createFromOptions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('WASM load failed'))

      const errorTracker = new FaceTracker()
      try {
        await errorTracker.init()
      } catch {
        // Expected to throw
      }
      expect(errorTracker.state).toBe('error')
    })
  })

  describe('startTracking / stopTracking', () => {
    it('transitions to tracking when started after init', async () => {
      await tracker.init()
      tracker.startTracking()
      expect(tracker.state).toBe('tracking')
    })

    it('transitions to stopped when stopped', async () => {
      await tracker.init()
      tracker.startTracking()
      tracker.stopTracking()
      expect(tracker.state).toBe('stopped')
    })

    it('does not start tracking if not initialized', () => {
      expect(() => tracker.startTracking()).not.toThrow()
      expect(tracker.state).toBe('idle')
    })
  })

  describe('processResults', () => {
    it('extracts blend shapes as a name→weight map', () => {
      const blendShapes = [
        { categoryName: 'eyeBlinkLeft', score: 0.8 },
        { categoryName: 'jawOpen', score: 0.5 },
        { categoryName: 'mouthSmileLeft', score: 0.0 }, // zero = omitted
      ]

      const result = tracker.extractBlendShapes(blendShapes)

      expect(result.eyeBlinkLeft).toBe(0.8)
      expect(result.jawOpen).toBe(0.5)
      expect(result).not.toHaveProperty('mouthSmileLeft') // zero filtered
    })

    it('returns empty object for null blend shapes', () => {
      const result = tracker.extractBlendShapes(null)
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('returns empty object for empty array', () => {
      const result = tracker.extractBlendShapes([])
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('extracts head rotation from face landmarks', () => {
      const landmarks = Array.from({ length: 478 }, () => ({
        x: 0.5, y: 0.5, z: 0, visibility: 1,
      }))

      // Set specific landmarks for head rotation
      landmarks[10] = { x: 0.5, y: 0.3, z: 0, visibility: 1 }  // forehead
      landmarks[152] = { x: 0.5, y: 0.8, z: 0, visibility: 1 }  // chin
      landmarks[1] = { x: 0.5, y: 0.55, z: 0, visibility: 1 }   // nose
      landmarks[234] = { x: 0.25, y: 0.5, z: 0, visibility: 1 }  // left ear
      landmarks[454] = { x: 0.75, y: 0.5, z: 0, visibility: 1 }  // right ear

      const rotation = tracker.extractHeadRotation(landmarks)

      expect(rotation).toHaveProperty('x')
      expect(rotation).toHaveProperty('y')
      expect(rotation).toHaveProperty('z')
      // Forward-facing head should have near-zero rotation
      expect(Math.abs(rotation.y)).toBeLessThan(0.2)
    })

    it('returns zero rotation for empty landmarks', () => {
      const rotation = tracker.extractHeadRotation([])
      expect(rotation.x).toBe(0)
      expect(rotation.y).toBe(0)
      expect(rotation.z).toBe(0)
    })
  })

  describe('state transitions', () => {
    it('follows lifecycle: idle → ready → tracking → stopped', async () => {
      expect(tracker.state).toBe('idle')

      await tracker.init()
      expect(tracker.state).toBe('ready')

      tracker.startTracking()
      expect(tracker.state).toBe('tracking')

      tracker.stopTracking()
      expect(tracker.state).toBe('stopped')
    })
  })

  describe('destroy', () => {
    it('cleans up resources', async () => {
      await tracker.init()
      tracker.startTracking()
      tracker.destroy()
      expect(tracker.state).toBe('destroyed')
    })
  })
})
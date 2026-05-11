import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PoseTracker } from './pose-tracker'

// Mock MediaPipe PoseLandmarker — factory must be self-contained (hoisted)
vi.mock('@mediapipe/tasks-vision', () => ({
  PoseLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue({
      detectForVideo: vi.fn().mockReturnValue({
        landmarks: [[
          { x: 0.5, y: 0.3, z: 0, visibility: 0.99 },
          { x: 0.4, y: 0.5, z: 0, visibility: 0.99 },
          { x: 0.6, y: 0.5, z: 0, visibility: 0.99 },
        ]],
        worldLandmarks: [[
          { x: 0, y: 0, z: 0, visibility: 0.99 },
          { x: -0.2, y: -0.1, z: 0, visibility: 0.99 },
          { x: 0.2, y: -0.1, z: 0, visibility: 0.99 },
        ]],
      }),
      setOptions: vi.fn(),
      close: vi.fn(),
    }),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue('/fake/wasm/path'),
  },
}))

describe('PoseTracker', () => {
  let tracker: PoseTracker

  beforeEach(() => {
    vi.clearAllMocks()
    tracker = new PoseTracker()
  })

  describe('initialization', () => {
    it('creates a PoseTracker instance', () => {
      expect(tracker).toBeDefined()
    })

    it('starts in idle state', () => {
      expect(tracker.state).toBe('idle')
    })

    it('has no results before tracking starts', () => {
      expect(tracker.lastResult).toBeNull()
    })
  })

  describe('lifecycle', () => {
    it('transitions from idle to ready after init', async () => {
      await tracker.init()
      expect(tracker.state).toBe('ready')
    })

    it('transitions to tracking after startTracking', async () => {
      await tracker.init()
      tracker.startTracking()
      expect(tracker.state).toBe('tracking')
    })

    it('transitions to stopped after stopTracking', async () => {
      await tracker.init()
      tracker.startTracking()
      tracker.stopTracking()
      expect(tracker.state).toBe('stopped')
    })

    it('transitions to destroyed after destroy', async () => {
      await tracker.init()
      tracker.startTracking()
      tracker.destroy()
      expect(tracker.state).toBe('destroyed')
    })

    it('does not start tracking if not initialized', () => {
      expect(() => tracker.startTracking()).not.toThrow()
      expect(tracker.state).toBe('idle')
    })
  })

  describe('processFrame', () => {
    it('returns null when not tracking', () => {
      const video = document.createElement('video')
      const result = tracker.processFrame(video, performance.now())
      expect(result).toBeNull()
    })

    it('returns pose data when tracking and pose is detected', async () => {
      await tracker.init()
      tracker.startTracking()

      const video = document.createElement('video')
      const result = tracker.processFrame(video, performance.now())

      expect(result).not.toBeNull()
      expect(result!.poseDetected).toBe(true)
      expect(result!.landmarks.length).toBeGreaterThan(0)
    })

    it('returns poseDetected false when no pose is detected', async () => {
      // Override mock to return empty results
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision') as unknown as { PoseLandmarker: { createFromOptions: ReturnType<typeof vi.fn> } }
      ;(PoseLandmarker.createFromOptions as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        detectForVideo: vi.fn().mockReturnValueOnce({
          landmarks: [],
          worldLandmarks: [],
        }),
        setOptions: vi.fn(),
        close: vi.fn(),
      })

      const freshTracker = new PoseTracker()
      await freshTracker.init()
      freshTracker.startTracking()

      const video = document.createElement('video')
      const result = freshTracker.processFrame(video, performance.now())

      expect(result).not.toBeNull()
      expect(result!.poseDetected).toBe(false)
      expect(result!.landmarks).toHaveLength(0)
    })

    it('returns last result for non-increasing timestamps', async () => {
      await tracker.init()
      tracker.startTracking()

      const video = document.createElement('video')
      const result1 = tracker.processFrame(video, 1000)
      const result2 = tracker.processFrame(video, 999) // decreasing timestamp

      expect(result2).toBe(result1) // same reference, not re-processed
    })
  })
})
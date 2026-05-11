import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebatarEngine } from './WebatarEngine'

// Mock canvas for test environment (jsdom doesn't have canvas context)
function createMockCanvas(): HTMLCanvasElement {
  return { tagName: 'CANVAS' } as unknown as HTMLCanvasElement
}

describe('WebatarEngine', () => {
  let engine: WebatarEngine
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = createMockCanvas()
    engine = new WebatarEngine({
      canvas,
      enablePoseTracking: false,
      expressionSmoothing: 0.6,
      headSmoothing: 0.5,
    })
  })

  describe('construction', () => {
    it('creates engine with default config', () => {
      const state = engine.currentState
      expect(state.status).toBe('idle')
      expect(state.currentAvatarId).toBeNull()
      expect(state.faceDetected).toBe(false)
      expect(state.error).toBeNull()
    })

    it('creates engine with custom smoothing', () => {
      const e = new WebatarEngine({ canvas, expressionSmoothing: 0.5, headSmoothing: 0.5 })
      expect(e.currentState.status).toBe('idle')
    })
  })

  describe('state management', () => {
    it('notifies listeners on state change', () => {
      const listener = vi.fn()
      engine.onStateChange(listener)

      engine.start()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'tracking' }),
      )
    })

    it('returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = engine.onStateChange(listener)

      unsubscribe()
      engine.start()

      expect(listener).not.toHaveBeenCalled()
    })

    it('returns a copy of state (not reference)', () => {
      const state1 = engine.currentState
      const state2 = engine.currentState
      expect(state1).not.toBe(state2)
      expect(state1).toEqual(state2)
    })
  })

  describe('lifecycle', () => {
    it('transitions from idle to tracking on start', () => {
      engine.start()
      expect(engine.currentState.status).toBe('tracking')
    })

    it('transitions to stopped on stop', () => {
      engine.start()
      engine.stop()
      expect(engine.currentState.status).toBe('stopped')
    })

    it('does not double-start', () => {
      engine.start()
      engine.start()
      expect(engine.currentState.status).toBe('tracking')
    })

    it('cleans up on destroy', () => {
      engine.start()
      engine.destroy()
      expect(engine.currentState.status).toBe('stopped')
    })
  })

  describe('processFaceFrame', () => {
    it('does not crash with no expression manager', () => {
      expect(() =>
        engine.processFaceFrame({ jawOpen: 0.5 }),
      ).not.toThrow()
    })

    it('updates faceDetected to true', () => {
      const listener = vi.fn()
      engine.onStateChange(listener)

      engine.processFaceFrame({ jawOpen: 0.5 })

      expect(engine.currentState.faceDetected).toBe(true)
    })
  })

  describe('processHeadRotation', () => {
    it('does not crash with no humanoid', () => {
      expect(() =>
        engine.processHeadRotation({ x: 0.1, y: 0.2, z: 0 }),
      ).not.toThrow()
    })
  })

  describe('processFaceLost', () => {
    it('resets face detected state', () => {
      engine.processFaceFrame({ jawOpen: 0.5 })
      engine.processFaceLost()

      expect(engine.currentState.faceDetected).toBe(false)
    })
  })

  describe('FPS tracking', () => {
    it('tracks FPS', () => {
      engine.start()
      engine.updateFps()
      expect(engine.currentState.fps).toBe(0) // Not enough time elapsed yet
    })
  })
})
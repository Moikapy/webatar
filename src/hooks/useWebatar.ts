/**
 * useWebatar — React hook that orchestrates the full webcam→VRM pipeline.
 *
 * Manages:
 *   - Camera permission + stream
 *   - MediaPipe FaceTracker initialization
 *   - Three.js VRMLoader (scene + renderer)
 *   - VRM model loading
 *   - Animation loop (face tracking @ 30fps + rendering @ 60fps)
 *   - Expression + head rotation application to VRM
 *
 * All browser-only code. Unit tested via Playwright integration tests.
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { FaceTracker } from '../tracking/face-tracker'
import { WebatarEngine } from '../engine/WebatarEngine'
import { VRMLoader } from '../vrm/loader'
import { requestCameraPermission, stopStream } from '../utils/permissions'
import type { WebatarState } from '../engine/WebatarEngine'

export interface UseWebatarReturn {
  state: WebatarState
  isReady: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
  destroy: () => void
}

export function useWebatar(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  vrmUrl: string | undefined = undefined,
): UseWebatarReturn {
  const [uiState, setUiState] = useState<WebatarState>({
    status: 'idle',
    currentAvatarId: null,
    faceDetected: false,
    fps: 0,
    trackingQuality: 0,
    error: null,
  })
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mutable refs for engine instances (don't trigger re-renders)
  const trackerRef = useRef<FaceTracker | null>(null)
  const engineRef = useRef<WebatarEngine | null>(null)
  const loaderRef = useRef<VRMLoader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRunningRef = useRef(false)

  // ─── Cleanup ──────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    isRunningRef.current = false

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      stopStream(streamRef.current)
      streamRef.current = null
    }
    if (loaderRef.current) {
      loaderRef.current.destroy()
      loaderRef.current = null
    }
    if (trackerRef.current) {
      trackerRef.current.destroy()
      trackerRef.current = null
    }
    if (engineRef.current) {
      engineRef.current.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  // ─── Start ────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) {
      setError('Canvas or video element not found')
      return
    }

    setIsReady(false)
    setError(null)

    try {
      // 1. Request camera
      const stream = await requestCameraPermission({
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      streamRef.current = stream
      video.srcObject = stream
      await video.play()

      // 2. Create FaceTracker
      const tracker = new FaceTracker()
      trackerRef.current = tracker
      await tracker.init()

      // 3. Create WebatarEngine
      const engine = new WebatarEngine({
        canvas,
        video,
        enablePoseTracking: true,
        smoothingFactor: 0.35,
      })
      engineRef.current = engine
      await engine.init()
      engine.start()

      engine.onStateChange((state) => {
        setUiState({ ...state })
      })

      // 4. Create VRMLoader and load VRM (if URL provided)
      if (!vrmUrl) {
        setError('No avatar selected. Pick one from the gallery.')
        cleanup()
        return
      }

      const loader = new VRMLoader(canvas)
      loaderRef.current = loader
      const vrm = await loader.load(vrmUrl)

      // Wire VRM into engine
      const vrmAny = vrm as any
      console.log('[useWebatar] VRM loaded:', {
        hasExpressionManager: !!vrmAny.expressionManager,
        hasHumanoid: !!vrmAny.humanoid,
        hasScene: !!vrmAny.scene,
      })
      engine.setVRM({
        expressionManager: vrmAny.expressionManager ?? null,
        humanoid: vrmAny.humanoid ?? null,
      })

      setIsReady(true)

      // 5. Start tracking loop at ~30fps
      isRunningRef.current = true
      let trackingFrameCount = 0
      intervalRef.current = setInterval(() => {
        if (!isRunningRef.current) return
        if (!video.readyState || video.paused) return

        const now = performance.now()
        const results = tracker.processFrame(video, now)
        if (results) {
          engine.processFaceFrame(results.blendShapes)
          engine.processHeadRotation(results.headRotation)
          trackingFrameCount++
          if (trackingFrameCount === 1) {
            console.log('[useWebatar] First tracking frame received', {
              faceDetected: results.faceDetected,
              blendShapeCount: Object.keys(results.blendShapes).length,
              headRotation: results.headRotation,
            })
          }
        } else {
          engine.processFaceLost()
        }
        engine.updateFps()
      }, 33) // ~30fps
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start'
      setError(msg)
      cleanup()
    }
  }, [canvasRef, videoRef, vrmUrl, cleanup])

  // ─── Stop ─────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    isRunningRef.current = false

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      stopStream(streamRef.current)
      streamRef.current = null
    }
    if (engineRef.current) {
      engineRef.current.stop()
    }
    if (trackerRef.current) {
      trackerRef.current.stopTracking()
    }
    // Keep the VRM loaded and renderer running for display
  }, [])

  // ─── Destroy ──────────────────────────────────────────────────────────

  const destroy = useCallback(() => {
    cleanup()
    setIsReady(false)
    setError(null)
    setUiState({
      status: 'idle',
      currentAvatarId: null,
      faceDetected: false,
      fps: 0,
      trackingQuality: 0,
      error: null,
    })
  }, [cleanup])

  return {
    state: uiState,
    isReady,
    error,
    start,
    stop,
    destroy,
  }
}
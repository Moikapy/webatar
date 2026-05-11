/**
 * useWebatar — React hook that orchestrates the full webcam→VRM pipeline.
 *
 * Manages:
 *   - Camera permission + stream
 *   - MediaPipe FaceTracker + PoseTracker initialization
 *   - Three.js VRMLoader (scene + renderer)
 *   - VRM model loading
 *   - Animation loop (face tracking @ 30fps, pose @ 15fps, rendering @ 60fps)
 *   - Expression + head rotation + pose bone application to VRM
 *   - Camera distance from face size (avatar moves closer/further)
 *
 * All browser-only code. Unit tested via Playwright integration tests.
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { FaceTracker } from '../tracking/face-tracker'
import { PoseTracker } from '../tracking/pose-tracker'
import { WebatarEngine } from '../engine/WebatarEngine'
import { VRMLoader } from '../vrm/loader'
import { applyIdlePose } from '../vrm/idle-pose'
import { rotateVRMBone } from '../vrm/bones'
import { solvePoseBones } from '../tracking/pose-solver'
import { computeCameraDistance, smoothCameraDistance } from '../tracking/camera-distance'
import { tuningConfig } from '../tracking/tuning-config'
import { requestCameraPermission, stopStream } from '../utils/permissions'
import type { WebatarState } from '../engine/WebatarEngine'
import type { BoneRotations } from '../tracking/pose-solver'

export interface UseWebatarReturn {
  state: WebatarState
  isReady: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
  destroy: () => void
  latestBlendShapes: Record<string, number>
  latestHeadRotation: { x: number; y: number; z: number }
  latestLandmarks: ReadonlyArray<{ x: number; y: number; z: number }>
}

/** Smoothing factor for pose bones — now via tuningConfig.poseSmoothing */
/** Smoothing factor for camera distance — now via tuningConfig.cameraDistanceSmoothing */
/** Pose tracking interval in ms (~15fps) */
const POSE_INTERVAL_MS = 66

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

  // Tracking data for overlay (updated per frame)
  const [latestBlendShapes, setLatestBlendShapes] = useState<Record<string, number>>({})
  const [latestHeadRotation, setLatestHeadRotation] = useState({ x: 0, y: 0, z: 0 })
  const [latestLandmarks, setLatestLandmarks] = useState<ReadonlyArray<{ x: number; y: number; z: number }>>([])

  // Mutable refs for engine instances (don't trigger re-renders)
  const trackerRef = useRef<FaceTracker | null>(null)
  const poseTrackerRef = useRef<PoseTracker | null>(null)
  const engineRef = useRef<WebatarEngine | null>(null)
  const loaderRef = useRef<VRMLoader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const poseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRunningRef = useRef(false)

  // Smoothed pose and camera distance (mutable refs for performance)
  const lastPoseBones = useRef<BoneRotations | null>(null)
  const smoothedCameraDistance = useRef<number | null>(null)

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
    if (poseIntervalRef.current !== null) {
      clearInterval(poseIntervalRef.current)
      poseIntervalRef.current = null
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
    if (poseTrackerRef.current) {
      poseTrackerRef.current.destroy()
      poseTrackerRef.current = null
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
      try {
        await video.play()
      } catch (playErr) {
        // "play() was interrupted by a new load request" is harmless
        // — the video is still ready, just the promise was aborted
        if (!video.paused) {
          // Video is actually playing, the error is just a race
          console.warn('[useWebatar] video.play() interrupted (harmless):', playErr)
        } else {
          throw playErr
        }
      }

      // 2. Create FaceTracker
      const tracker = new FaceTracker()
      trackerRef.current = tracker
      await tracker.init()
      tracker.startTracking()

      // 3. Create PoseTracker (runs at 15fps, separate from face tracking)
      const poseTracker = new PoseTracker()
      poseTrackerRef.current = poseTracker
      await poseTracker.init()
      poseTracker.startTracking()

      // 4. Create WebatarEngine
      const engine = new WebatarEngine({
        canvas,
        video,
        enablePoseTracking: true,
        expressionSmoothing: 0.6,
        headSmoothing: 0.5,
      })
      engineRef.current = engine
      await engine.init()
      engine.start()

      engine.onStateChange((state) => {
        setUiState({ ...state })
      })

      // 5. Create VRMLoader and load VRM (if URL provided)
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

      // 6. Register afterUpdate callback for bone rotations
      //    VRM.update() normalizes bones to rest pose each frame,
      //    so we must re-apply idle pose + head rotation + pose bones AFTER it.
      loader.onAfterUpdate(() => {
        const h = engine.currentHumanoid
        if (!h) return

        // Re-apply idle pose (arms, hands, spine)
        applyIdlePose(h)

        // Re-apply latest head rotation on top
        const head = engine.currentHeadRotation
        if (head) {
          rotateVRMBone(h, 'head', {
            x: head.x * tuningConfig.headScale,
            y: head.y * tuningConfig.headScale,
            z: head.z * tuningConfig.headScale,
          })
          rotateVRMBone(h, 'neck', {
            x: head.x * tuningConfig.neckScale,
            y: head.y * tuningConfig.neckScale,
            z: head.z * tuningConfig.neckScale,
          })
        }

        // Apply pose bone rotations on top of idle pose
        const pose = lastPoseBones.current
        if (pose) {
          // Spine: blend with idle (override if tracking data is strong)
          rotateVRMBone(h, 'spine', {
            x: pose.spine.x * tuningConfig.spineScale,
            y: pose.spine.y * tuningConfig.spineScale,
            z: pose.spine.z * tuningConfig.spineScale,
          })
          rotateVRMBone(h, 'leftShoulder', {
            x: pose.leftShoulder.x * tuningConfig.shoulderScale,
            y: pose.leftShoulder.y * tuningConfig.shoulderScale,
            z: pose.leftShoulder.z * tuningConfig.shoulderScale,
          })
          rotateVRMBone(h, 'rightShoulder', {
            x: pose.rightShoulder.x * tuningConfig.shoulderScale,
            y: pose.rightShoulder.y * tuningConfig.shoulderScale,
            z: pose.rightShoulder.z * tuningConfig.shoulderScale,
          })
          rotateVRMBone(h, 'leftUpperArm', {
            x: pose.leftUpperArm.x * tuningConfig.upperArmScale,
            y: pose.leftUpperArm.y * tuningConfig.upperArmScale,
            z: pose.leftUpperArm.z * tuningConfig.upperArmScale,
          })
          rotateVRMBone(h, 'rightUpperArm', {
            x: pose.rightUpperArm.x * tuningConfig.upperArmScale,
            y: pose.rightUpperArm.y * tuningConfig.upperArmScale,
            z: pose.rightUpperArm.z * tuningConfig.upperArmScale,
          })
          rotateVRMBone(h, 'leftLowerArm', pose.leftLowerArm)
          rotateVRMBone(h, 'rightLowerArm', pose.rightLowerArm)
        }

        // Update camera distance based on face size
        const camDist = smoothedCameraDistance.current
        if (camDist !== null) {
          const camera = loaderRef.current?.camera
          if (camera) {
            camera.position.set(0, 1.3, camDist)
            camera.lookAt(0, 1.0, 0)
          }
        }
      })

      // 7. Start face tracking loop at ~30fps
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

          // Update overlay data
          setLatestBlendShapes(results.blendShapes)
          setLatestHeadRotation(results.headRotation)
          setLatestLandmarks(results.landmarks)

          // Update camera distance from face landmarks
          const rawDistance = computeCameraDistance(results.landmarks, {
            defaultDistance: tuningConfig.cameraDefaultDistance,
            minDistance: tuningConfig.cameraMinDistance,
            maxDistance: tuningConfig.cameraMaxDistance,
          })
          smoothedCameraDistance.current = smoothCameraDistance(
            smoothedCameraDistance.current,
            rawDistance,
            tuningConfig.cameraDistanceSmoothing,
          )

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
          setLatestBlendShapes({})
          setLatestLandmarks([])
        }
        engine.updateFps()
      }, 33) // ~30fps

      // 8. Start pose tracking loop at ~15fps
      poseIntervalRef.current = setInterval(() => {
        if (!isRunningRef.current) return
        if (!video.readyState || video.paused) return
        if (!poseTrackerRef.current) return

        const now = performance.now()
        const poseResult = poseTrackerRef.current.processFrame(video, now)

        if (poseResult && poseResult.poseDetected && poseResult.landmarks.length >= 25) {
          const poseBones = solvePoseBones(poseResult.landmarks, poseResult.worldLandmarks)
          if (poseBones) {
            // Smooth pose with previous frame
            if (lastPoseBones.current) {
              lastPoseBones.current = smoothPoseBones(lastPoseBones.current, poseBones, tuningConfig.poseSmoothing)
            } else {
              lastPoseBones.current = poseBones
            }
          }
        } else {
          // No pose detected — decay toward idle
          lastPoseBones.current = null
        }
      }, POSE_INTERVAL_MS) // ~15fps
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
    if (poseIntervalRef.current !== null) {
      clearInterval(poseIntervalRef.current)
      poseIntervalRef.current = null
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
    if (poseTrackerRef.current) {
      poseTrackerRef.current.stopTracking()
    }
  }, [])

  // ─── Destroy ──────────────────────────────────────────────────────────

  const destroy = useCallback(() => {
    cleanup()
    setIsReady(false)
    setError(null)
    setLatestBlendShapes({})
    setLatestHeadRotation({ x: 0, y: 0, z: 0 })
    setLatestLandmarks([])
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
    latestBlendShapes,
    latestHeadRotation,
    latestLandmarks,
  }
}

/**
 * Smooth pose bone rotations using EMA.
 * Each bone rotation component is interpolated independently.
 */
function smoothPoseBones(
  prev: BoneRotations,
  current: BoneRotations,
  factor: number,
): BoneRotations {
  return {
    head: lerpRotation(prev.head, current.head, factor),
    neck: lerpRotation(prev.neck, current.neck, factor),
    spine: lerpRotation(prev.spine, current.spine, factor),
    leftShoulder: lerpRotation(prev.leftShoulder, current.leftShoulder, factor),
    rightShoulder: lerpRotation(prev.rightShoulder, current.rightShoulder, factor),
    leftUpperArm: lerpRotation(prev.leftUpperArm, current.leftUpperArm, factor),
    rightUpperArm: lerpRotation(prev.rightUpperArm, current.rightUpperArm, factor),
    leftLowerArm: lerpRotation(prev.leftLowerArm, current.leftLowerArm, factor),
    rightLowerArm: lerpRotation(prev.rightLowerArm, current.rightLowerArm, factor),
  }
}

function lerpRotation(
  prev: { x: number; y: number; z: number },
  current: { x: number; y: number; z: number },
  factor: number,
): { x: number; y: number; z: number } {
  return {
    x: prev.x + (current.x - prev.x) * factor,
    y: prev.y + (current.y - prev.y) * factor,
    z: prev.z + (current.z - prev.z) * factor,
  }
}
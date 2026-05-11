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
import { HandTracker } from '../tracking/hand-tracker'
import { WebatarEngine } from '../engine/WebatarEngine'
import { VRMLoader } from '../vrm/loader'
import { applyIdlePose } from '../vrm/idle-pose'
import { rotateVRMBone } from '../vrm/bones'
import { solvePoseBones } from '../tracking/pose-solver'
import { solveHands, ZERO_FINGER } from '../tracking/hand-solver'
import type { HandRotations } from '../tracking/hand-solver'
import { computeCameraDistance, smoothCameraDistance } from '../tracking/camera-distance'
import { computeFacePositionOffset, computeHipPositionOffset } from '../tracking/auto-calibrate'
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
  setTransparentBg: (enabled: boolean) => void
  latestBlendShapes: Record<string, number>
  latestHeadRotation: { x: number; y: number; z: number }
  latestLandmarks: ReadonlyArray<{ x: number; y: number; z: number }>
  /** Show 3D debug markers in the scene (camera, hip, look-at) */
  setDebugScene: (enabled: boolean) => void
  /** Smoothed camera distance (for debug overlay) */
  smoothedCameraDistance: React.MutableRefObject<number | null>
  /** Smoothed face position offset (for debug overlay) */
  smoothedFaceOffset: React.MutableRefObject<{ offsetX: number; offsetY: number } | null>
  /** Smoothed hip position (for debug overlay) */
  smoothedHipPosition: React.MutableRefObject<{ x: number; y: number } | null>
}

/** Smoothing factor for pose bones — now via tuningConfig.poseSmoothing */
/** Smoothing factor for camera distance — now via tuningConfig.cameraDistanceSmoothing */
/** Pose tracking interval in ms (~15fps) */
const POSE_INTERVAL_MS = 66
/** Hand tracking interval in ms (~15fps) */
const HAND_INTERVAL_MS = 66

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
  const handTrackerRef = useRef<HandTracker | null>(null)
  const engineRef = useRef<WebatarEngine | null>(null)
  const loaderRef = useRef<VRMLoader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const poseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const handIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRunningRef = useRef(false)

  // Smoothed pose, camera distance, and hip position (mutable refs for performance)
  const lastPoseBones = useRef<BoneRotations | null>(null)
  const smoothedCameraDistance = useRef<number | null>(null)
  const smoothedHipPosition = useRef<{ x: number; y: number } | null>(null)
  const smoothedFaceOffset = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const lastHandRotations = useRef<HandRotations | null>(null)

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
    if (handIntervalRef.current !== null) {
      clearInterval(handIntervalRef.current)
      handIntervalRef.current = null
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
    if (handTrackerRef.current) {
      handTrackerRef.current.destroy()
      handTrackerRef.current = null
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

      // 4. Create HandTracker (runs at 15fps for finger tracking)
      const handTracker = new HandTracker()
      handTrackerRef.current = handTracker
      await handTracker.init()
      handTracker.startTracking()

      // 5. Create WebatarEngine
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

        // Apply finger rotations from hand tracking
        const hands = lastHandRotations.current
        if (hands) {
          // Left hand fingers
          rotateVRMBone(h, 'leftThumbProximal', hands.left.thumbProximal)
          rotateVRMBone(h, 'leftThumbIntermediate', hands.left.thumbIntermediate)
          rotateVRMBone(h, 'leftThumbDistal', hands.left.thumbDistal)
          rotateVRMBone(h, 'leftIndexProximal', hands.left.indexProximal)
          rotateVRMBone(h, 'leftIndexIntermediate', hands.left.indexIntermediate)
          rotateVRMBone(h, 'leftIndexDistal', hands.left.indexDistal)
          rotateVRMBone(h, 'leftMiddleProximal', hands.left.middleProximal)
          rotateVRMBone(h, 'leftMiddleIntermediate', hands.left.middleIntermediate)
          rotateVRMBone(h, 'leftMiddleDistal', hands.left.middleDistal)
          rotateVRMBone(h, 'leftRingProximal', hands.left.ringProximal)
          rotateVRMBone(h, 'leftRingIntermediate', hands.left.ringIntermediate)
          rotateVRMBone(h, 'leftRingDistal', hands.left.ringDistal)
          rotateVRMBone(h, 'leftLittleProximal', hands.left.littleProximal)
          rotateVRMBone(h, 'leftLittleIntermediate', hands.left.littleIntermediate)
          rotateVRMBone(h, 'leftLittleDistal', hands.left.littleDistal)
          // Right hand fingers
          rotateVRMBone(h, 'rightThumbProximal', hands.right.thumbProximal)
          rotateVRMBone(h, 'rightThumbIntermediate', hands.right.thumbIntermediate)
          rotateVRMBone(h, 'rightThumbDistal', hands.right.thumbDistal)
          rotateVRMBone(h, 'rightIndexProximal', hands.right.indexProximal)
          rotateVRMBone(h, 'rightIndexIntermediate', hands.right.indexIntermediate)
          rotateVRMBone(h, 'rightIndexDistal', hands.right.indexDistal)
          rotateVRMBone(h, 'rightMiddleProximal', hands.right.middleProximal)
          rotateVRMBone(h, 'rightMiddleIntermediate', hands.right.middleIntermediate)
          rotateVRMBone(h, 'rightMiddleDistal', hands.right.middleDistal)
          rotateVRMBone(h, 'rightRingProximal', hands.right.ringProximal)
          rotateVRMBone(h, 'rightRingIntermediate', hands.right.ringIntermediate)
          rotateVRMBone(h, 'rightRingDistal', hands.right.ringDistal)
          rotateVRMBone(h, 'rightLittleProximal', hands.right.littleProximal)
          rotateVRMBone(h, 'rightLittleIntermediate', hands.right.littleIntermediate)
          rotateVRMBone(h, 'rightLittleDistal', hands.right.littleDistal)
        }

        // Auto-calibrated camera: follows face position
        // The camera pans to keep the avatar's head aligned with where
        // the user's face is on the webcam. No manual tuning needed.
        const camDist = smoothedCameraDistance.current
        const faceOffset = smoothedFaceOffset.current
        const camera = loaderRef.current?.camera

        if (camDist !== null && camera) {
          // Camera position: center + face tracking pan offset
          const offsetX = faceOffset?.offsetX ?? 0
          const offsetY = faceOffset?.offsetY ?? 0
          camera.position.set(
            offsetX,
            tuningConfig.cameraY + offsetY,
            camDist,
          )
          // Look at avatar center, subtly tracking face direction
          camera.lookAt(offsetX * 0.3, tuningConfig.cameraLookAtY + offsetY * 0.3, 0)
        }

        // Apply model position (hip tracking + Y offset)
        const vrm = loaderRef.current?.currentVRM
        if (vrm) {
          const baseY = tuningConfig.modelYOffset
          const hipPos = smoothedHipPosition.current
          if (hipPos) {
            vrm.scene.position.x = hipPos.x
            vrm.scene.position.y = baseY + hipPos.y
          } else {
            vrm.scene.position.x = 0
            vrm.scene.position.y = baseY
          }
        }

        // Update debug markers in 3D scene
        if (loaderRef.current?.debugScene) {
          loaderRef.current.updateDebugScene({
            cameraDistance: smoothedCameraDistance.current,
            hipPosition: smoothedHipPosition.current,
            faceOffset: smoothedFaceOffset.current,
          })
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

          // Auto-calibrate: face position → camera pan
          // Nose tip position determines where the camera should look
          // so the avatar's head appears at the same screen position as the user's face
          const faceOffset = computeFacePositionOffset(
            results.landmarks,
            smoothedCameraDistance.current ?? tuningConfig.cameraDefaultDistance,
            undefined, // use default FOV (40°)
            undefined, // use default aspect ratio (16:9)
            tuningConfig.faceTrackScale,
          )
          if (faceOffset) {
            const smoothing = tuningConfig.faceTrackSmoothing
            if (smoothedFaceOffset.current) {
              smoothedFaceOffset.current = {
                offsetX: smoothedFaceOffset.current.offsetX + (faceOffset.offsetX - smoothedFaceOffset.current.offsetX) * smoothing,
                offsetY: smoothedFaceOffset.current.offsetY + (faceOffset.offsetY - smoothedFaceOffset.current.offsetY) * smoothing,
              }
            } else {
              smoothedFaceOffset.current = faceOffset
            }
          }

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

          // Auto-calibrate hip position from pose landmarks
          // Uses computeHipPositionOffset for 1:1 mapping
          const worldLandmarks = poseResult.worldLandmarks
          if (worldLandmarks && worldLandmarks.length >= 25) {
            const hipOffset = computeHipPositionOffset(worldLandmarks, {
              baseY: tuningConfig.modelYOffset,
              scaleX: tuningConfig.hipScaleX,
              scaleY: tuningConfig.hipScaleY,
            })
            if (hipOffset) {
              const smoothFactor = tuningConfig.hipPositionSmoothing
              if (smoothedHipPosition.current) {
                smoothedHipPosition.current = {
                  x: smoothedHipPosition.current.x + (hipOffset.x - smoothedHipPosition.current.x) * smoothFactor,
                  y: smoothedHipPosition.current.y + (hipOffset.y - smoothedHipPosition.current.y) * smoothFactor,
                }
              } else {
                smoothedHipPosition.current = hipOffset
              }
            }
          }
        } else {
          // No pose detected — decay toward idle
          lastPoseBones.current = null
          // Decay hip position back to center/zero
          if (smoothedHipPosition.current) {
            smoothedHipPosition.current = {
              x: smoothedHipPosition.current.x * 0.9,
              y: smoothedHipPosition.current.y * 0.9,
            }
            if (Math.abs(smoothedHipPosition.current.x) < 0.001 && Math.abs(smoothedHipPosition.current.y) < 0.001) {
              smoothedHipPosition.current = null
            }
          }
        }
      }, POSE_INTERVAL_MS) // ~15fps

      // 9. Start hand tracking loop at ~15fps
      handIntervalRef.current = setInterval(() => {
        if (!isRunningRef.current) return
        if (!video.readyState || video.paused) return
        if (!handTrackerRef.current) return

        const now = performance.now()
        const handResult = handTrackerRef.current.processFrame(video, now)

        if (handResult && handResult.handsDetected > 0 && handResult.landmarks.length > 0) {
          const handRotations = solveHands(handResult.landmarks, handResult.handedness)

          // Smooth hand rotations
          if (lastHandRotations.current) {
            lastHandRotations.current = {
              left: smoothFingerRotations(lastHandRotations.current.left, handRotations.left, tuningConfig.poseSmoothing),
              right: smoothFingerRotations(lastHandRotations.current.right, handRotations.right, tuningConfig.poseSmoothing),
            }
          } else {
            lastHandRotations.current = handRotations
          }
        } else {
          // Decay hand rotations toward zero
          if (lastHandRotations.current) {
            lastHandRotations.current = {
              left: smoothFingerRotations(lastHandRotations.current.left, ZERO_FINGER, 0.1),
              right: smoothFingerRotations(lastHandRotations.current.right, ZERO_FINGER, 0.1),
            }
            // Check if fully decayed
            if (isZeroFingers(lastHandRotations.current.left) && isZeroFingers(lastHandRotations.current.right)) {
              lastHandRotations.current = null
            }
          }
        }
      }, HAND_INTERVAL_MS) // ~15fps
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
    if (handIntervalRef.current !== null) {
      clearInterval(handIntervalRef.current)
      handIntervalRef.current = null
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
    if (handTrackerRef.current) {
      handTrackerRef.current.stopTracking()
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

  const setTransparentBg = useCallback((enabled: boolean) => {
    loaderRef.current?.setTransparentBg(enabled)
  }, [])

  const setDebugScene = useCallback((enabled: boolean) => {
    loaderRef.current?.setDebugScene(enabled)
  }, [])

  return {
    state: uiState,
    isReady,
    error,
    start,
    stop,
    destroy,
    setTransparentBg,
    setDebugScene,
    latestBlendShapes,
    latestHeadRotation,
    latestLandmarks,
    smoothedCameraDistance,
    smoothedFaceOffset,
    smoothedHipPosition,
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
/**
 * Smooth finger rotations using per-component EMA.
 * Reuses the same pattern as smoothPoseBones.
 */
function smoothFingerRotations(
  prev: import('../tracking/hand-solver').FingerRotations,
  current: import('../tracking/hand-solver').FingerRotations,
  factor: number,
): import('../tracking/hand-solver').FingerRotations {
  return {
    thumbProximal: lerpRotation(prev.thumbProximal, current.thumbProximal, factor),
    thumbIntermediate: lerpRotation(prev.thumbIntermediate, current.thumbIntermediate, factor),
    thumbDistal: lerpRotation(prev.thumbDistal, current.thumbDistal, factor),
    indexProximal: lerpRotation(prev.indexProximal, current.indexProximal, factor),
    indexIntermediate: lerpRotation(prev.indexIntermediate, current.indexIntermediate, factor),
    indexDistal: lerpRotation(prev.indexDistal, current.indexDistal, factor),
    middleProximal: lerpRotation(prev.middleProximal, current.middleProximal, factor),
    middleIntermediate: lerpRotation(prev.middleIntermediate, current.middleIntermediate, factor),
    middleDistal: lerpRotation(prev.middleDistal, current.middleDistal, factor),
    ringProximal: lerpRotation(prev.ringProximal, current.ringProximal, factor),
    ringIntermediate: lerpRotation(prev.ringIntermediate, current.ringIntermediate, factor),
    ringDistal: lerpRotation(prev.ringDistal, current.ringDistal, factor),
    littleProximal: lerpRotation(prev.littleProximal, current.littleProximal, factor),
    littleIntermediate: lerpRotation(prev.littleIntermediate, current.littleIntermediate, factor),
    littleDistal: lerpRotation(prev.littleDistal, current.littleDistal, factor),
  }
}

/**
 * Check if finger rotations have decayed to near-zero.
 */
function isZeroFingers(f: import('../tracking/hand-solver').FingerRotations): boolean {
  const threshold = 0.01
  return (
    Math.abs(f.thumbProximal.x) < threshold &&
    Math.abs(f.indexProximal.x) < threshold &&
    Math.abs(f.middleProximal.x) < threshold &&
    Math.abs(f.ringProximal.x) < threshold &&
    Math.abs(f.littleProximal.x) < threshold
  )
}

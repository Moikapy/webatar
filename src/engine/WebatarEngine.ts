/**
 * WebatarEngine — Main orchestrator for webcam → VRM avatar animation.
 *
 * Coordinates face tracking, pose solving, expression mapping,
 * VRM loading, and the render loop.
 */

import { computeVRMExpressions } from '../tracking/expression-map'
import { smoothExpressions, BlinkStabilizer, lerpVec3 } from '../tracking/smoothing'
import { applyExpressionsToVRM } from '../vrm/expressions'
import { rotateVRMBone } from '../vrm/bones'
import type { VRMExpressionManager, VRMHumanoid, VRMInstance } from '../vrm/types'
import type { HeadRotation } from '../tracking/pose-solver'

export interface WebatarConfig {
  canvas: HTMLCanvasElement
  video?: HTMLVideoElement
  cameraPosition?: [number, number, number]
  cameraFov?: number
  enablePoseTracking?: boolean
  enableHandTracking?: boolean
  smoothingFactor?: number
  debugOverlay?: boolean
}

export type WebatarStatus =
  | 'idle'
  | 'initializing'
  | 'tracking'
  | 'error'
  | 'stopped'

export interface WebatarState {
  status: WebatarStatus
  currentAvatarId: string | null
  faceDetected: boolean
  fps: number
  trackingQuality: number
  error: string | null
}

type StateChangeListener = (state: WebatarState) => void

export class WebatarEngine {
  private config: Required<WebatarConfig>
  private state: WebatarState
  private listeners: Set<StateChangeListener> = new Set()
  private animationFrameId: number | null = null
  private blinkStabilizer = new BlinkStabilizer()
  private lastExpressions: Record<string, number> = {}
  private lastHeadRotation: HeadRotation = { x: 0, y: 0, z: 0 }
  private lastFpsTime = 0
  private frameCount = 0

  // @ts-expect-error VRM instance - will be set during avatar loading
  private _vrm: VRMInstance | null = null
  private expressionManager: VRMExpressionManager | null = null
  private humanoid: VRMHumanoid | null = null

  constructor(config: WebatarConfig) {
    this.config = {
      canvas: config.canvas,
      video: config.video ?? (typeof document !== 'undefined' ? document.createElement('video') : ({} as HTMLVideoElement)),
      cameraPosition: config.cameraPosition ?? [0, 1.3, 2],
      cameraFov: config.cameraFov ?? 30,
      enablePoseTracking: config.enablePoseTracking ?? true,
      enableHandTracking: config.enableHandTracking ?? false,
      smoothingFactor: config.smoothingFactor ?? 0.35,
      debugOverlay: config.debugOverlay ?? false,
    }

    this.state = {
      status: 'idle',
      currentAvatarId: null,
      faceDetected: false,
      fps: 0,
      trackingQuality: 0,
      error: null,
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────

  get currentState(): WebatarState {
    return { ...this.state }
  }

  onStateChange(callback: StateChangeListener): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  async init(): Promise<void> {
    this.updateState({ status: 'initializing' })
    try {
      // MediaPipe and Three.js initialization will be done in the React hook layer
      // This method validates config and prepares internal state
      this.updateState({ status: 'idle' })
    } catch (error) {
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Init failed',
      })
      throw error
    }
  }

  start(): void {
    if (this.state.status === 'tracking') return
    this.updateState({ status: 'tracking' })
    this.lastFpsTime = performance.now()
    this.frameCount = 0
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.updateState({ status: 'stopped' })
  }

  destroy(): void {
    this.stop()
    this.listeners.clear()
    this._vrm = null
    this.expressionManager = null
    this.humanoid = null
  }

  // ─── Internal: Per-frame processing ─────────────────────────────────────

  /**
   * Process a single frame of face tracking data.
   * Called by the tracking loop with MediaPipe blend shapes.
   */
  processFaceFrame(blendShapes: Readonly<Record<string, number>>): void {
    // Always update face detection state
    this.updateState({
      faceDetected: true,
      trackingQuality: Math.max(
        ...Object.values(blendShapes),
        0,
      ),
    })

    if (!this.expressionManager) return

    // 1. Compute VRM expressions from ARKit blend shapes
    const rawExpressions = computeVRMExpressions(blendShapes)

    // 2. Smooth expressions to prevent jitter
    const smoothedExpressions = smoothExpressions(
      this.lastExpressions,
      rawExpressions,
      this.config.smoothingFactor,
    )
    this.lastExpressions = smoothedExpressions

    // 3. Stabilize blinks
    const blinkWeight = this.blinkStabilizer.process(
      blendShapes.eyeBlinkLeft ?? 0,
      blendShapes.eyeBlinkRight ?? 0,
    )

    // Override blink expressions with stabilized values
    smoothedExpressions.blinkLeft = blinkWeight
    smoothedExpressions.blinkRight = blinkWeight

    // 4. Apply to VRM
    applyExpressionsToVRM(this.expressionManager, smoothedExpressions)
  }

  /**
   * Process head rotation from face landmarks.
   */
  processHeadRotation(rotation: Readonly<HeadRotation>): void {
    if (!this.humanoid) return

    // Smooth head rotation
    const smoothed = lerpVec3(this.lastHeadRotation, rotation, this.config.smoothingFactor)
    this.lastHeadRotation = smoothed

    rotateVRMBone(this.humanoid, 'head', smoothed)
    rotateVRMBone(this.humanoid, 'neck', {
      x: smoothed.x * 0.3,
      y: smoothed.y * 0.3,
      z: smoothed.z * 0.3,
    })
  }

  /**
   * Handle face detection loss.
   */
  processFaceLost(): void {
    this.blinkStabilizer.reset()
    this.updateState({ faceDetected: false })
  }

  /**
   * Update FPS counter.
   */
  updateFps(): void {
    this.frameCount++
    const now = performance.now()
    const elapsed = now - this.lastFpsTime
    if (elapsed >= 1000) {
      this.updateState({ fps: Math.round((this.frameCount * 1000) / elapsed) })
      this.frameCount = 0
      this.lastFpsTime = now
    }
  }

  // ─── Internal: State management ────────────────────────────────────────

  private updateState(partial: Partial<WebatarState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}
/**
 * FaceTracker — wraps MediaPipe FaceLandmarker for webcam face tracking.
 *
 * Manages the MediaPipe WASM lifecycle, webcam access, and per-frame
 * processing. Extracts 52 ARKit blend shapes and face landmarks.
 *
 * This module is browser-only — it accesses navigator.mediaDevices
 * and requires WebGL/WASM support.
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'
import { solveHeadRotation } from './pose-solver'
import { MEDIAPIPE_CONFIG } from '../constants'

export type TrackerState = 'idle' | 'initializing' | 'ready' | 'tracking' | 'error' | 'stopped' | 'destroyed'

export interface FaceTrackingResult {
  blendShapes: Record<string, number>
  headRotation: { x: number; y: number; z: number }
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>
  faceDetected: boolean
  timestamp: number
}

export class FaceTracker {
  private _state: TrackerState = 'idle'
  private faceLandmarker: FaceLandmarker | null = null
  /** @internal Will be used by processFrame */
  // @ts-expect-error -- will be used by processFrame
  private _videoElement: HTMLVideoElement | null = null
  private lastTimestamp = -1
  private _lastResult: FaceTrackingResult | null = null

  get state(): TrackerState {
    return this._state
  }

  get lastResult(): FaceTrackingResult | null {
    return this._lastResult
  }

  /**
   * Initialize MediaPipe FaceLandmarker.
   * Downloads the WASM module and model file.
   */
  async init(): Promise<void> {
    if (this._state !== 'idle') return

    this._state = 'initializing'

    try {
      const vision = await FilesetResolver.forVisionTasks(
        MEDIAPIPE_CONFIG.WASM_BASE_URL,
      )

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_CONFIG.FACE_MODEL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      })

      this._state = 'ready'
    } catch (error) {
      this._state = 'error'
      console.error('[FaceTracker] Init failed:', error)
      throw error
    }
  }

  /**
   * Start tracking from a video element.
   */
  startTracking(): void {
    if (this._state !== 'ready' && this._state !== 'stopped') return
    this._state = 'tracking'
  }

  /**
   * Stop tracking.
   */
  stopTracking(): void {
    if (this._state !== 'tracking') return
    this._state = 'stopped'
    this.lastTimestamp = -1
  }

  /**
   * Process a single video frame.
   * Call this in a requestAnimationFrame loop.
   */
  processFrame(video: HTMLVideoElement, timestamp: number): FaceTrackingResult | null {
    if (this._state !== 'tracking' || !this.faceLandmarker) return null

    // MediaPipe requires monotonically increasing timestamps
    if (timestamp <= this.lastTimestamp) return this._lastResult
    this.lastTimestamp = timestamp

    const results = this.faceLandmarker.detectForVideo(video, timestamp)

    const faceDetected = results.faceLandmarks && results.faceLandmarks.length > 0

    if (!faceDetected) {
      const emptyResult: FaceTrackingResult = {
        blendShapes: {},
        headRotation: { x: 0, y: 0, z: 0 },
        landmarks: [],
        faceDetected: false,
        timestamp,
      }
      this._lastResult = emptyResult
      return emptyResult
    }

    const landmarks = results.faceLandmarks[0]
    const blendShapes = this.extractBlendShapes(
      results.faceBlendshapes?.[0] as unknown as Array<{ categoryName: string; score: number }> ?? null,
    )
    const headRotation = this.extractHeadRotation(landmarks)

    const result: FaceTrackingResult = {
      blendShapes,
      headRotation,
      landmarks: landmarks.map((lm: { x: number; y: number; z: number; visibility?: number }) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      })),
      faceDetected: true,
      timestamp,
    }

    this._lastResult = result
    return result
  }

  /**
   * Extract blend shapes from MediaPipe results as a name→weight map.
   * Filters out zero-weight entries to reduce noise.
   */
  extractBlendShapes(
    blendShapes: Array<{ categoryName: string; score: number }> | null,
  ): Record<string, number> {
    const result: Record<string, number> = {}

    if (!blendShapes) return result

    for (const shape of blendShapes) {
      if (shape.score > 0) {
        result[shape.categoryName] = shape.score
      }
    }

    return result
  }

  /**
   * Extract head rotation from face landmarks using our pose solver.
   */
  extractHeadRotation(
    landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>,
  ): { x: number; y: number; z: number } {
    return solveHeadRotation(landmarks)
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close()
      this.faceLandmarker = null
    }
    this._state = 'destroyed'
    this._lastResult = null
  }
}
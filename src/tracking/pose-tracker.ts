/**
 * PoseTracker — wraps MediaPipe PoseLandmarker for real-time body pose tracking.
 *
 * Manages the MediaPipe WASM lifecycle, webcam access, and per-frame
 * processing. Extracts 33 pose landmarks and world landmarks per frame.
 *
 * This module is browser-only — it accesses navigator.mediaDevices
 * and requires WebGL/WASM support.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { MEDIAPIPE_CONFIG } from '../constants'

export type PoseTrackerState = 'idle' | 'initializing' | 'ready' | 'tracking' | 'error' | 'stopped' | 'destroyed'

export interface PoseTrackingResult {
  /** Normalized pose landmarks (33 points, x/y/z in [0,1]) */
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>
  /** World-coordinate pose landmarks (33 points, in meters) */
  worldLandmarks: Array<{ x: number; y: number; z: number; visibility?: number }>
  poseDetected: boolean
  timestamp: number
}

export class PoseTracker {
  private _state: PoseTrackerState = 'idle'
  private poseLandmarker: PoseLandmarker | null = null
  private lastTimestamp = -1
  private _lastResult: PoseTrackingResult | null = null

  get state(): PoseTrackerState {
    return this._state
  }

  get lastResult(): PoseTrackingResult | null {
    return this._lastResult
  }

  /**
   * Initialize MediaPipe PoseLandmarker.
   * Downloads the WASM module and model file.
   */
  async init(): Promise<void> {
    if (this._state !== 'idle') return

    this._state = 'initializing'

    try {
      const vision = await FilesetResolver.forVisionTasks(
        MEDIAPIPE_CONFIG.WASM_BASE_URL,
      )

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_CONFIG.POSE_MODEL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      })

      this._state = 'ready'
    } catch (error) {
      this._state = 'error'
      console.error('[PoseTracker] Init failed:', error)
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
   * Call this in a setInterval loop at the desired tracking rate.
   */
  processFrame(video: HTMLVideoElement, timestamp: number): PoseTrackingResult | null {
    if (this._state !== 'tracking' || !this.poseLandmarker) return null

    // MediaPipe requires monotonically increasing timestamps
    if (timestamp <= this.lastTimestamp) return this._lastResult
    this.lastTimestamp = timestamp

    const results = this.poseLandmarker.detectForVideo(video, timestamp)

    const poseDetected = !!(results.landmarks && results.landmarks.length > 0)

    if (!poseDetected) {
      const emptyResult: PoseTrackingResult = {
        landmarks: [],
        worldLandmarks: [],
        poseDetected: false,
        timestamp,
      }
      this._lastResult = emptyResult
      return emptyResult
    }

    const landmarks = results.landmarks[0] as Array<{ x: number; y: number; z: number; visibility?: number }>

    // Use world landmarks if available, fall back to normalized
    // Cast directly to avoid 33+ object allocations per frame
    const worldLandmarks = (results.worldLandmarks?.[0] ?? results.landmarks[0]) as Array<{ x: number; y: number; z: number; visibility?: number }>

    const result: PoseTrackingResult = {
      landmarks,
      worldLandmarks,
      poseDetected: true,
      timestamp,
    }

    this._lastResult = result
    return result
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close()
      this.poseLandmarker = null
    }
    this._state = 'destroyed'
    this._lastResult = null
  }
}
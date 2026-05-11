/**
 * HandTracker — wraps MediaPipe HandLandmarker for real-time hand tracking.
 *
 * Manages the MediaPipe WASM lifecycle and per-frame processing.
 * Extracts 21 landmarks per hand (left + right) for finger bone mapping.
 *
 * This module is browser-only — it accesses navigator.mediaDevices
 * and requires WebGL/WASM support.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { MEDIAPIPE_CONFIG } from '../constants'

export type HandTrackerState = 'idle' | 'initializing' | 'ready' | 'tracking' | 'error' | 'stopped' | 'destroyed'

export interface HandTrackingResult {
  /** Hand landmarks (one array per detected hand, 21 points each) */
  landmarks: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>
  /** Handedness for each detected hand ("Left" or "Right") */
  handedness: Array<{ category: string; score: number }>
  /** Number of hands detected (0, 1, or 2) */
  handsDetected: number
  timestamp: number
}

export class HandTracker {
  private _state: HandTrackerState = 'idle'
  private handLandmarker: HandLandmarker | null = null
  private lastTimestamp = -1
  private _lastResult: HandTrackingResult | null = null

  get state(): HandTrackerState {
    return this._state
  }

  get lastResult(): HandTrackingResult | null {
    return this._lastResult
  }

  /**
   * Initialize MediaPipe HandLandmarker.
   * Downloads the WASM module and model file.
   */
  async init(): Promise<void> {
    if (this._state !== 'idle') return

    this._state = 'initializing'

    try {
      const vision = await FilesetResolver.forVisionTasks(
        MEDIAPIPE_CONFIG.WASM_BASE_URL,
      )

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_CONFIG.HAND_MODEL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      this._state = 'ready'
    } catch (error) {
      this._state = 'error'
      console.error('[HandTracker] Init failed:', error)
      throw error
    }
  }

  /**
   * Start tracking.
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
   * Call this in a setInterval loop at the desired tracking rate (~15fps).
   */
  processFrame(video: HTMLVideoElement, timestamp: number): HandTrackingResult | null {
    if (this._state !== 'tracking' || !this.handLandmarker) return null

    // MediaPipe requires monotonically increasing timestamps
    if (timestamp <= this.lastTimestamp) return this._lastResult
    this.lastTimestamp = timestamp

    const results = this.handLandmarker.detectForVideo(video, timestamp)

    const handsDetected = !!(results.landmarks && results.landmarks.length > 0)
    const landmarkCount = results.landmarks?.length ?? 0

    if (!handsDetected || landmarkCount === 0) {
      const emptyResult: HandTrackingResult = {
        landmarks: [],
        handedness: [],
        handsDetected: 0,
        timestamp,
      }
      this._lastResult = emptyResult
      return emptyResult
    }

    // Cast landmarks directly — avoid per-frame object allocation
    const landmarks = results.landmarks as Array<Array<{ x: number; y: number; z: number; visibility?: number }>>

    // Extract handedness
    const handedness = (results.handedness ?? []).map(
      (hand: ReadonlyArray<{ categoryName: string; score: number }>) => ({
        category: hand[0]?.categoryName ?? 'Right',
        score: hand[0]?.score ?? 0,
      }),
    )

    const result: HandTrackingResult = {
      landmarks,
      handedness,
      handsDetected: landmarkCount,
      timestamp,
    }

    this._lastResult = result
    return result
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close()
      this.handLandmarker = null
    }
    this._state = 'destroyed'
    this._lastResult = null
  }
}
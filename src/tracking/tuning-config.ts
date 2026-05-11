/**
 * TuningConfig — Live-adjustable parameters for tracking and rendering.
 *
 * All the "magic numbers" in the tracking pipeline are here so they
 * can be tuned in real-time via the debug panel. No more guessing
 * values and rebuilding.
 *
 * Usage in the tracking loop:
 *   import { tuningConfig } from './tuning-config'
 *   rotateVRMBone(h, 'head', { x: head.x * tuningConfig.headScale, ... })
 *
 * The debug panel reads and writes these values directly via refs,
 * so there are zero React re-renders during tuning.
 */

export interface TuningConfig {
  // ─── Head Rotation ────────────────────────────────────────────────
  /** Scale factor for head rotation (0–1, lower = less twitchy) */
  headScale: number
  /** Scale factor for neck rotation (0–1, lower = subtle follow) */
  neckScale: number

  // ─── Face Tracking ───────────────────────────────────────────────
  /** Expression smoothing EMA factor (0=frozen, 1=instant snap) */
  expressionSmoothing: number
  /** Head rotation smoothing EMA factor (0=frozen, 1=instant snap) */
  headSmoothing: number

  // ─── Body Pose ──────────────────────────────────────────────────
  /** Pose bone smoothing EMA factor (0=frozen, 1=instant snap) */
  poseSmoothing: number
  /** Spine rotation scale (0–2, 1=1:1 with tracking) */
  spineScale: number
  /** Shoulder rotation scale (0–2, 1=1:1) */
  shoulderScale: number
  /** Upper arm rotation scale (0–2, 1=1:1) */
  upperArmScale: number

  // ─── Model Position ─────────────────────────────────────────────
  /** Vertical offset to lower/raise the avatar (meters, negative = lower) */
  modelYOffset: number
  /** Horizontal position mapping scale (0=off, 1=1:1 with your movement) */
  hipPositionScaleX: number
  /** Vertical position mapping scale (0=off, 1=1:1 with your movement) */
  hipPositionScaleY: number
  /** Hip position smoothing (0=frozen, 1=instant) */
  hipPositionSmoothing: number

  // ─── Camera ────────────────────────────────────────────────────────
  /** Camera Y position (height, meters) */
  cameraY: number
  /** Camera look-at Y target (meters) */
  cameraLookAtY: number
  /** Camera distance smoothing EMA factor (0=frozen, 1=instant) */
  cameraDistanceSmoothing: number
  /** Default camera distance (meters) when face not detected */
  cameraDefaultDistance: number
  /** Minimum camera distance (meters) */
  cameraMinDistance: number
  /** Maximum camera distance (meters) */
  cameraMaxDistance: number
  /** Reference face area for distance calculation */
  cameraReferenceArea: number
  /** Z-depth influence scale (0=ignore z, 1=full z influence) */
  cameraDepthScale: number

  // ─── Debug Scene ──────────────────────────────────────────────────
  /** Show 3D debug markers in the scene (face position, hip center, camera) */
  showDebugScene: boolean

  // ─── Overlay ──────────────────────────────────────────────────────
  /** Show debug overlay (landmarks + blend shapes on webcam) */
  showOverlay: boolean
  /** Show tuning panel */
  showTuningPanel: boolean
}

/** Default values — production-ready starting point */
export const DEFAULT_TUNING: TuningConfig = {
  // Head rotation
  headScale: 0.7,
  neckScale: 0.15,

  // Face tracking
  expressionSmoothing: 0.6,
  headSmoothing: 0.5,

  // Body pose
  poseSmoothing: 0.4,
  spineScale: 1.0,
  shoulderScale: 1.0,
  upperArmScale: 1.0,

  // Model position
  modelYOffset: -0.1,
  hipPositionScaleX: -0.5,
  hipPositionScaleY: -0.8,
  hipPositionSmoothing: 0.2,

  // Camera
  cameraY: 1.3,
  cameraLookAtY: 1.0,
  cameraDistanceSmoothing: 0.15,
  cameraDefaultDistance: 3.5,
  cameraMinDistance: 1.5,
  cameraMaxDistance: 6.0,
  cameraReferenceArea: 0.08,
  cameraDepthScale: 5.0,

  // Debug scene
  showDebugScene: false,

  // Overlay
  showOverlay: false,
  showTuningPanel: false,
}

/**
 * Live tunable config — reads and writes go directly to this object.
 * The tracking loop accesses properties by reference (no React state).
 * The tuning panel slider onChange writes to properties directly.
 */
export const tuningConfig: TuningConfig = { ...DEFAULT_TUNING }

/**
 * Reset all values to defaults.
 */
export function resetTuningConfig(): void {
  Object.assign(tuningConfig, DEFAULT_TUNING)
}

/**
 * Export current config as a TypeScript constants snippet.
 * Copy-paste ready for constants.ts.
 */
export function exportTuningConfig(): string {
  return `// Tuning config (exported from debug panel)
export const TUNING = {
  headScale: ${tuningConfig.headScale},
  neckScale: ${tuningConfig.neckScale},
  expressionSmoothing: ${tuningConfig.expressionSmoothing},
  headSmoothing: ${tuningConfig.headSmoothing},
  poseSmoothing: ${tuningConfig.poseSmoothing},
  spineScale: ${tuningConfig.spineScale},
  shoulderScale: ${tuningConfig.shoulderScale},
  upperArmScale: ${tuningConfig.upperArmScale},
  modelYOffset: ${tuningConfig.modelYOffset},
  hipPositionScaleX: ${tuningConfig.hipPositionScaleX},
  hipPositionScaleY: ${tuningConfig.hipPositionScaleY},
  hipPositionSmoothing: ${tuningConfig.hipPositionSmoothing},
  cameraY: ${tuningConfig.cameraY},
  cameraLookAtY: ${tuningConfig.cameraLookAtY},
  cameraDistanceSmoothing: ${tuningConfig.cameraDistanceSmoothing},
  cameraDefaultDistance: ${tuningConfig.cameraDefaultDistance},
  cameraMinDistance: ${tuningConfig.cameraMinDistance},
  cameraMaxDistance: ${tuningConfig.cameraMaxDistance},
  cameraReferenceArea: ${tuningConfig.cameraReferenceArea},
  cameraDepthScale: ${tuningConfig.cameraDepthScale},
  showDebugScene: ${tuningConfig.showDebugScene},
} as const`
}
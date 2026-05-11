/**
 * Camera distance — computes avatar/camera distance from face tracking data.
 *
 * Uses two signals to determine distance:
 *   1. Face bounding box size (larger face = closer to camera)
 *   2. Nose z-depth (closer z = closer to camera)
 *
 * The result is a camera distance value that can be used to position
 * the Three.js camera, making the avatar appear closer/further
 * in sync with the user's actual distance from the webcam.
 *
 * All functions are pure — no mutations, no side effects.
 */

export interface CameraDistanceConfig {
  /** Default distance when face is not detected */
  defaultDistance: number
  /** Minimum camera distance (closest the avatar can get) */
  minDistance: number
  /** Maximum camera distance (furthest the avatar can get) */
  maxDistance: number
}

/** Default camera distance config matching VRMLoader's initial position */
export const DEFAULT_CAMERA_CONFIG: CameraDistanceConfig = {
  defaultDistance: 3.5,
  minDistance: 1.5,
  maxDistance: 6.0,
}

/**
 * Compute camera distance from face landmarks.
 *
 * Uses the face bounding box area (normalized) as a proxy for distance.
 * Larger face area = closer to camera = smaller distance.
 *
 * Optionally uses the z-depth of the nose tip (landmark index 1)
 * for more accurate depth estimation when available.
 *
 * @param landmarks - Face landmarks from MediaPipe (478 points or subset)
 * @param config - Camera distance configuration
 * @returns Camera distance in world units
 */
export function computeCameraDistance(
  landmarks: ReadonlyArray<{ x: number; y: number; z?: number; visibility?: number }>,
  config: CameraDistanceConfig = DEFAULT_CAMERA_CONFIG,
): number {
  if (landmarks.length === 0) return config.defaultDistance

  // Compute bounding box of face landmarks
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x
    if (lm.x > maxX) maxX = lm.x
    if (lm.y < minY) minY = lm.y
    if (lm.y > maxY) maxY = lm.y
  }

  const faceWidth = maxX - minX
  const faceHeight = maxY - minY
  const faceArea = faceWidth * faceHeight

  // Minimum area to avoid noise from tiny/false detections
  if (faceArea < 0.001) return config.defaultDistance

  // Map face area to distance using inverse relationship.
  // Typical face area when at default distance (~2.5m) is about 0.05-0.15
  // We use a reference area and scale linearly.
  const referenceArea = 0.08 // face area at reference distance
  const referenceDistance = config.defaultDistance

  // Distance = reference * (referenceArea / actualArea)
  // Larger area → smaller distance (closer)
  let distance = referenceDistance * (referenceArea / Math.max(faceArea, 0.001))

  // If z-depth is available, blend it in using the closest landmark to camera
  // More negative z in MediaPipe = closer to camera (depth from face center)
  if (landmarks.some(lm => lm.z !== undefined && lm.z !== 0)) {
    // Find the most negative z (closest to camera)
    let minZ = 0
    for (const lm of landmarks) {
      if (lm.z !== undefined && lm.z < minZ) {
        minZ = lm.z
      }
    }
    // Closer to camera (more negative z) → smaller distance
    // Scale factor controls how much depth affects distance
    const depthOffset = minZ * 5
    distance += depthOffset
  }

  // Clamp to limits
  return Math.max(config.minDistance, Math.min(config.maxDistance, distance))
}

/**
 * Smooth camera distance using exponential moving average.
 *
 * @param previous - Last smoothed distance, or null for first frame
 * @param current - New raw distance value
 * @param factor - Smoothing factor (0 = frozen, 1 = instant, 0.2 = smooth)
 * @returns Smoothed distance
 */
export function smoothCameraDistance(
  previous: number | null,
  current: number,
  factor: number,
): number {
  if (previous === null) return current
  // EMA: smooth toward current from previous
  return previous + (current - previous) * factor
}
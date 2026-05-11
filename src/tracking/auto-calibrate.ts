/**
 * Landmark-driven auto-calibration — positions the avatar to match
 * the user's face/body position without manual tuning.
 *
 * Instead of magic numbers and manual slider tuning, we derive the
 * camera and avatar position directly from the tracked landmarks.
 *
 * The key insight: MediaPipe gives us normalized (0-1) coordinates
 * where the face/body is in the webcam frame. We convert these to
 * Three.js world coordinates using the camera's projection, so the
 * avatar aligns automatically.
 *
 * All functions are pure — no mutations, no side effects.
 */

/** Result of landmark-driven position calculation */
export interface LandmarkPosition {
  /** Where the face/nose tip is in normalized webcam space (0-1) */
  faceNormX: number
  faceNormY: number
  /** Camera X offset to center on the face (world units) */
  cameraOffsetX: number
  /** Camera Y offset to center on the face (world units) */
  cameraOffsetY: number
  /** Avatar root X position from hip tracking (world units) */
  avatarX: number
  /** Avatar root Y position from hip tracking (world units) */
  avatarY: number
}

/**
 * Auto-calibrate face position → camera offset.
 *
 * Takes the nose tip landmark (normalized 0-1) and computes how much
 * the camera should pan so the avatar's head appears at the same
 * screen position as the user's face.
 *
 * The logic:
 *   1. Face at center (0.5, 0.5) → no offset
 *   2. Face at left (0.3, 0.5) → camera pans left
 *   3. Face at right (0.7, 0.5) → camera pans right
 *
 * The panScale controls how responsive the camera follows.
 * A scale of 1.0 means the avatar tracks your face 1:1.
 * A scale of 0.5 means the avatar moves half as much (more subtle).
 */
export function computeFacePositionOffset(
  faceLandmarks: ReadonlyArray<{ x: number; y: number }>,
  cameraDistance: number,
  fovDegrees: number = 40,
  aspectRatio: number = 16 / 9,
  panScale: number = 1.0,
): { offsetX: number; offsetY: number } | null {
  if (faceLandmarks.length === 0) return null

  // Nose tip is landmark index 1
  const noseTip = faceLandmarks[1]
  if (!noseTip) return null

  // How far the face is from center (0 = center, positive = right/down)
  const dx = noseTip.x - 0.5
  const dy = noseTip.y - 0.5

  // Convert to world units at the camera's distance
  // FOV gives us the visible width at distance d:
  //   visibleWidth = 2 * d * tan(fov/2 * aspectRatio)
  // This means 1 normalized unit = visibleWidth in world units
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180)
  const visibleHeight = 2 * cameraDistance * Math.tan(halfFovRad)
  const visibleWidth = visibleHeight * aspectRatio

  // Face offset in world units
  // dx > 0 means face is on the right → camera needs to go right (positive X)
  // dy > 0 means face is below center → camera needs to go down (lower Y)
  const offsetX = dx * visibleWidth * panScale
  const offsetY = -dy * visibleHeight * panScale // Negative because Y is inverted

  return { offsetX, offsetY }
}

/**
 * Auto-calibrate hip position → avatar position.
 *
 * Uses pose world landmarks (indices 23=left hip, 24=right hip) to determine
 * where the avatar's root should be. The world landmarks are in meters relative
 * to the camera, so we can map them directly.
 *
 * For sitting/standing detection: if hip Y drops significantly below
 * the expected standing height (~0.9m from camera for a seated webcam position),
 * the avatar should lower accordingly.
 */
export function computeHipPositionOffset(
  poseWorldLandmarks: ReadonlyArray<{ x: number; y: number; z: number; visibility?: number }>,
  config: {
    /** Base Y position for the avatar (standing height) */
    baseY: number
    /** How much to scale the X offset (0 = no tracking, 1 = 1:1) */
    scaleX: number
    /** How much to scale the Y offset (0 = no tracking, 1 = 1:1) */
    scaleY: number
  } = { baseY: 0, scaleX: 1.0, scaleY: 1.0 },
): { x: number; y: number } | null {
  if (poseWorldLandmarks.length < 25) return null

  const leftHip = poseWorldLandmarks[23]
  const rightHip = poseWorldLandmarks[24]

  // Need both hips visible
  if (!leftHip || !rightHip) return null
  if ((leftHip.visibility ?? 0) < 0.5 && (rightHip.visibility ?? 0) < 0.5) return null

  // Hip center in world space
  const hipCenterX = (leftHip.x + rightHip.x) / 2
  const hipCenterY = (leftHip.y + rightHip.y) / 2

  // Map to avatar position
  // X: mirror (MediaPipe X is from camera's perspective)
  // Y: baseY + scaled offset from standing reference
  return {
    x: hipCenterX * config.scaleX,
    y: config.baseY + hipCenterY * config.scaleY,
  }
}

/**
 * Convert face bounding box to a rough depth estimate.
 *
 * A larger face = closer to camera. Returns a normalized depth value
 * where 1.0 = at reference distance, < 1.0 = closer, > 1.0 = further.
 */
export function faceAreaToDepthScale(
  faceLandmarks: ReadonlyArray<{ x: number; y: number }>,
  referenceArea: number = 0.08,
): number {
  if (faceLandmarks.length === 0) return 1.0

  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const lm of faceLandmarks) {
    if (lm.x < minX) minX = lm.x
    if (lm.x > maxX) maxX = lm.x
    if (lm.y < minY) minY = lm.y
    if (lm.y > maxY) maxY = lm.y
  }

  const area = (maxX - minX) * (maxY - minY)
  if (area < 0.001) return 1.0

  return referenceArea / Math.max(area, 0.001)
}
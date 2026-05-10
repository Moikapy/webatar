/**
 * Pose solver — converts MediaPipe pose/face landmarks into VRM bone rotations.
 *
 * Key landmarks:
 *   Face: 10=forehead, 152=chin, 1=nose, 234=left ear, 454=right ear
 *   Pose: 11=left shoulder, 12=right shoulder, 13=left elbow,
 *         14=right elbow, 15=left wrist, 16=right wrist,
 *         23=left hip, 24=right hip
 */

export interface NormalizedLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface HeadRotation {
  /** Pitch (nodding up/down) in radians */
  x: number
  /** Yaw (turning left/right) in radians */
  y: number
  /** Roll (tilting sideways) in radians */
  z: number
}

export interface BoneRotations {
  head: HeadRotation
  neck: HeadRotation
  spine: HeadRotation
  leftShoulder: HeadRotation
  rightShoulder: HeadRotation
  leftUpperArm: HeadRotation
  rightUpperArm: HeadRotation
  leftLowerArm: HeadRotation
  rightLowerArm: HeadRotation
}

// Safety clamp: max rotation in radians for any bone
const MAX_ROTATION = 1.0

/** Clamp a value to [-max, max] */
function clamp(value: number, max: number = MAX_ROTATION): number {
  return Math.max(-max, Math.min(max, value))
}

/** Get a landmark by index, returning null if not found */
function getLandmark(
  landmarks: NormalizedLandmark[],
  index: number,
): NormalizedLandmark | null {
  if (index < 0 || index >= landmarks.length) return null
  return landmarks[index] ?? null
}

/**
 * Solve head rotation from face landmarks.
 *
 * Uses the forehead-chin axis for pitch, the nose-ear axis for yaw,
 * and the ear-ear axis for roll.
 *
 * @param faceLandmarks - Array of 478 face landmarks from MediaPipe.
 *                        If landmarks array has items with `.index`, uses those;
 *                        otherwise uses array indices directly.
 * @returns Head rotation in radians (x=pitch, y=yaw, z=roll)
 */
export function solveHeadRotation(
  faceLandmarks: NormalizedLandmark[] | Array<{ index: number; x: number; y: number; z: number; visibility: number }>,
): HeadRotation {
  const zero: HeadRotation = { x: 0, y: 0, z: 0 }

  if (faceLandmarks.length === 0) return zero

  // Handle both indexed objects and positional array
  let forehead: NormalizedLandmark | null = null
  let chin: NormalizedLandmark | null = null
  let noseTip: NormalizedLandmark | null = null
  let leftEar: NormalizedLandmark | null = null
  let rightEar: NormalizedLandmark | null = null

  // Check if landmarks have index property (test format)
  const firstItem = faceLandmarks[0] as NormalizedLandmark & { index?: number }
  if ('index' in firstItem && firstItem.index !== undefined) {
    // Indexed format: find landmarks by index property
    const byIndex = new Map<number, NormalizedLandmark & { index: number }>()
    for (const lm of faceLandmarks as Array<NormalizedLandmark & { index: number }>) {
      byIndex.set(lm.index, lm)
    }
    forehead = byIndex.get(10) ?? null
    chin = byIndex.get(152) ?? null
    noseTip = byIndex.get(1) ?? null
    leftEar = byIndex.get(234) ?? null
    rightEar = byIndex.get(454) ?? null
  } else {
    // Array format: use positional indices (for direct MediaPipe output)
    forehead = getLandmark(faceLandmarks, 10)
    chin = getLandmark(faceLandmarks, 152)
    noseTip = getLandmark(faceLandmarks, 1)
    leftEar = getLandmark(faceLandmarks, 234)
    rightEar = getLandmark(faceLandmarks, 454)
  }

  if (!forehead || !chin || !noseTip) return zero

  // Yaw: horizontal offset of nose from midpoint of ears
  if (leftEar && rightEar) {
    const earMidX = (leftEar.x + rightEar.x) / 2
    const earWidth = Math.abs(rightEar.x - leftEar.x) || 0.01
    const noseOffset = noseTip.x - earMidX

    // Normalize by ear distance to make yaw position-independent
    const yaw = (noseOffset / earWidth) * 2
    zero.y = clamp(yaw)
  }

  // Pitch: vertical distance of nose from ear line midpoint, relative to face height
  if (leftEar && rightEar) {
    const faceHeight = Math.abs(chin.y - forehead.y) || 0.01
    // Higher nose = looking up (negative pitch in screen coords)
    const earMidY = (leftEar.y + rightEar.y) / 2
    const noseAboveEar = earMidY - noseTip.y
    const pitch = (noseAboveEar / faceHeight) * 1.5

    zero.x = clamp(pitch)
  }

  // Roll: tilt of the ear-ear line
  if (leftEar && rightEar) {
    const earDy = rightEar.y - leftEar.y
    const earDx = rightEar.x - leftEar.x || 0.01
    const roll = Math.atan2(earDy, earDx)

    zero.z = clamp(roll)
  }

  return zero
}

/**
 * Solve upper-body bone rotations from pose landmarks.
 *
 * MediaPipe pose has 33 landmarks. We use:
 *   11 = left shoulder, 12 = right shoulder
 *   13 = left elbow, 14 = right elbow
 *   15 = left wrist, 16 = right wrist
 *   23 = left hip, 24 = right hip
 *
 * @param poseLandmarks - Normalized pose landmarks (33 points)
 * @param poseWorldLandmarks - World-coordinate pose landmarks (33 points)
 * @returns Bone rotations for upper body, or null if insufficient data
 */
export function solvePoseBones(
  poseLandmarks: NormalizedLandmark[],
  poseWorldLandmarks: NormalizedLandmark[],
): BoneRotations | null {
  // Need at least 25 landmarks (indices up to 24)
  if (poseLandmarks.length < 25) return null
  if (poseWorldLandmarks.length < 25) return null

  const leftShoulder = getLandmark(poseLandmarks, 11)
  const rightShoulder = getLandmark(poseLandmarks, 12)
  const leftElbow = getLandmark(poseLandmarks, 13)
  const rightElbow = getLandmark(poseLandmarks, 14)
  const leftHip = getLandmark(poseLandmarks, 23)
  const rightHip = getLandmark(poseLandmarks, 24)

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null

  // Spine rotation derived from shoulder-hip alignment
  const hipMidX = (leftHip.x + rightHip.x) / 2
  const hipMidY = (leftHip.y + rightHip.y) / 2
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2

  const spineDx = shoulderMidX - hipMidX
  const spineDy = shoulderMidY - hipMidY

  const spineRotation = {
    x: clamp(-spineDy * 3),
    y: clamp(spineDx * 3),
    z: clamp(Math.atan2(
      rightShoulder.y - leftShoulder.y,
      rightShoulder.x - leftShoulder.x,
    )),
  }

  // Shoulder rotations
  const leftShoulderRotation = calculateShoulderRotation(
    leftShoulder,
    leftElbow,
  )
  const rightShoulderRotation = calculateShoulderRotation(
    rightShoulder,
    rightElbow,
  )

  // Elbow rotations (simple: rotation in the upper arm plane)
  const leftUpperArmRotation = { ...leftShoulderRotation }
  const rightUpperArmRotation = { ...rightShoulderRotation }

  // Lower arm: simplified bend based on elbow angle
  const leftLowerArmRotation: HeadRotation = { x: 0, y: 0, z: 0 }
  const rightLowerArmRotation: HeadRotation = { x: 0, y: 0, z: 0 }

  if (leftElbow) {
    leftLowerArmRotation.x = clamp(0.5) // Default arm bend
  }
  if (rightElbow) {
    rightLowerArmRotation.x = clamp(0.5)
  }

  return {
    head: { x: 0, y: 0, z: 0 }, // Head comes from face tracker, not pose
    neck: { x: spineRotation.x * 0.3, y: spineRotation.y * 0.3, z: spineRotation.z * 0.3 },
    spine: spineRotation,
    leftShoulder: leftShoulderRotation,
    rightShoulder: rightShoulderRotation,
    leftUpperArm: leftUpperArmRotation,
    rightUpperArm: rightUpperArmRotation,
    leftLowerArm: leftLowerArmRotation,
    rightLowerArm: rightLowerArmRotation,
  }
}

/** Calculate shoulder rotation from shoulder-to-elbow vector */
function calculateShoulderRotation(
  shoulder: NormalizedLandmark,
  elbow: NormalizedLandmark | null,
): HeadRotation {
  if (!elbow) {
    return { x: 0, y: 0, z: 0 }
  }

  const dx = elbow.x - shoulder.x
  const dy = elbow.y - shoulder.y
  const dz = (elbow.z ?? 0) - (shoulder.z ?? 0)

  return {
    x: clamp(Math.atan2(dy, Math.sqrt(dx * dx + dz * dz) || 0.01)),
    y: clamp(Math.atan2(dx, Math.sqrt(dy * dy + dz * dz) || 0.01)),
    z: clamp(Math.atan2(dz, Math.sqrt(dx * dx + dy * dy) || 0.01)),
  }
}
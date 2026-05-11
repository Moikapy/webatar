/**
 * Hand solver — converts MediaPipe HandLandmark results into VRM finger bone rotations.
 *
 * MediaPipe HandLandmarker provides 21 landmarks per hand:
 *
 *   0  = WRIST
 *   1-4  = THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP
 *   5-8  = INDEX_FINGER_MCP, PIP, DIP, TIP
 *   9-12 = MIDDLE_FINGER_MCP, PIP, DIP, TIP
 *   13-16 = RING_FINGER_MCP, PIP, DIP, TIP
 *   17-20 = PINKY_MCP, PIP, DIP, TIP
 *
 * VRM finger bones use these names:
 *   left/rightThumbProximal/Intermediate/Distal
 *   left/rightIndexProximal/Intermediate/Distal
 *   left/rightMiddleProximal/Intermediate/Distal
 *   left/rightRingProximal/Intermediate/Distal
 *   left/rightLittleProximal/Intermediate/Distal
 *
 * Each finger needs 3 rotations (proximal, intermediate, distal).
 * We derive curl angle from the angle between successive joints.
 */

export interface FingerRotations {
  /** All 3 rotation axes for each bone segment */
  thumbProximal: { x: number; y: number; z: number }
  thumbIntermediate: { x: number; y: number; z: number }
  thumbDistal: { x: number; y: number; z: number }
  indexProximal: { x: number; y: number; z: number }
  indexIntermediate: { x: number; y: number; z: number }
  indexDistal: { x: number; y: number; z: number }
  middleProximal: { x: number; y: number; z: number }
  middleIntermediate: { x: number; y: number; z: number }
  middleDistal: { x: number; y: number; z: number }
  ringProximal: { x: number; y: number; z: number }
  ringIntermediate: { x: number; y: number; z: number }
  ringDistal: { x: number; y: number; z: number }
  littleProximal: { x: number; y: number; z: number }
  littleIntermediate: { x: number; y: number; z: number }
  littleDistal: { x: number; y: number; z: number }
}

export type HandRotations = {
  left: FingerRotations
  right: FingerRotations
}

/** Zero rotations for one hand */
export const ZERO_FINGER: FingerRotations = {
  thumbProximal: { x: 0, y: 0, z: 0 },
  thumbIntermediate: { x: 0, y: 0, z: 0 },
  thumbDistal: { x: 0, y: 0, z: 0 },
  indexProximal: { x: 0, y: 0, z: 0 },
  indexIntermediate: { x: 0, y: 0, z: 0 },
  indexDistal: { x: 0, y: 0, z: 0 },
  middleProximal: { x: 0, y: 0, z: 0 },
  middleIntermediate: { x: 0, y: 0, z: 0 },
  middleDistal: { x: 0, y: 0, z: 0 },
  ringProximal: { x: 0, y: 0, z: 0 },
  ringIntermediate: { x: 0, y: 0, z: 0 },
  ringDistal: { x: 0, y: 0, z: 0 },
  littleProximal: { x: 0, y: 0, z: 0 },
  littleIntermediate: { x: 0, y: 0, z: 0 },
  littleDistal: { x: 0, y: 0, z: 0 },
}

// ─── Joint index mapping ─────────────────────────────────────────────

/**
 * Landmark indices for each finger joint chain.
 * Each finger: [MCP, PIP, DIP, TIP]
 * Thumb: [CMC, MCP, IP, TIP]
 */
const FINGER_JOINTS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  little: [17, 18, 19, 20],
} as const

const WRIST = 0

/**
 * Compute the curl angle between three consecutive landmarks.
 * Returns the angle in radians. Positive = finger curling inward.
 *
 * The angle is the deviation from straight (180° between the vectors).
 * When a finger is straight, angle ≈ 0. When curled, angle > 0.
 */
function jointCurlAngle(
  jointA: { x: number; y: number; z: number },
  jointB: { x: number; y: number; z: number },
  jointC: { x: number; y: number; z: number },
): number {
  // Vector from B to A
  const baX = jointA.x - jointB.x
  const baY = jointA.y - jointB.y
  const baZ = jointA.z - jointB.z

  // Vector from B to C
  const bcX = jointC.x - jointB.x
  const bcY = jointC.y - jointB.y
  const bcZ = jointC.z - jointB.z

  // Dot product
  const dot = baX * bcX + baY * bcY + baZ * bcZ

  // Magnitudes
  const magBA = Math.sqrt(baX * baX + baY * baY + baZ * baZ) || 0.001
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY + bcZ * bcZ) || 0.001

  // Cosine of angle between the two vectors
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)))

  // Angle from straight (pi - angle). When straight, angle between BA and BC ≈ pi, so curl ≈ 0
  return Math.PI - Math.acos(cosAngle)
}

/**
 * Compute finger rotations for a single hand from its 21 landmarks.
 *
 * Returns rotation values for proximal, intermediate, and distal joints
 * of each finger. The rotation is primarily on the X axis (curl),
 * with slight Y/Z for natural spread.
 */
export function solveHandFingers(
  handLandmarks: ReadonlyArray<{ x: number; y: number; z: number; visibility?: number }>,
): FingerRotations {
  if (handLandmarks.length < 21) return { ...ZERO_FINGER }

  // Helper to get landmark safely
  const lm = (i: number) => handLandmarks[i]

  const wrist = lm(WRIST)

  // Thumb — special case: uses 2D angle from wrist perspective
  const thumbMCP = lm(FINGER_JOINTS.thumb[1])
  const thumbIP = lm(FINGER_JOINTS.thumb[2])
  const thumbTip = lm(FINGER_JOINTS.thumb[3])

  const thumbProxAngle = jointCurlAngle(wrist, thumbMCP, thumbIP)
  const thumbMidAngle = jointCurlAngle(thumbMCP, thumbIP, thumbTip)

  // Other fingers — curl from MCP→PIP→DIP→TIP
  function solveFinger(finger: readonly [number, number, number, number]) {
    const mcp = lm(finger[0])
    const pip = lm(finger[1])
    const dip = lm(finger[2])
    const tip = lm(finger[3])

    const proxAngle = jointCurlAngle(wrist, mcp, pip)
    const midAngle = jointCurlAngle(mcp, pip, dip)
    const distAngle = jointCurlAngle(pip, dip, tip)

    return {
      proximal: { x: proxAngle, y: 0, z: 0 },
      intermediate: { x: midAngle, y: 0, z: 0 },
      distal: { x: distAngle, y: 0, z: 0 },
    }
  }

  const indexF = solveFinger(FINGER_JOINTS.index)
  const middleF = solveFinger(FINGER_JOINTS.middle)
  const ringF = solveFinger(FINGER_JOINTS.ring)
  const littleF = solveFinger(FINGER_JOINTS.little)

  return {
    thumbProximal: { x: thumbProxAngle * 0.6, y: 0, z: 0 },
    thumbIntermediate: { x: thumbMidAngle * 0.7, y: 0, z: 0 },
    thumbDistal: { x: thumbMidAngle * 0.5, y: 0, z: 0 },
    indexProximal: indexF.proximal,
    indexIntermediate: indexF.intermediate,
    indexDistal: indexF.distal,
    middleProximal: middleF.proximal,
    middleIntermediate: middleF.intermediate,
    middleDistal: middleF.distal,
    ringProximal: ringF.proximal,
    ringIntermediate: ringF.intermediate,
    ringDistal: ringF.distal,
    littleProximal: littleF.proximal,
    littleIntermediate: littleF.intermediate,
    littleDistal: littleF.distal,
  }
}

/**
 * Solve hand rotations from MediaPipe HandLandmarker results.
 *
 * @param landmarks - Array of hand landmark arrays (one per detected hand)
 * @param handedness - Array of handedness results ("Left" or "Right")
 * @returns Finger rotations for left and right hands
 */
export function solveHands(
  landmarks: ReadonlyArray<ReadonlyArray<{ x: number; y: number; z: number; visibility?: number }>>,
  handedness: ReadonlyArray<{ category: string; score: number }>,
): HandRotations {
  const left: FingerRotations = { ...ZERO_FINGER }
  const right: FingerRotations = { ...ZERO_FINGER }

  for (let i = 0; i < landmarks.length; i++) {
    const hand = landmarks[i]
    const label = handedness[i]?.category ?? 'Right'

    // Note: MediaPipe mirrors handedness from webcam perspective
    // "Left" in MediaPipe = user's left hand = VRM's left hand
    const fingers = solveHandFingers(hand)

    // MediaPipe "Left" is the user's LEFT hand (when facing camera)
    if (label === 'Left') {
      Object.assign(left, fingers)
    } else {
      Object.assign(right, fingers)
    }
  }

  return { left, right }
}
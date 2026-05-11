/**
 * Idle pose — a natural standing pose applied to VRM avatars
 * when no body tracking data is available.
 *
 * VRM models default to T-pose (arms straight out). This module
 * applies a relaxed A-pose with slightly bent elbows so the
 * avatar looks natural even without body tracking.
 *
 * Rotations are in radians, following VRM bone conventions:
 *   - x: pitch (forward/back)
 *   - y: yaw (left/right)
 *   - z: roll (tilt sideways)
 */

import type { VRMHumanoid } from './types'
import { rotateVRMBone } from './bones'

/**
 * Idle pose bone rotations in radians.
 * These create a relaxed A-pose — arms slightly down and forward
 * with a subtle elbow bend.
 */
const IDLE_POSE: Record<string, { x: number; y: number; z: number }> = {
  // Upper arms: slightly down from T-pose (~30° down, slight forward)
  leftUpperArm: { x: 0.45, y: 0.0, z: 0.25 },
  rightUpperArm: { x: 0.45, y: 0.0, z: -0.25 },

  // Lower arms: subtle bend at the elbow
  leftLowerArm: { x: -0.4, y: 0.0, z: 0.0 },
  rightLowerArm: { x: -0.4, y: 0.0, z: 0.0 },

  // Hands: slightly curled, relaxed
  leftHand: { x: -0.15, y: 0.0, z: 0.0 },
  rightHand: { x: -0.15, y: 0.0, z: 0.0 },

  // Shoulders: relaxed, slight drop
  leftShoulder: { x: 0.0, y: 0.0, z: 0.0 },
  rightShoulder: { x: 0.0, y: 0.0, z: 0.0 },

  // Spine: neutral upright
  spine: { x: 0.0, y: 0.0, z: 0.0 },
}

/**
 * Apply the idle pose to a VRM humanoid.
 * Only sets bones that exist on the model — graceful no-op for missing bones.
 *
 * @param humanoid - VRM humanoid instance
 */
export function applyIdlePose(humanoid: VRMHumanoid): void {
  for (const [boneName, rotation] of Object.entries(IDLE_POSE)) {
    rotateVRMBone(humanoid, boneName, rotation)
  }
}

/**
 * Get the idle pose bone rotations (for blending or reference).
 */
export function getIdlePose(): Readonly<Record<string, { x: number; y: number; z: number }>> {
  return IDLE_POSE
}
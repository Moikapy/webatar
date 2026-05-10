/**
 * VRM bone rotation utilities.
 *
 * Applies euler rotations (from pose-solver) to VRM humanoid bones.
 * Converts euler angles (radians) to quaternions for Three.js.
 */

import type { VRMHumanoid } from './types'
import type { HeadRotation } from '../tracking/pose-solver'

/** Clamp angle to safe range to prevent extreme rotations */
const MAX_ROTATION = 1.5 // ~85 degrees

function clamp(value: number, min: number = -MAX_ROTATION, max: number = MAX_ROTATION): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Convert euler angles (XYZ order, radians) to quaternion.
 * Three.js uses Hamilton quaternion conventions (x, y, z, w).
 */
function eulerToQuaternion(euler: { x: number; y: number; z: number }): [number, number, number, number] {
  const { x, y, z } = euler

  // Clamp to prevent gimbal lock issues
  const cx = clamp(x)
  const cy = clamp(y)
  const cz = clamp(z)

  // Half angles
  const hx = cx / 2
  const hy = cy / 2
  const hz = cz / 2

  // Quaternion from euler (XYZ order)
  const cxx = Math.cos(hx)
  const sxx = Math.sin(hx)
  const cyy = Math.cos(hy)
  const syy = Math.sin(hy)
  const czz = Math.cos(hz)
  const szz = Math.sin(hz)

  const w = cxx * cyy * czz + sxx * syy * szz
  const qx = sxx * cyy * czz - cxx * syy * szz
  const qy = cxx * syy * czz + sxx * cyy * szz
  const qz = cxx * cyy * szz - sxx * syy * czz

  return [qx, qy, qz, w]
}

/**
 * Apply a rotation to a VRM humanoid bone.
 *
 * @param humanoid - VRM humanoid instance
 * @param boneName - VRM bone name (e.g. 'head', 'leftUpperArm')
 * @param rotation - Euler rotation in radians (x=pitch, y=yaw, z=roll)
 */
export function rotateVRMBone(
  humanoid: VRMHumanoid,
  boneName: string,
  rotation: Readonly<HeadRotation>,
): void {
  console.assert(typeof boneName === 'string' && boneName.length > 0, 'bone name must be non-empty')

  const node = humanoid.getBoneNode(boneName)
  if (!node) return // Bone not available on this avatar — graceful no-op

  const [x, y, z, w] = eulerToQuaternion(rotation)
  node.quaternion.set(x, y, z, w)
}
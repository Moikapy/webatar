/**
 * Types for VRM integration.
 * These are thin wrappers around @pixiv/three-vrm types to avoid
 * importing Three.js in test environments.
 */

export interface VRMExpressionManager {
  setValue(expressionName: string, weight: number): void
  getValue(expressionName: string): number | null
  update(): void
  readonly expressions: ReadonlyArray<{
    expressionName: string
    isBinary: boolean
    overrideBlink: string
    overrideLookAt: string
    overrideMouth: string
  }>
  readonly expressionMap: Record<string, { expressionName: string }>
}

export interface VRMHumanoid {
  /** Get a normalized bone node by VRM bone name (e.g. 'head', 'neck'). */
  getNormalizedBoneNode(boneName: string): { quaternion: { set: (x: number, y: number, z: number, w: number) => void } } | null
}

export interface VRMInstance {
  scene: unknown
  expressionManager: VRMExpressionManager | null
  humanoid: VRMHumanoid | null
}
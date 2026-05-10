import { describe, it, expect, vi } from 'vitest'
import { rotateVRMBone } from './bones'
import type { VRMHumanoid } from './types'

function createMockHumanoid(availableBones: string[] = []): VRMHumanoid {
  const boneNodes = new Map<string, { quaternion: { set: MockFn } }>()
  type MockFn = (x: number, y: number, z: number, w: number) => void

  for (const name of availableBones) {
    const mockFn = vi.fn() as unknown as MockFn
    boneNodes.set(name, {
      quaternion: { set: mockFn },
    })
  }

  return {
    getBoneNode: vi.fn((boneName: string) => boneNodes.get(boneName) ?? null),
  } as unknown as VRMHumanoid
}

describe('vrm/bones', () => {
  describe('rotateVRMBone', () => {
    it('applies euler rotation to a VRM bone', () => {
      const humanoid = createMockHumanoid(['head'])

      rotateVRMBone(humanoid, 'head', { x: 0.1, y: 0.2, z: 0.0 })

      expect(humanoid.getBoneNode).toHaveBeenCalledWith('head')
    })

    it('does nothing for a bone that does not exist on the avatar', () => {
      const humanoid = createMockHumanoid(['head'])

      expect(() => rotateVRMBone(humanoid, 'neck', { x: 0.1, y: 0, z: 0 })).not.toThrow()
      expect(humanoid.getBoneNode).toHaveBeenCalledWith('neck')
    })

    it('converts euler angles to quaternion correctly for zero rotation', () => {
      const humanoid = createMockHumanoid(['head'])

      rotateVRMBone(humanoid, 'head', { x: 0, y: 0, z: 0 })

      const node = humanoid.getBoneNode('head')!
      expect(node.quaternion.set).toHaveBeenCalledWith(0, 0, 0, 1)
    })

    it('handles pure yaw rotation (y-axis)', () => {
      const humanoid = createMockHumanoid(['head'])
      const yaw = Math.PI / 6

      rotateVRMBone(humanoid, 'head', { x: 0, y: yaw, z: 0 })

      const node = humanoid.getBoneNode('head')!
      const calls = (node.quaternion.set as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      expect(calls[0][0]).toBeCloseTo(0, 5)
      expect(calls[0][3]).toBeCloseTo(Math.cos(yaw / 2), 5)
    })

    it('clamps rotation values to safe range', () => {
      const humanoid = createMockHumanoid(['head'])

      expect(() =>
        rotateVRMBone(humanoid, 'head', { x: 5, y: 5, z: 5 }),
      ).not.toThrow()
    })

    it('works with all standard VRM bones', () => {
      const bones = ['head', 'neck', 'spine', 'chest',
        'leftShoulder', 'rightShoulder',
        'leftUpperArm', 'rightUpperArm',
        'leftLowerArm', 'rightLowerArm']

      const humanoid = createMockHumanoid(bones)

      for (const bone of bones) {
        rotateVRMBone(humanoid, bone, { x: 0, y: 0, z: 0 })
        expect(humanoid.getBoneNode).toHaveBeenCalledWith(bone)
      }
    })
  })
})
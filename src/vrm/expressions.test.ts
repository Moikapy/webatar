import { describe, it, expect, vi } from 'vitest'
import {
  setVRMExpression,
  applyExpressionsToVRM,
} from './expressions'
import type { VRMExpressionManager } from './types'

// Mock VRM expression manager
function createMockManager(expressions: string[] = []): VRMExpressionManager {
  const values: Record<string, number> = {}

  for (const name of expressions) {
    values[name] = 0
  }

  return {
    setValue: vi.fn((name: string, weight: { weight: number }) => {
      values[name] = weight.weight
    }),
    getValue: vi.fn((name: string) => values[name] ?? 0),
    update: vi.fn(),
    expressions: expressions.map((name) => ({
      expressionName: name,
      isBinary: false,
      overrideBlink: 'none' as const,
      overrideLookAt: 'none' as const,
      overrideMouth: 'none' as const,
    })),
    expressionMap: Object.fromEntries(
      expressions.map((name) => [name, { expressionName: name }]),
    ),
  } as unknown as VRMExpressionManager
}

describe('vrm/expressions', () => {
  describe('setVRMExpression', () => {
    it('sets a single expression weight on the VRM manager', () => {
      const manager = createMockManager(['happy', 'sad', 'aa'])
      setVRMExpression(manager, 'happy', 0.8)
      expect(manager.setValue).toHaveBeenCalledWith('happy', { weight: 0.8 })
    })

    it('does not throw for expressions that do not exist on the avatar', () => {
      const manager = createMockManager(['happy'])
      // Should not throw — graceful degradation
      expect(() => setVRMExpression(manager, 'surprised', 0.5)).not.toThrow()
    })

    it('clamps weight to [0, 1]', () => {
      const manager = createMockManager(['happy'])
      setVRMExpression(manager, 'happy', 1.5)
      expect(manager.setValue).toHaveBeenCalledWith('happy', { weight: 1 })

      setVRMExpression(manager, 'happy', -0.2)
      expect(manager.setValue).toHaveBeenCalledWith('happy', { weight: 0 })
    })
  })

  describe('applyExpressionsToVRM', () => {
    it('applies all expression weights to the VRM manager and calls update', () => {
      const manager = createMockManager(['happy', 'aa', 'blinkLeft', 'blinkRight', 'surprised'])

      applyExpressionsToVRM(manager, {
        happy: 0.6,
        aa: 0.8,
        surprised: 0.3,
      })

      expect(manager.setValue).toHaveBeenCalledWith('happy', { weight: 0.6 })
      expect(manager.setValue).toHaveBeenCalledWith('aa', { weight: 0.8 })
      expect(manager.setValue).toHaveBeenCalledWith('surprised', { weight: 0.3 })
      expect(manager.update).toHaveBeenCalled()
    })

    it('resets expressions not in the input to zero (blink off when not blinking)', () => {
      const manager = createMockManager(['happy', 'blinkLeft', 'blinkRight'])

      applyExpressionsToVRM(manager, {
        happy: 0.5,
      })

      // blinkLeft and blinkRight should be set to 0 (eyes open)
      expect(manager.setValue).toHaveBeenCalledWith('blinkLeft', { weight: 0 })
      expect(manager.setValue).toHaveBeenCalledWith('blinkRight', { weight: 0 })
    })

    it('handles empty expression input', () => {
      const manager = createMockManager(['happy', 'sad'])

      applyExpressionsToVRM(manager, {})

      expect(manager.setValue).toHaveBeenCalledWith('happy', { weight: 0 })
      expect(manager.setValue).toHaveBeenCalledWith('sad', { weight: 0 })
      expect(manager.update).toHaveBeenCalled()
    })

    it('skips expressions not available on the avatar', () => {
      const manager = createMockManager(['happy']) // Only 'happy' available

      applyExpressionsToVRM(manager, {
        happy: 0.5,
        surprised: 0.3, // Not available on this avatar
      })

      // Should set happy but NOT call setValue for surprised
      expect(manager.setValue).toHaveBeenCalledWith('happy', { weight: 0.5 })
    })
  })
})
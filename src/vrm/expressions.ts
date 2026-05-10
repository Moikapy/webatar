/**
 * VRM Expression utilities.
 *
 * Applies computed expression weights (from expression-map.ts) to a VRM model's
 * expression manager. Handles missing expressions gracefully (not all avatars
 * have all presets) and resets inactive expressions to zero.
 */

import type { VRMExpressionManager } from './types'

/**
 * Set a single expression weight on the VRM expression manager.
 * Gracefully no-ops if the expression doesn't exist on this avatar.
 *
 * @param manager - VRM expression manager
 * @param name - VRM expression preset name (e.g. 'happy', 'aa', 'blink')
 * @param weight - Weight 0–1, clamped automatically
 */
export function setVRMExpression(
  manager: VRMExpressionManager,
  name: string,
  weight: number,
): void {
  console.assert(typeof name === 'string' && name.length > 0, 'expression name must be non-empty string')
  console.assert(typeof weight === 'number', 'weight must be a number')

  // Check if this expression exists on the avatar
  if (!(name in manager.expressionMap)) return

  // Clamp weight to [0, 1]
  const clampedWeight = Math.max(0, Math.min(1, weight))
  manager.setValue(name, clampedWeight)
}

/**
 * Apply a full set of expression weights to a VRM model.
 *
 * Sets weights for all provided expressions, resets all other
 * expressions on the avatar to 0, and calls update().
 *
 * This is the main entry point for expression animation per frame.
 *
 * @param manager - VRM expression manager
 * @param weights - Expression name → weight mapping (from computeVRMExpressions)
 */
export function applyExpressionsToVRM(
  manager: VRMExpressionManager,
  weights: Readonly<Record<string, number>>,
): void {
  // Track which expressions have been set
  const setExpressions = new Set<string>()

  // Apply provided weights
  for (const [name, weight] of Object.entries(weights)) {
    if (name in manager.expressionMap) {
      manager.setValue(name, Math.max(0, Math.min(1, weight)))
      setExpressions.add(name)
    }
  }

  // Reset all other expressions to 0
  for (const expr of manager.expressions) {
    if (!setExpressions.has(expr.expressionName)) {
      manager.setValue(expr.expressionName, 0)
    }
  }

  // Commit changes
  manager.update()
}
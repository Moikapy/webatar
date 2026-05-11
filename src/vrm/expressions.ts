/**
 * VRM Expression utilities.
 *
 * Applies computed expression weights (from expression-map.ts) to a VRM model's
 * expression manager. Handles missing expressions gracefully (not all avatars
 * have all presets) and resets inactive expressions to zero.
 *
 * Hot-path optimized: avoids per-frame allocations, uses in-place reset.
 */

import type { VRMExpressionManager } from './types'

// Reusable set to avoid allocation per frame
const _setExprNames: string[] = []

/**
 * Set a single expression weight on the VRM expression manager.
 * Gracefully no-ops if the expression doesn't exist on this avatar.
 */
export function setVRMExpression(
  manager: VRMExpressionManager,
  name: string,
  weight: number,
): void {
  // Check if this expression exists on the avatar
  if (!(name in manager.expressionMap)) return

  // Clamp weight to [0, 1]
  manager.setValue(name, Math.max(0, Math.min(1, weight)))
}

/**
 * Apply a full set of expression weights to a VRM model.
 *
 * Sets weights for all provided expressions, resets all other
 * expressions on the avatar to 0, and calls update().
 *
 * Hot-path: reuses _setExprNames array to avoid per-frame allocation.
 */
export function applyExpressionsToVRM(
  manager: VRMExpressionManager,
  weights: Readonly<Record<string, number>>,
): void {
  // Reuse array (clear rather than allocate)
  _setExprNames.length = 0

  // Apply provided weights and track which were set
  const weightEntries = Object.entries(weights)
  for (let i = 0; i < weightEntries.length; i++) {
    const [name, weight] = weightEntries[i]
    if (name in manager.expressionMap) {
      manager.setValue(name, Math.max(0, Math.min(1, weight)))
      _setExprNames.push(name)
    }
  }

  // Reset all other expressions to 0
  const expressions = manager.expressions
  for (let i = 0; i < expressions.length; i++) {
    const exprName = expressions[i].expressionName
    if (_setExprNames.indexOf(exprName) === -1) {
      manager.setValue(exprName, 0)
    }
  }

  // Commit changes
  manager.update()
}
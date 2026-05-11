/**
 * ARKit Blend Shape → VRM Expression mapping.
 *
 * MediaPipe Face Landmarker outputs 52 ARKit-compatible blend shapes.
 * VRM has a fixed set of preset expression names.
 * This module maps between them with composite emotion computation.
 *
 * See Spec.md §6 (Parsers) and Appendix B for the full mapping table.
 */

// ─── Direct ARKit → VRM mapping table ────────────────────────────────

/**
 * Maps ARKit blend shape names to VRM expression preset names.
 * Empty string means no direct mapping (handled by composite functions).
 */
export const ARKIT_TO_VRM: Readonly<Record<string, string>> = {
  // Eyes — direct mappings
  eyeBlinkLeft: 'blinkLeft',
  eyeBlinkRight: 'blinkRight',

  // Gaze — VRM has lookUp/lookDown/lookLeft/lookRight
  // Gaze — VRM has lookUp/lookDown/lookLeft/lookRight
  // eyeLookIn = toward nose (converge): left eye inward = looking Right
  // eyeLookOut = away from nose (diverge): right eye outward = looking Right
  eyeLookDownLeft: 'lookDown',
  eyeLookDownRight: 'lookDown',
  eyeLookInLeft: 'lookRight',
  eyeLookInRight: 'lookLeft',
  eyeLookOutLeft: 'lookLeft',
  eyeLookOutRight: 'lookRight',

  // Mouth — vowel visemes
  jawOpen: 'aa',
  mouthFunnel: 'ou',

  // Emotion — direct contributions
  mouthSmileLeft: 'happy',
  mouthSmileRight: 'happy',
  mouthWideLeft: 'happy',
  mouthWideRight: 'happy',
  mouthFrownLeft: 'sad',
  mouthFrownRight: 'sad',
  browDownLeft: 'angry',
  browDownRight: 'angry',
  noseSneerLeft: 'angry',
  noseSneerRight: 'angry',

  // No direct preset — handled by composites or partial blending
  eyeWideLeft: '',
  eyeWideRight: '',
  eyeSquintLeft: '',
  eyeSquintRight: '',
  browInnerUp: '',
  browOuterUpLeft: '',
  browOuterUpRight: '',
  mouthClose: '',
  mouthLeft: '',
  mouthRight: '',
  mouthDimpleLeft: '',
  mouthDimpleRight: '',
  mouthLowerDownLeft: '',
  mouthLowerDownRight: '',
  mouthPressLeft: '',
  mouthPressRight: '',
  mouthPucker: '',
  mouthRollLower: '',
  mouthRollUpper: '',
  mouthShrugLower: '',
  mouthShrugUpper: '',
  mouthStretchLeft: '',
  mouthStretchRight: '',
  mouthUpperUpLeft: '',
  mouthUpperUpRight: '',
  cheekPuff: '',
  cheekSquintLeft: '',
  cheekSquintRight: '',
  jawForward: '',
  jawLeft: '',
  jawRight: '',
  tongueOut: '',
}

// ─── Composite emotion weights ───────────────────────────────────────

/**
 * Compute composite VRM expressions from ARKit blend shapes.
 * These are emotions that don't have a single ARKit source —
 * they combine multiple blend shapes.
 */
export function computeCompositeExpressions(
  blendShapes: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const surprised =
    (blendShapes.browInnerUp ?? 0) * 0.3 +
    (blendShapes.jawOpen ?? 0) * 0.3 +
    (blendShapes.eyeWideLeft ?? 0) * 0.2 +
    (blendShapes.eyeWideRight ?? 0) * 0.2

  const browOuterUp =
    ((blendShapes.browOuterUpLeft ?? 0) + (blendShapes.browOuterUpRight ?? 0)) / 2
  // Relaxed only activates when brow is raised — not from absence of blink
  const relaxed = browOuterUp > 0
    ? browOuterUp * 0.8 + (1 - (blendShapes.eyeBlinkLeft ?? 0)) * 0.1 + (1 - (blendShapes.eyeBlinkRight ?? 0)) * 0.1
    : 0

  return { surprised, relaxed }
}

// ─── Expression threshold ────────────────────────────────────────────

/** Minimum weight to apply. Below this, set to 0 to eliminate noise. */
export const EXPRESSION_THRESHOLD = 0.02

/**
 * Filter out expression weights below threshold.
 * Prevents micro-twitches from sensor noise.
 */
export function filterNoise(
  expressions: Readonly<Record<string, number>>,
  threshold: number = EXPRESSION_THRESHOLD,
): Record<string, number> {
  const filtered: Record<string, number> = {}
  for (const [key, value] of Object.entries(expressions)) {
    if (value >= threshold) {
      filtered[key] = value
    }
  }
  return filtered
}

// ─── Main solve function ─────────────────────────────────────────────

/**
 * Convert MediaPipe ARKit blend shapes into VRM expression weights.
 *
 * Pipeline: direct mappings → composite emotions → merge → noise filter → clamp.
 *
 * @param blendShapes - 52 ARKit blend shape values (name → weight 0–1)
 * @returns VRM expression weights ready for `vrm.expressionManager.setValue()`
 */
export function computeVRMExpressions(
  blendShapes: Readonly<Record<string, number>>,
): Record<string, number> {
  console.assert(
    typeof blendShapes === 'object' && blendShapes !== null,
    'blendShapes must be an object',
  )

  const vrm: Record<string, number> = {}

  // Step 1: Direct 1:1 mappings with accumulation
  for (const [arkitName, vrmName] of Object.entries(ARKIT_TO_VRM)) {
    if (!vrmName) continue
    const weight = blendShapes[arkitName] ?? 0
    if (weight > 0) {
      vrm[vrmName] = Math.min(1, (vrm[vrmName] ?? 0) + weight)
    }
  }

  // Step 2: Composite emotions (override single-source mappings)
  const composites = computeCompositeExpressions(blendShapes)
  for (const [name, weight] of Object.entries(composites)) {
    if (weight > 0) {
      vrm[name] = Math.min(1, (vrm[name] ?? 0) + weight)
    }
  }

  // Step 3: Filter noise and clamp
  return filterNoise(vrm)
}
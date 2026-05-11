/**
 * Smoothing utilities for face/pose tracking data.
 *
 * Prevents jitter and micro-twitches by applying exponential
 * moving averages (EMA) and interpolation.
 *
 * All functions are pure — no mutations, no side effects.
 * Hot path optimized: no console.assert in production,
 * minimal allocations.
 */

/**
 * Exponential Moving Average (EMA) smoothing.
 * Returns a new value that blends between previous and current.
 */
export function lerp(previous: number, current: number, factor: number): number {
  return previous + (current - previous) * factor
}

/**
 * Smooth a 3D vector using per-component EMA.
 * Returns a new vector — never mutates input.
 */
export function lerpVec3(
  previous: Readonly<{ x: number; y: number; z: number }>,
  current: Readonly<{ x: number; y: number; z: number }>,
  factor: number,
): { x: number; y: number; z: number } {
  return {
    x: lerp(previous.x, current.x, factor),
    y: lerp(previous.y, current.y, factor),
    z: lerp(previous.z, current.z, factor),
  }
}

// ─── Expression smoothing (hot path optimized) ──────────────────────

/**
 * Inline smoothing for expression weights.
 * Mutates the target object in-place to avoid allocation.
 * Only smooths keys present in `current`; decays keys from `previous`
 * that aren't in `current`.
 *
 * @returns The target object (mutated in-place)
 */
export function smoothExpressionsInto(
  previous: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
  target: Record<string, number>,
  factor: number,
): Record<string, number> {
  // Smooth all current keys
  const currentKeys = Object.keys(current)
  for (let i = 0; i < currentKeys.length; i++) {
    const key = currentKeys[i]
    const prev = previous[key] ?? 0
    target[key] = prev + (current[key] - prev) * factor
  }

  // Decay keys that were in previous but not in current
  const prevKeys = Object.keys(previous)
  for (let i = 0; i < prevKeys.length; i++) {
    const key = prevKeys[i]
    if (!(key in current)) {
      const val = previous[key] * (1 - factor)
      if (val < 0.001) {
        delete target[key]
      } else {
        target[key] = val
      }
    }
  }

  return target
}

/**
 * Smooth expression weights. Returns a new record each call.
 * For hot-path usage, prefer smoothExpressionsInto() which reuses a target.
 */
export function smoothExpressions(
  previous: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
  factor: number,
): Record<string, number> {
  return smoothExpressionsInto(previous, current, {}, factor)
}

/**
 * Stabilize blink values to prevent rapid open/close flicker.
 * Uses hysteresis: blink activates only after N frames above closeThreshold,
 * and deactivates only after M frames below openThreshold.
 *
 * Returns the analog average blink weight once blink is confirmed,
 * and 0 when eyes are confirmed open.
 */
export class BlinkStabilizer {
  private closeCount = 0
  private openCount = 0
  private isBlinking = false

  constructor(
    private readonly closeThreshold: number = 0.25,
    private readonly openThreshold: number = 0.75,
    private readonly closeFrames: number = 2,
    private readonly openFrames: number = 2,
  ) {}

  /**
   * Process a raw blink weight and return a stabilized value.
   */
  process(leftBlink: number, rightBlink: number): number {
    const avgBlink = (leftBlink + rightBlink) * 0.5

    if (this.isBlinking) {
      if (avgBlink < this.openThreshold) {
        this.openCount++
        if (this.openCount >= this.openFrames) {
          this.isBlinking = false
          this.closeCount = 0
        }
      } else {
        this.openCount = 0
      }
    } else {
      if (avgBlink > this.closeThreshold) {
        this.closeCount++
        if (this.closeCount >= this.closeFrames) {
          this.isBlinking = true
          this.openCount = 0
        }
      } else {
        this.closeCount = 0
      }
    }

    return this.isBlinking ? avgBlink : 0
  }

  /** Reset stabilizer state */
  reset(): void {
    this.closeCount = 0
    this.openCount = 0
    this.isBlinking = false
  }
}
/**
 * Smoothing utilities for face/pose tracking data.
 *
 * Prevents jitter and micro-twitches by applying exponential
 * moving averages (EMA) and interpolation.
 *
 * All functions are pure — no mutations, no side effects.
 */

/**
 * Exponential Moving Average (EMA) smoothing.
 * Returns a new value that blends between previous and current.
 *
 * @param previous - Last smoothed value
 * @param current - New raw value
 * @param factor - Smoothing factor (0 = no change, 1 = instant snap)
 * @returns Smoothed value
 */
export function lerp(previous: number, current: number, factor: number): number {
  console.assert(typeof previous === 'number', 'previous must be a number')
  console.assert(typeof current === 'number', 'current must be a number')
  console.assert(factor >= 0 && factor <= 1, 'factor must be between 0 and 1')
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

/**
 * Smooth a record of expression weights.
 * Only applies smoothing to keys that exist in both values.
 * Returns a new record — never mutates input.
 *
 * @param previous - Last smoothed expression weights
 * @param current - New raw expression weights
 * @param factor - Smoothing factor (0 = frozen, 1 = instant)
 * @returns Smoothed expression weights
 */
export function smoothExpressions(
  previous: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
  factor: number,
): Record<string, number> {
  const result: Record<string, number> = {}

  // Smooth all current keys
  for (const [key, value] of Object.entries(current)) {
    const prev = previous[key] ?? 0
    result[key] = lerp(prev, value, factor)
  }

  // Decay keys that were in previous but not in current
  for (const key of Object.keys(previous)) {
    if (!(key in result)) {
      result[key] = lerp(previous[key], 0, factor)
      // Remove if decayed below threshold
      if (result[key] < 0.001) {
        delete result[key]
      }
    }
  }

  return result
}

/**
 * Stabilize blink values to prevent rapid open/close flicker.
 * Uses hysteresis: blink activates only after N frames above closeThreshold,
 * and deactivates only after M frames below openThreshold.
 *
 * Returns the **analog** average blink weight once blink is confirmed,
 * and 0 when eyes are confirmed open. This preserves squint/partial blink
 * instead of snapping to binary 0/1.
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
   * @param leftBlink - Raw left eye blink weight (0–1)
   * @param rightBlink - Raw right eye blink weight (0–1)
   * @returns Analog blink weight (0 when open, avg blink weight when blinking)
   */
  process(leftBlink: number, rightBlink: number): number {
    console.assert(leftBlink >= 0 && leftBlink <= 1, 'leftBlink must be 0–1')
    console.assert(rightBlink >= 0 && rightBlink <= 1, 'rightBlink must be 0–1')

    const avgBlink = (leftBlink + rightBlink) / 2

    if (this.isBlinking) {
      // Currently blinking — check if eyes opened enough
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
      // Not blinking — check if eyes closed enough
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

    // Return analog weight: actual blink level when blinking, 0 when open
    return this.isBlinking ? avgBlink : 0
  }

  /** Reset stabilizer state */
  reset(): void {
    this.closeCount = 0
    this.openCount = 0
    this.isBlinking = false
  }
}
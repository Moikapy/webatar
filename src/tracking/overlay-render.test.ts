import { describe, it, expect } from 'vitest'
import { drawFaceLandmarks, drawBlendShapeLabels, type LandmarkStyle, type LabelStyle } from './overlay-render'
import { OVERLAY_DEFAULTS } from '../constants'

/**
 * Create a mock CanvasRenderingContext2D that records all drawing calls.
 * Uses a Proxy to track property sets and method calls.
 */
function createMockCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const state: Record<string, unknown> = {}

  const handlers: Record<string, (...args: unknown[]) => unknown> = {
    save: () => { calls.push('save') },
    restore: () => { calls.push('restore') },
    beginPath: () => { calls.push('beginPath') },
    arc: (...args: unknown[]) => {
      const [x, y, r] = args as [number, number, number]
      calls.push(`arc:${x.toFixed(1)},${y.toFixed(1)},r=${r}`)
    },
    fill: () => { calls.push('fill') },
    fillText: (...args: unknown[]) => {
      const [text] = args as [string, ...unknown[]]
      calls.push(`fillText:${text}`)
    },
    fillRect: () => { calls.push('fillRect') },
    measureText: (...args: unknown[]) => {
      const [text] = args as [string]
      return { width: text.length * 7 }
    },
    clearRect: () => { calls.push('clearRect') },
    drawImage: () => { calls.push('drawImage') },
    translate: () => { calls.push('translate') },
    scale: () => { calls.push('scale') },
  }

  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, prop: string) {
      if (prop in handlers) return handlers[prop]
      if (prop in state) return state[prop]
      // Defaults for commonly accessed properties
      if (prop === 'canvas') return { width: 640, height: 480, clientWidth: 640, clientHeight: 480 }
      return undefined
    },
    set(_target, prop: string, value: unknown) {
      if (prop === 'fillStyle') {
        calls.push(`setFillStyle:${String(value)}`)
      } else if (prop === 'globalAlpha') {
        calls.push(`setGlobalAlpha:${value}`)
      } else if (prop === 'font') {
        calls.push(`setFont:${value}`)
      } else {
        state[prop] = value
      }
      return true
    },
  })

  return { ctx, calls }
}

describe('drawFaceLandmarks', () => {
  const defaultStyle: LandmarkStyle = { ...OVERLAY_DEFAULTS.LANDMARK }

  it('draws one arc per landmark', () => {
    const { ctx, calls } = createMockCtx()
    const landmarks = [
      { x: 0.5, y: 0.5, z: 0 },
      { x: 0.3, y: 0.4, z: 0 },
    ]

    drawFaceLandmarks(ctx, landmarks, defaultStyle, 640, 480)

    const arcCount = calls.filter(c => c.startsWith('arc:')).length
    expect(arcCount).toBe(2)
  })

  it('draws zero arcs for empty landmarks', () => {
    const { ctx, calls } = createMockCtx()

    drawFaceLandmarks(ctx, [], defaultStyle, 640, 480)

    const arcCount = calls.filter(c => c.startsWith('arc:')).length
    expect(arcCount).toBe(0)
  })

  it('scales landmark coordinates to canvas size with mirrorX default', () => {
    const { ctx, calls } = createMockCtx()

    drawFaceLandmarks(ctx, [{ x: 0.5, y: 0.5, z: 0 }], defaultStyle, 640, 480)

    // With mirrorX=true (default), x becomes (1 - 0.5) * 640 = 320
    // y becomes 0.5 * 480 = 240
    const arcCalls = calls.filter(c => c.startsWith('arc:'))
    expect(arcCalls.length).toBe(1)
    expect(arcCalls[0]).toContain('320.0')
    expect(arcCalls[0]).toContain('240.0')
  })

  it('mirrors x-coordinate when mirrorX is true', () => {
    const { ctx, calls } = createMockCtx()

    drawFaceLandmarks(ctx, [{ x: 0.2, y: 0.5, z: 0 }], defaultStyle, 640, 480, true)

    // Mirrored: x = (1 - 0.2) * 640 = 512
    expect(calls).toContain('arc:512.0,240.0,r=2')
  })

  it('does not mirror x-coordinate when mirrorX is false', () => {
    const { ctx, calls } = createMockCtx()

    drawFaceLandmarks(ctx, [{ x: 0.2, y: 0.5, z: 0 }], defaultStyle, 640, 480, false)

    // Not mirrored: x = 0.2 * 640 = 128
    expect(calls).toContain('arc:128.0,240.0,r=2')
  })

  it('calls save and restore for style isolation', () => {
    const { ctx, calls } = createMockCtx()

    drawFaceLandmarks(ctx, [{ x: 0.5, y: 0.5, z: 0 }], defaultStyle, 640, 480)

    expect(calls).toContain('save')
    expect(calls).toContain('restore')
  })

  it('sets fill style and global alpha', () => {
    const { ctx, calls } = createMockCtx()
    const redStyle: LandmarkStyle = { color: '#ff0000', radius: 3, opacity: 0.5 }

    drawFaceLandmarks(ctx, [{ x: 0.5, y: 0.5, z: 0 }], redStyle, 640, 480)

    expect(calls).toContain('setFillStyle:#ff0000')
    expect(calls).toContain('setGlobalAlpha:0.5')
  })
})

describe('drawBlendShapeLabels', () => {
  const defaultStyle: LabelStyle = { ...OVERLAY_DEFAULTS.LABEL }

  it('draws labels for blend shapes above threshold', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, { mouthSmileLeft: 0.72, eyeBlinkLeft: 0.30 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('filters out blend shapes below threshold', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, { jawOpen: 0.01 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    // 0.01 < default threshold 0.02
    expect(textCalls).toHaveLength(0)
  })

  it('limits to maxLabels count', () => {
    const { ctx, calls } = createMockCtx()
    const shapes: Record<string, number> = {}
    for (let i = 0; i < 20; i++) {
      shapes[`shape${i}`] = 0.5
    }

    drawBlendShapeLabels(ctx, shapes, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls.length).toBeLessThanOrEqual(defaultStyle.maxLabels)
  })

  it('sorts blend shapes by weight descending', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, { low: 0.1, high: 0.9, mid: 0.5 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    // First label should be the highest weight
    expect(textCalls[0]).toContain('high')
  })

  it('handles empty blend shapes', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, {}, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls).toHaveLength(0)
  })

  it('formats labels with weight value', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, { mouthSmileLeft: 0.72 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls[0]).toContain('mouthSmileLeft')
    expect(textCalls[0]).toContain('0.72')
  })

  it('calls save and restore for style isolation', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, { mouthSmileLeft: 0.72 }, defaultStyle, 640, 480)

    expect(calls).toContain('save')
    expect(calls).toContain('restore')
  })

  it('draws background rect for each label', () => {
    const { ctx, calls } = createMockCtx()

    drawBlendShapeLabels(ctx, { mouthSmileLeft: 0.72 }, defaultStyle, 640, 480)

    const rectCount = calls.filter(c => c === 'fillRect').length
    expect(rectCount).toBeGreaterThanOrEqual(1)
  })
})
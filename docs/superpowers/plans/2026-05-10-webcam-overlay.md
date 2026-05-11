# Webcam Tracking Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable debug overlay that shows the webcam feed, face mesh landmarks, and blend shape labels over the avatar canvas.

**Architecture:** Pure drawing functions in `overlay-render.ts` unit-tested with vitest, exposed via `useWebatar` hook extension, rendered by a new `WebcamOverlay` React component with three independently toggleable layers (video, landmarks, blend shapes). Toggle UI in the Studio footer.

**Tech Stack:** React 19, TypeScript 5, Canvas 2D API, Vitest, Bun

---

## Task 1: Overlay Render Pure Functions

**Files:**
- Create: `src/tracking/overlay-render.ts`
- Create: `src/tracking/overlay-render.test.ts`
- Modify: `src/tracking/index.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: Add overlay constants to `constants.ts`**

Add the following to the end of `src/constants.ts`:

```typescript
/** Overlay rendering constants */
export const OVERLAY_DEFAULTS = {
  LANDMARK: {
    COLOR: '#10b981',
    RADIUS: 2,
    OPACITY: 0.8,
  },
  LABEL: {
    COLOR: '#ffffff',
    FONT_SIZE: 11,
    LINE_HEIGHT: 16,
    THRESHOLD: 0.02,
    MAX_LABELS: 15,
    BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.6)',
    PADDING_X: 6,
    PADDING_Y: 2,
  },
  VIDEO: {
    DEFAULT_OPACITY: 0.3,
  },
} as const
```

- [ ] **Step 2: Write failing test for `drawFaceLandmarks`**

Create `src/tracking/overlay-render.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drawFaceLandmarks, drawBlendShapeLabels, type LandmarkStyle, type LabelStyle } from './overlay-render'
import { OVERLAY_DEFAULTS } from '../constants'

function createCanvas2D(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')!
  const calls: string[] = []

  // Record method calls without breaking drawing
  const origBeginPath = ctx.beginPath.bind(ctx)
  const origArc = ctx.arc.bind(ctx)
  const origFill = ctx.fill.bind(ctx)
  const origFillText = ctx.fillText.bind(ctx)
  const origFillRect = ctx.fillRect.bind(ctx)
  const origSetProperty = ctx.setProperty
    ? (prop: string, value: string) => { calls.push(`setProperty:${prop}=${value}`); origSetProperty(prop, value) }
    : undefined

  // Wrap to track calls
  ctx.beginPath = () => { calls.push('beginPath'); return origBeginPath() }
  ctx.arc = (x, y, r, s, e, ccw?) => { calls.push(`arc:${x.toFixed(1)},${y.toFixed(1)}`); return origArc(x, y, r, s, e, ccw) }
  ctx.fill = () => { calls.push('fill'); return origFill() }
  ctx.fillText = (text, x, y) => { calls.push(`fillText:${text}`); return origFillText(text, x, y) }
  ctx.fillRect = (x, y, w, h) => { calls.push(`fillRect`); return origFillRect(x, y, w, h) }

  return { ctx, calls }
}

describe('drawFaceLandmarks', () => {
  const defaultStyle: LandmarkStyle = { ...OVERLAY_DEFAULTS.LANDMARK }

  it('draws one arc per landmark', () => {
    const { ctx, calls } = createCanvas2D()
    const landmarks = [
      { x: 0.5, y: 0.5, z: 0 },
      { x: 0.3, y: 0.4, z: 0 },
    ]

    drawFaceLandmarks(ctx, landmarks, defaultStyle, 640, 480)

    const arcCount = calls.filter(c => c.startsWith('arc:')).length
    expect(arcCount).toBe(2)
  })

  it('draws zero arcs for empty landmarks', () => {
    const { ctx, calls } = createCanvas2D()

    drawFaceLandmarks(ctx, [], defaultStyle, 640, 480)

    const arcCount = calls.filter(c => c.startsWith('arc:')).length
    expect(arcCount).toBe(0)
  })

  it('scales landmark coordinates to canvas size', () => {
    const { ctx, calls } = createCanvas2D()

    drawFaceLandmarks(ctx, [{ x: 0.5, y: 0.5, z: 0 }], defaultStyle, 640, 480)

    // x should be 0.5 * 640 = 320, y should be 0.5 * 480 = 240
    expect(calls).toContain('arc:320.0,240.0')
  })

  it('mirrors x-coordinate to match video mirror', () => {
    const { ctx, calls } = createCanvas2D()

    drawFaceLandmarks(ctx, [{ x: 0.2, y: 0.5, z: 0 }], defaultStyle, 640, 480, true)

    // Mirrored: x = (1 - 0.2) * 640 = 512
    expect(calls).toContain('arc:512.0,240.0')
  })

  it('uses the specified color and opacity', () => {
    const { ctx } = createCanvas2D()
    const style: LandmarkStyle = { color: '#ff0000', radius: 3, opacity: 0.5 }

    drawFaceLandmarks(ctx, [{ x: 0.5, y: 0.5, z: 0 }], style, 640, 480)

    // Should set fillStyle with the color and opacity
    expect(ctx.fillStyle).toContain('ff0000')
  })
})

describe('drawBlendShapeLabels', () => {
  const defaultStyle: LabelStyle = { ...OVERLAY_DEFAULTS.LABEL }

  it('draws labels for blend shapes above threshold', () => {
    const { ctx, calls } = createCanvas2D()

    drawBlendShapeLabels(ctx, { mouthSmileLeft: 0.72, eyeBlinkLeft: 0.30 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('filters out blend shapes below threshold', () => {
    const { ctx, calls } = createCanvas2D()

    drawBlendShapeLabels(ctx, { jawOpen: 0.01 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    // 0.01 < default threshold 0.02
    expect(textCalls).toHaveLength(0)
  })

  it('limits to maxLabels count', () => {
    const { ctx, calls } = createCanvas2D()
    const shapes: Record<string, number> = {}
    for (let i = 0; i < 20; i++) {
      shapes[`shape${i}`] = 0.5
    }

    drawBlendShapeLabels(ctx, shapes, defaultStyle, 640, 480)

    // Should only render maxLabels (15) shape entries
    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    // Each label = 1 fillText call for the text itself
    expect(textCalls.length).toBeLessThanOrEqual(defaultStyle.maxLabels)
  })

  it('sorts blend shapes by weight descending', () => {
    const { ctx, calls } = createCanvas2D()

    drawBlendShapeLabels(ctx, { low: 0.1, high: 0.9, mid: 0.5 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    // First label should be the highest weight
    expect(textCalls[0]).toContain('high')
  })

  it('handles empty blend shapes', () => {
    const { ctx, calls } = createCanvas2D()

    drawBlendShapeLabels(ctx, {}, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls).toHaveLength(0)
  })

  it('formats labels with weight value', () => {
    const { ctx, calls } = createCanvas2D()

    drawBlendShapeLabels(ctx, { mouthSmileLeft: 0.72 }, defaultStyle, 640, 480)

    const textCalls = calls.filter(c => c.startsWith('fillText:'))
    expect(textCalls[0]).toContain('mouthSmileLeft')
    expect(textCalls[0]).toContain('0.72')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src/tracking/overlay-render.test.ts`
Expected: FAIL — module `./overlay-render` does not exist yet.

- [ ] **Step 4: Implement `overlay-render.ts`**

Create `src/tracking/overlay-render.ts`:

```typescript
/**
 * Overlay rendering — pure drawing functions for face tracking debug overlay.
 *
 * Draws face mesh landmarks and blend shape labels on a 2D canvas.
 * All functions are pure: take a context and data, draw, return void.
 * No side effects beyond Canvas API drawing calls.
 */

export interface LandmarkStyle {
  color: string
  radius: number
  opacity: number
}

export interface LabelStyle {
  color: string
  fontSize: number
  lineHeight: number
  threshold: number
  maxLabels: number
  backgroundColor: string
  paddingX: number
  paddingY: number
}

/**
 * Draw face mesh landmarks as dots on a 2D canvas.
 *
 * @param ctx - Canvas 2D rendering context
 * @param landmarks - Array of { x, y, z } in normalized [0,1] coordinates
 * @param style - Visual style for the dots
 * @param canvasWidth - Canvas pixel width for coordinate scaling
 * @param canvasHeight - Canvas pixel height for coordinate scaling
 * @param mirrorX - Mirror x-coordinates (set true to match mirrored video)
 */
export function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>,
  style: LandmarkStyle,
  canvasWidth: number,
  canvasHeight: number,
  mirrorX: boolean = true,
): void {
  if (landmarks.length === 0) return

  ctx.save()
  ctx.fillStyle = style.color
  ctx.globalAlpha = style.opacity

  for (const lm of landmarks) {
    const x = mirrorX ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth
    const y = lm.y * canvasHeight

    ctx.beginPath()
    ctx.arc(x, y, style.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Draw active blend shape labels with weights on a 2D canvas.
 *
 * Labels are drawn in the top-left corner, sorted by weight descending.
 * Shapes below the threshold are filtered out.
 *
 * @param ctx - Canvas 2D rendering context
 * @param blendShapes - Name→weight map of active blend shapes
 * @param style - Visual style for the labels
 * @param canvasWidth - Canvas pixel width (unused, for future layout)
 * @param canvasHeight - Canvas pixel height (unused, for future layout)
 */
export function drawBlendShapeLabels(
  ctx: CanvasRenderingContext2D,
  blendShapes: Readonly<Record<string, number>>,
  style: LabelStyle,
  _canvasWidth: number,
  _canvasHeight: number,
): void {
  if (Object.keys(blendShapes).length === 0) return

  // Filter and sort by weight descending
  const entries = Object.entries(blendShapes)
    .filter(([, weight]) => weight >= style.threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, style.maxLabels)

  if (entries.length === 0) return

  ctx.save()
  ctx.globalAlpha = 1
  ctx.font = `${style.fontSize}px monospace`

  const startX = 8
  let yPos = style.lineHeight + 4

  for (const [name, weight] of entries) {
    const label = `${name}: ${weight.toFixed(2)}`
    const textMetrics = ctx.measureText(label)
    const textWidth = textMetrics.width

    // Background pill
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(
      startX - style.paddingX,
      yPos - style.fontSize - style.paddingY,
      textWidth + style.paddingX * 2,
      style.fontSize + style.paddingY * 2,
    )

    // Label text
    ctx.fillStyle = style.color
    ctx.fillText(label, startX, yPos)

    yPos += style.lineHeight
  }

  ctx.restore()
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/tracking/overlay-render.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Update tracking barrel export**

Modify `src/tracking/index.ts` to add:

```typescript
export { drawFaceLandmarks, drawBlendShapeLabels } from './overlay-render'
export type { LandmarkStyle, LabelStyle } from './overlay-render'
```

- [ ] **Step 7: Commit**

```bash
git add src/tracking/overlay-render.ts src/tracking/overlay-render.test.ts src/tracking/index.ts src/constants.ts
git commit -m "feat: overlay render pure functions for face landmarks and blend shape labels"
```

---

## Task 2: Expose Tracking Result from useWebatar Hook

**Files:**
- Modify: `src/hooks/useWebatar.ts`
- Modify: `src/engine/WebatarEngine.ts`

- [ ] **Step 1: Write failing test for tracking result exposure**

This is a change to the React hook. The test should verify `latestTrackingResult` is in the return type. However, since the hook depends on browser APIs and we don't have React testing utilities set up, we'll test this via the engine instead.

Add a test to `src/engine/WebatarEngine.test.ts`:

```typescript
it('stores and exposes latest tracking result via processFaceFrame', () => {
  const engine = new WebatarEngine({ canvas: document.createElement('canvas') })
  const blendShapes = { eyeBlinkLeft: 0.5, jawOpen: 0.3 }
  engine.processFaceFrame(blendShapes)
  expect(engine.currentState.faceDetected).toBe(true)
  expect(engine.currentState.trackingQuality).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/engine/WebatarEngine.test.ts`
Expected: PASS (this is testing existing engine behavior, not new behavior yet)

Actually, we need to test that `latestTrackingResult` is exposed. Let me check what the engine already does.

The engine doesn't currently store the raw tracking result. We need to:
1. Add `latestTrackingResult` to `WebatarEngine`
2. Expose it via `useWebatar` return type

Let me adjust the test approach — since we can't easily test React hooks without a test renderer, we'll test the engine change and then verify the hook types compile.

- [ ] **Step 3: Add `lastBlendShapes` to WebatarEngine state**

The engine already stores `lastExpressions` (smoothed VRM expressions) and `lastHeadRotation`, but not the raw blend shapes from tracking. We need to expose the raw blend shapes for the blend shape labels overlay.

Add to `WebatarEngine`:

```typescript
// In the class, add a new private field:
private lastBlendShapes: Record<string, number> = {}

// Add a getter:
get currentBlendShapes(): Record<string, number> {
  return { ...this.lastBlendShapes }
}

// In processFaceFrame, before processing, store:
processFaceFrame(blendShapes: Readonly<Record<string, number>>): void {
  this.lastBlendShapes = { ...blendShapes }
  // ... rest of existing method
}
```

- [ ] **Step 4: Expose `lastBlendShapes` in the hook return type**

In `src/hooks/useWebatar.ts`, add `latestBlendShapes` to the return interface and state:

```typescript
export interface UseWebatarReturn {
  state: WebatarState
  isReady: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
  destroy: () => void
  latestBlendShapes: Record<string, number>  // NEW
  latestHeadRotation: { x: number; y: number; z: number }  // NEW
}

// In the hook implementation, add state:
const [latestBlendShapes, setLatestBlendShapes] = useState<Record<string, number>>({})
const [latestHeadRotation, setLatestHeadRotation] = useState({ x: 0, y: 0, z: 0 })

// In the tracking interval callback, after processing:
const results = tracker.processFrame(video, now)
if (results) {
  engine.processFaceFrame(results.blendShapes)
  engine.processHeadRotation(results.headRotation)
  // Update overlay data
  setLatestBlendShapes(results.blendShapes)
  setLatestHeadRotation(results.headRotation)
}

// Return both:
return {
  state: uiState,
  isReady,
  error,
  start,
  stop,
  destroy,
  latestBlendShapes,
  latestHeadRotation,
}
```

- [ ] **Step 5: Run all tests to verify nothing broke**

Run: `bun test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/WebatarEngine.ts src/hooks/useWebatar.ts
git commit -m "feat: expose raw blend shapes and head rotation from hook for overlay"
```

---

## Task 3: WebcamOverlay React Component

**Files:**
- Create: `src/components/WebcamOverlay.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the WebcamOverlay component**

Create `src/components/WebcamOverlay.tsx`:

```typescript
/**
 * WebcamOverlay — Toggleable debug overlay showing webcam feed,
 * face mesh landmarks, and blend shape labels over the avatar canvas.
 *
 * Renders three independent layers controlled by the `layers` prop:
 *   - video: semi-transparent webcam feed
 *   - landmarks: face mesh dots
 *   - blendShapes: active blend shape names + weights
 */

import { useRef, useEffect, useCallback } from 'react'
import { drawFaceLandmarks, drawBlendShapeLabels } from '../tracking/overlay-render'
import { OVERLAY_DEFAULTS } from '../constants'
import type { FaceLandmark } from '../tracking/face-tracker'
import type { LandmarkStyle, LabelStyle } from '../tracking/overlay-render'

export interface OverlayLayers {
  video: boolean
  landmarks: boolean
  blendShapes: boolean
}

interface WebcamOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>
  blendShapes: Readonly<Record<string, number>>
  layers: OverlayLayers
  videoOpacity?: number
  className?: string
}

/**
 * WebcamOverlay renders the debug overlay on top of the avatar canvas.
 * Each layer (video, landmarks, blend shapes) is independently toggleable.
 *
 * The overlay canvas runs its own rAF loop synced to tracking data updates,
 * not to the 60fps Three.js render loop.
 */
export function WebcamOverlay({
  videoRef,
  landmarks,
  blendShapes,
  layers,
  videoOpacity = OVERLAY_DEFAULTS.VIDEO.DEFAULT_OPACITY,
  className,
}: WebcamOverlayProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  const drawFrame = useCallback(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Resize canvas backing store if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Draw landmarks
    if (layers.landmarks && landmarks.length > 0) {
      const landmarkStyle: LandmarkStyle = { ...OVERLAY_DEFAULTS.LANDMARK }
      drawFaceLandmarks(ctx, landmarks, landmarkStyle, width, height, true)
    }

    // Draw blend shape labels
    if (layers.blendShapes && Object.keys(blendShapes).length > 0) {
      const labelStyle: LabelStyle = { ...OVERLAY_DEFAULTS.LABEL }
      drawBlendShapeLabels(ctx, blendShapes, labelStyle, width, height)
    }
  }, [landmarks, blendShapes, layers.landmarks, layers.blendShapes])

  useEffect(() => {
    let active = true

    const loop = () => {
      if (!active) return
      drawFrame()
      rafRef.current = requestAnimationFrame(loop)
    }

    if (layers.landmarks || layers.blendShapes) {
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      active = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [drawFrame, layers.landmarks, layers.blendShapes])

  // Sync video opacity
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.style.opacity = layers.video ? String(videoOpacity) : '0'
      video.style.position = layers.video ? 'absolute' : ''
      video.style.top = layers.video ? '0' : ''
      video.style.left = layers.video ? '0' : ''
      video.style.width = layers.video ? '100%' : ''
      video.style.height = layers.video ? '100%' : ''
      video.style.objectFit = layers.video ? 'cover' : ''
      video.style.zIndex = layers.video ? '10' : ''
      video.style.transform = layers.video ? 'scaleX(-1)' : ''
      video.style.pointerEvents = layers.video ? 'none' : ''
      video.style.transition = 'opacity 0.2s ease'
    }
  }, [videoRef, layers.video, videoOpacity])

  return (
    <canvas
      ref={overlayCanvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    />
  )
}
```

- [ ] **Step 2: Wire up WebcamOverlay in App.tsx**

Modify `src/App.tsx`:

Add import at top:
```typescript
import { WebcamOverlay, type OverlayLayers } from './components/WebcamOverlay'
```

Add state inside `App()` after existing state declarations:
```typescript
const [overlayLayers, setOverlayLayers] = useState<OverlayLayers>({
  video: false,
  landmarks: false,
  blendShapes: false,
})
```

Destructure the new hook return values:
```typescript
const { state, error, start, stop, destroy, latestBlendShapes, latestHeadRotation } = useWebatar(
  canvasRef,
  videoRef,
  avatarUrl ?? undefined,
)
```

Wait — we also need landmarks from the tracking loop. The hook currently only exposes blend shapes and head rotation, not landmarks. Let me think about the best approach.

Actually, looking back at the `FaceTrackingResult` type from `face-tracker.ts`, it includes `landmarks`. We need to also expose landmarks from the hook. Let me update Task 2 to also expose landmarks.

Revised: Add `latestLandmarks` to the hook return as well.

In `useWebatar.ts`, add:
```typescript
const [latestLandmarks, setLatestLandmarks] = useState<ReadonlyArray<{ x: number; y: number; z: number }>>([])

// In tracking interval:
if (results) {
  setLatestLandmarks(results.landmarks)
}

// Return:
return {
  // ... existing
  latestBlendShapes,
  latestHeadRotation,
  latestLandmarks,
}
```

Update the `UseWebatarReturn` interface:
```typescript
latestBlendShapes: Record<string, number>
latestHeadRotation: { x: number: y: number; z: number }
latestLandmarks: ReadonlyArray<{ x: number; y: number; z: number }>
```

Now add the overlay component to the JSX. In the Studio view's avatar canvas section, wrap the canvas with a relative container and add the overlay:

Find the section with:
```tsx
<div className="relative w-full max-w-3xl">
  <canvas
    ref={canvasRef}
    id="avatar-canvas"
    className="aspect-square w-full rounded-lg bg-muted"
  />
</div>
```

Replace with:
```tsx
<div className="relative w-full max-w-3xl">
  <canvas
    ref={canvasRef}
    id="avatar-canvas"
    className="aspect-square w-full rounded-lg bg-muted"
  />
  <WebcamOverlay
    videoRef={videoRef}
    landmarks={latestLandmarks}
    blendShapes={latestBlendShapes}
    layers={overlayLayers}
    className="aspect-square w-full rounded-lg"
  />
</div>
```

Add overlay toggle buttons in the Studio controls footer, after the existing buttons:

```tsx
{/* Debug overlay toggles */}
{(state.status === 'tracking') && (
  <div className="flex items-center gap-1 ml-4">
    <button
      className={`px-2 py-1 text-xs rounded ${overlayLayers.video ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
      onClick={() => setOverlayLayers(prev => ({ ...prev, video: !prev.video }))}
    >
      🎥 Video
    </button>
    <button
      className={`px-2 py-1 text-xs rounded ${overlayLayers.landmarks ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
      onClick={() => setOverlayLayers(prev => ({ ...prev, landmarks: !prev.landmarks }))}
    >
      📍 Landmarks
    </button>
    <button
      className={`px-2 py-1 text-xs rounded ${overlayLayers.blendShapes ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
      onClick={() => setOverlayLayers(prev => ({ ...prev, blendShapes: !prev.blendShapes }))}
    >
      🏷️ Shapes
    </button>
  </div>
)}
```

- [ ] **Step 3: Move the video element into the avatar canvas container**

The current `<video>` element lives in the sidebar Camera panel. For the overlay to work, the video element needs to be inside the same positioned container as the overlay canvas. We'll keep the sidebar video for the non-overlay view and move the video ref into the canvas container when overlay is active.

Actually, looking more carefully — the video element is used both for display (sidebar) and for MediaPipe processing (input to the tracker). The overlay video approach doesn't need to move the video element — it just needs the video to be visible above the canvas. But the video is currently in a different section of the DOM (the sidebar).

The cleanest approach: the `WebcamOverlay` component manages its own positioning of the video overlay by directly styling the `videoRef` element. When `layers.video` is true, it positions the video absolutely over the canvas. When false, it lets the video be in its normal sidebar position.

This means we need to conditionally style the video element. The current video has `style={{ transform: 'scaleX(-1)' }}`. We need to:
1. Keep the video in the sidebar when overlay video is OFF
2. Overlay the video on the canvas when overlay video is ON

The simplest approach: the `WebcamOverlay` component already applies styles to the video element when `layers.video` is true. When false, it resets the styles. The sidebar video will naturally show the webcam when not overlaid.

Actually, there's a problem — a single `<video>` element can't be in two places at once. We need to either:
1. Move the video into the overlay container (and remove it from the sidebar when overlay is active)
2. Use CSS to position it appropriately

The simplest approach that works: keep the video in the sidebar as-is. When `layers.video` is ON, apply `position: absolute` overlay styles to the video element and set its parent container relative. But the video is inside the sidebar `<aside>`, not inside the canvas container.

Better approach: **move the `<video>` element into the same container as the canvas**. The sidebar can show a reduced placeholder or just hide the camera panel when overlay is active. This is cleaner.

Actually, the simplest correct approach: put the video in the canvas container, and in the sidebar, just don't show the video separately. The webcam video only needs to appear once — either in the sidebar or overlaid on the canvas. When overlay video is OFF, the video stays in the sidebar. When ON, the video overlays the canvas.

But React can't render the same element in two places. We need to use a CSS approach or restructure.

Let me think about this differently. The simplest approach that avoids DOM confusion:

1. Keep the `<video>` in the sidebar (it's needed for MediaPipe input regardless)
2. In the `WebcamOverlay`, when `layers.video` is true, DON'T move the video — instead, use the overlay canvas to draw the video frames using `drawImage(video, ...)`. This avoids DOM positioning issues entirely.

This is actually better! The overlay canvas already has a 2D context we're using for landmarks. We can draw the video frames onto it first, then landmarks on top. No need to move the video element at all.

Let me revise the WebcamOverlay component to draw video frames on the overlay canvas when the video layer is active:

```typescript
// In the drawFrame callback, add video drawing at the start:
const drawFrame = useCallback(() => {
  const canvas = overlayCanvasRef.current
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.clientWidth
  const height = canvas.clientHeight

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  ctx.clearRect(0, 0, width, height)

  // Draw video frame as background
  if (layers.video) {
    const video = videoRef.current
    if (video && video.readyState >= 2) {
      ctx.save()
      ctx.globalAlpha = videoOpacity
      // Mirror the video horizontally to match the landmark mirroring
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, width, height)
      ctx.restore()
    }
  }

  // Draw landmarks
  if (layers.landmarks && landmarks.length > 0) {
    drawFaceLandmarks(ctx, landmarks, { ...OVERLAY_DEFAULTS.LANDMARK }, width, height, true)
  }

  // Draw blend shape labels
  if (layers.blendShapes && Object.keys(blendShapes).length > 0) {
    drawBlendShapeLabels(ctx, blendShapes, { ...OVERLAY_DEFAULTS.LABEL }, width, height)
  }
}, [videoRef, landmarks, blendShapes, layers, videoOpacity])
```

This approach means:
- The `<video>` element stays in the sidebar for its normal display
- The overlay canvas draws the video frame + landmarks + labels on top of the avatar
- No DOM manipulation needed
- The video element is still used by MediaPipe for tracking (unchanged)

This is cleaner. The `WebcamOverlay` component becomes a single overlay canvas that handles all three layers: video (via drawImage), landmarks, and blend shapes.

Let me update the component to remove the video element styling effect and use drawImage instead.

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: ALL PASS

- [ ] **Step 5: Run build**

Run: `bun run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/components/WebcamOverlay.tsx src/hooks/useWebatar.ts src/App.tsx
git commit -m "feat: WebcamOverlay component with video, landmarks, and blend shape layers"
```

---

## Task 4: Final Integration and Testing

**Files:**
- All modified/new files

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: ALL PASS, 0 failures

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: exit 0

- [ ] **Step 3: Run type checking**

Run: `bun run typecheck`
Expected: exit 0, no type errors

- [ ] **Step 4: Update wiki**

```bash
# Ingest recent changes into the wiki
wiki_ingest
```

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for webcam overlay"
```

---
# Webcam Tracking Overlay — Design Spec

> Toggleable debug overlay showing the webcam feed, face mesh landmarks, and active blend shape labels over the avatar canvas. Layered independently toggleable so developers can verify tracking accuracy and debug expression mapping.

---

## 1. Problem

When face tracking doesn't match the avatar (wrong expression, jittery head, missed blinks), there's no way to see *why*. You can see the webcam in the sidebar and the avatar in the main view, but you can't overlay them or see what MediaPipe is actually detecting. This makes debugging expression mapping painful — you're guessing whether the issue is in tracking, smoothing, or the VRM mapping.

## 2. Solution

A three-layer debug overlay, each layer independently toggleable:

| Layer | Content | Purpose |
|-------|---------|---------|
| **Video** | Semi-transparent webcam feed overlaid on the 3D canvas | Broadly compare your movements to the avatar |
| **Landmarks** | 478 face mesh dots drawn on a transparent canvas | Verify MediaPipe is tracking the right points |
| **Blend Shapes** | Active blend shape names + weights as text | Debug expression mapping — see exactly what was detected |

The overlay sits on top of the 3D canvas in the Studio view, toggled by a debug button in the controls footer.

## 3. Architecture

### New Files

```
src/
├── tracking/
│   └── overlay-render.ts          # Pure drawing functions (landmarks + blend shapes)
│   └── overlay-render.test.ts     # Unit tests for drawing functions
├── components/
│   └── WebcamOverlay.tsx           # React overlay component
│   └── WebcamOverlay.test.tsx      # Component tests
└── hooks/
    └── useWebatar.ts              # Extended: expose latestTrackingResult
```

### Data Flow

```
FaceTracker.processFrame()
  → FaceTrackingResult { blendShapes, headRotation, landmarks, faceDetected }
    → WebatarEngine (existing pipeline: smoothing → VRM)
    → useWebatar.latestTrackingResult (NEW: exposed to React)
      → WebcamOverlay (reads landmarks + blendShapes)
        → drawFaceLandmarks() on overlay canvas
        → drawBlendShapeLabels() on overlay canvas
```

No changes to the tracking pipeline. The overlay reads the same `FaceTrackingResult` that already flows through `useWebatar`.

### Component Hierarchy

```
<div class="relative"> <!-- overlay container, sizes with canvas -->
  <canvas ref={canvasRef} />           <!-- existing 3D avatar canvas -->
  <video ref={videoRef} class="overlay-video" /> <!-- webcam overlay, CSS positioned -->
  <canvas ref={overlayCanvasRef} />     <!-- 2D canvas for landmarks + labels -->
</div>
```

The `<video>` element (already in the DOM for tracking) gets a second rendering via CSS `position: absolute; opacity` over the 3D canvas. The overlay canvas draws landmarks and blend shape text on top of that.

## 4. API

### `overlay-render.ts` — Pure Drawing Functions

```typescript
interface LandmarkStyle {
  color: string
  radius: number
  opacity: number
}

interface LabelStyle {
  color: string
  fontSize: number
  lineHeight: number
  threshold: number      // only show blend shapes above this weight
  maxLabels: number       // limit labels displayed (performance)
}

interface DrawOptions {
  landmarks: LandmarkStyle
  labels: LabelStyle
  videoWidth: number
  videoHeight: number
}

/** Draw face mesh landmarks as dots on a 2D canvas context */
function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>,
  options: DrawOptions,
): void

/** Draw active blend shape labels with weights */
function drawBlendShapeLabels(
  ctx: CanvasRenderingContext2D,
  blendShapes: Readonly<Record<string, number>>,
  options: DrawOptions,
): void
```

Both are pure functions — take a canvas context and data, draw, return void. No side effects beyond drawing. Easy to unit test by verifying pixel output or call sequences.

### `WebcamOverlay.tsx` — React Component

```typescript
interface WebcamOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  trackingResult: FaceTrackingResult | null
  layers: {
    video: boolean
    landmarks: boolean
    blendShapes: boolean
  }
  videoOpacity?: number    // 0–1, default 0.3
  className?: string
}
```

The component renders:
1. The `<video>` element (same source as sidebar video, CSS overlap)
2. A `<canvas>` element sized to match the avatar canvas
3. In `requestAnimationFrame`, calls `drawFaceLandmarks()` and `drawBlendShapeLabels()` if their layers are active

### `useWebatar.ts` — Extended Return Type

```typescript
interface UseWebatarReturn {
  // ... existing fields ...
  latestTrackingResult: FaceTrackingResult | null  // NEW
}
```

The hook already has `trackerRef` and the interval that calls `tracker.processFrame()`. We store the latest result in a ref and expose it. No render loop changes — the `WebcamOverlay` component runs its own rAF for drawing.

## 5. UI Design

### Debug Toggle in Studio Footer

The controls footer in the Studio tab gets a new toggle group:

```
[ Stop ] [ Reset ]          [ 🎥 Video ] [ 📍 Landmarks ] [ 🏷️ Shapes ]
```

Each layer toggle is an independent button with active/inactive state. When inactive, the overlay layer is hidden. All three default to inactive (no overlay — clean avatar view).

### Overlay Behavior

- **Video layer**: `<video>` element positioned absolutely over the 3D canvas, with `opacity: 0.3` (configurable). Mirror-flipped (`scaleX(-1)`) like the sidebar video.
- **Landmarks layer**: 478 dots (small circles) at each face mesh point. Color: `#10b981` (project emerald green). Each dot is `2px` radius, drawn every frame.
- **Blend shapes layer**: Top-left corner, stacked labels showing active blend shapes above a threshold (default 0.02). Format: `mouthSmileLeft: 0.72`. Max 15 labels. Sorted by weight descending. Color: white with dark background pill.

### When Tracking is Inactive

All overlay layers are hidden (no video, no landmarks, no labels). The toggles remain visible but disabled.

## 6. Performance Considerations

- **Landmark drawing**: 478 circles per frame at 30fps. Canvas 2D `arc()` is fast — ~0.5ms per frame on the target hardware (Ryzen 2600). Acceptable.
- **Blend shape labels**: Max 15 text draws per frame. Negligible.
- **Video overlay**: Browser composites the video element natively — no performance impact beyond the GPU composition.
- **Overlay canvas**: Only redraws when tracking is active and a layer is enabled. A `requestAnimationFrame` loop in `WebcamOverlay` synced to the tracking interval, not the 60fps render loop.
- **Memory**: `FaceTrackingResult` is already created per frame by `FaceTracker`. Storing a reference in the hook adds zero allocation.

## 7. Testing Strategy

### Unit Tests (`overlay-render.test.ts`)

- `drawFaceLandmarks` draws correct number of arcs for valid landmarks
- `drawFaceLandmarks` skips drawing when landmarks array is empty
- `drawFaceLandmarks` respects style options (color, radius, opacity)
- `drawBlendShapeLabels` filters shapes below threshold
- `drawBlendShapeLabels` limits to maxLabels count
- `drawBlendShapeLabels` sorts by weight descending
- `drawBlendShapeLabels` formats label text correctly

### Component Tests (`WebcamOverlay.test.tsx`)

- Renders overlay canvas when tracking is active
- Hides all layers when tracking is inactive
- Toggles each layer independently
- Cleans up rAF on unmount

### Integration

- Existing `useWebatar` tests continue passing
- Manual QA: toggle each layer, verify visual output matches expectations

## 8. Default Styles

```typescript
const DEFAULT_LANDMARK_STYLE: LandmarkStyle = {
  color: '#10b981',   // emerald-500 (matches project accent)
  radius: 2,
  opacity: 0.8,
}

const DEFAULT_LABEL_STYLE: LabelStyle = {
  color: '#ffffff',
  fontSize: 11,
  lineHeight: 16,
  threshold: 0.02,    // same as EXPRESSION_THRESHOLD
  maxLabels: 15,
}
```

Constants go in `constants.ts` alongside existing tracking config.

## 9. Out of Scope (Future)

- Pose skeleton overlay (when pose tracking is added)
- Recording/screenshot of overlay data
- Performance profiling overlay (FPS graph, frame timing)
- Per-landmark confidence visualization
- Adjustable landmark/label colors via UI
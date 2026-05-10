# Webatar — Spec.md

> Webcam-driven real-time animation of open-source 3D VRM avatars using MediaPipe face tracking, Kalidokit, and Three.js.

---

## 1. Overview

**Webatar** is a browser-based application that captures webcam input and maps facial expressions, head rotation, and body movement onto VRM avatars from [Open Source Avatars](https://www.opensourceavatars.com/). The MVP focuses on the 100 Avatars R1–R3 collections (300 CC0 avatars), with expansion to all OSA collections planned.

**Core loop:** Webcam → MediaPipe Face/Pose Landmarker → Kalidokit kinematic solver → VRM expression weights & bone rotations → Three.js render.

**Key differentiators:**
- Zero-install browser app (no native dependencies)
- Works with any VRM model from the OSA registry via their JSON API
- Real-time facial expression mapping (52 ARKit blend shapes → VRM expressions)
- Pose tracking for upper-body animation
- Avatar gallery with instant switching

---

## 2. Package

| Field | Value |
|-------|-------|
| **Name** | `webatar` |
| **Runtime** | Browser (Chrome 90+, Edge 90+, Firefox 90+, Safari 15+) |
| **Bundler** | Vite 6 |
| **Framework** | React 19 + TypeScript 5 |
| **3D Engine** | Three.js r180+ |
| **Package manager** | `bun` |
| **License** | MIT (code), CC0 (avatars) |

---

## 3. Client API

### Top-level exports

```typescript
// Core engine
export { WebatarEngine } from './engine'
export type { WebatarConfig, WebatarState } from './engine'

// React hooks
export { useWebatar } from './hooks/useWebatar'
export { useAvatarGallery } from './hooks/useAvatarGallery'
export { useFaceTracking } from './hooks/useFaceTracking'

// OSA registry client
export { OSAClient } from './osa/client'
export type { Project, Avatar } from './osa/types'

// VRM utilities
export { loadVRM, setVRMExpression, rotateVRMBone } from './vrm/utils'
```

### `WebatarEngine` — Main orchestrator

```typescript
class WebatarEngine {
  constructor(config: WebatarConfig)

  // Lifecycle
  async init(): Promise<void>
  start(): void
  stop(): void
  destroy(): void

  // Avatar management
  async loadAvatar(url: string): Promise<VRM>
  switchAvatar(avatarId: string): Promise<void>

  // State
  readonly state: WebatarState
  onStateChange(callback: (state: WebatarState) => void): () => void
}

interface WebatarConfig {
  canvas: HTMLCanvasElement
  video?: HTMLVideoElement          // Optional: provide your own webcam element
  cameraPosition?: [number, number, number]
  cameraFov?: number
  enablePoseTracking?: boolean      // Default: true
  enableHandTracking?: boolean      // Default: false (costs more CPU)
  smoothingFactor?: number          // 0–1, default 0.3
  debugOverlay?: boolean            // Show tracking landmarks
}

interface WebatarState {
  status: 'idle' | 'initializing' | 'tracking' | 'error' | 'stopped'
  currentAvatarId: string | null
  availableAvatars: Avatar[]
  fps: number
  faceDetected: boolean
  trackingQuality: number           // 0–1 confidence
  error: string | null
}
```

### `useWebatar` — React hook

```typescript
function useWebatar(config: WebatarConfig): {
  engine: WebatarEngine | null
  state: WebatarState
  loadAvatar: (url: string) => Promise<void>
  switchAvatar: (id: string) => Promise<void>
  startTracking: () => Promise<void>
  stopTracking: () => void
}
```

---

## 4. Zod Schemas / Types

```typescript
import { z } from 'zod'

// OSA Registry types (matching their API)
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  creator_id: z.string(),
  description: z.string(),
  is_public: z.boolean(),
  license: z.enum(['CC0', 'CC-BY']),
  source_type: z.enum(['original', 'nft']),
  storage_type: z.union([z.string(), z.array(z.string())]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  avatar_data_file: z.string(),
  source_network: z.union([z.string(), z.array(z.string())]).optional(),
  source_contract: z.union([z.string(), z.array(z.string())]).optional(),
  opensea_url: z.string().url().optional(),
})

export const AvatarSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  project_id: z.string(),
  description: z.string(),
  model_file_url: z.string().url(),
  format: z.literal('VRM'),
  is_public: z.boolean(),
  is_draft: z.boolean().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  thumbnail_url: z.string().url(),
  metadata: z.object({
    number: z.string(),
    series: z.string(),
    alternateModels: z.object({
      fbx: z.string().url().optional(),
      voxel_fbx: z.string().url().optional(),
      voxel_vrm: z.string().url().optional(),
    }).optional(),
    ardriveFiles: z.object({
      models: z.array(z.string()).optional(),
      thumbnails: z.array(z.string()).optional(),
      textures: z.array(z.string()).optional(),
    }).optional(),
  }).passthrough().optional(),
})

// Internal types
export const TrackingDataSchema = z.object({
  face: z.object({
    blendShapes: z.record(z.string(), z.number()),  // ARKit blend shape name → weight 0–1
    headRotation: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    detected: z.boolean(),
  }),
  pose: z.object({
    spine: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    leftShoulder: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rightShoulder: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    leftElbow: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rightElbow: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    LeftWrist: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    RightWrist: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  }).optional(),
  timestamp: z.number(),
})

export type Project = z.infer<typeof ProjectSchema>
export type Avatar = z.infer<typeof AvatarSchema>
export type TrackingData = z.infer<typeof TrackingDataSchema>
```

---

## 5. Upstream API Reference (Internal)

### Open Source Avatars Registry

| Endpoint | Method | Auth | Response | Notes |
|----------|--------|------|----------|-------|
| `https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/projects.json` | GET | None | `Project[]` | Entry point. Cache ≥1hr. |
| `https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/{avatar_data_file}` | GET | None | `Avatar[]` | Per-collection, e.g. `avatars/100avatars-r1.json` |
| `{model_file_url}` (Arweave/IPFS) | GET | None | `.vrm` binary | Direct download. May have CORS issues — proxy in dev. |

**Key facts:**
- No auth needed. Static JSON on GitHub raw.
- `model_file_url` points to Arweave (permanent, decentralized storage).
- License is per-project (`Project.license`), not per-avatar.
- MVP collections: `100avatars-r1`, `100avatars-r2`, `100avatars-r3` (all CC0).

### MediaPipe Face Landmarker

| Component | Version | Notes |
|-----------|---------|-------|
| `@mediapipe/tasks-vision` | 0.10.18+ | WASM-based, runs locally in browser |
| Model | `face_landmarker.task` | 52 blend shapes, 478 landmarks |
| Runtime | VIDEO mode | Streaming, returns results per frame |

**Blend Shapes output:** 52 ARKit-compatible coefficients (0–1):
`browDownLeft`, `browDownRight`, `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`, `cheekPuff`, `cheekSquintLeft`, `cheekSquintRight`, `eyeBlinkLeft`, `eyeBlinkRight`, `eyeLookDownLeft`, `eyeLookDownRight`, `eyeLookInLeft`, `eyeLookInRight`, `eyeLookOutLeft`, `eyeLookOutRight`, `eyeLookUpLeft`, `eyeLookUpRight`, `eyeSquintLeft`, `eyeSquintRight`, `eyeWideLeft`, `eyeWideRight`, `jawForward`, `jawLeft`, `jawOpen`, `jawRight`, `mouthClose`, `mouthDimpleLeft`, `mouthDimpleRight`, `mouthFrownLeft`, `mouthFrownRight`, `mouthFunnel`, `mouthLeft`, `mouthLowerDownLeft`, `mouthLowerDownRight`, `mouthPressLeft`, `mouthPressRight`, `mouthPucker`, `mouthRight`, `mouthRollLower`, `mouthRollUpper`, `mouthShrugLower`, `mouthShrugUpper`, `mouthSmileLeft`, `mouthSmileRight`, `mouthStretchLeft`, `mouthStretchRight`, `mouthUpperUpLeft`, `mouthUpperUpRight`, `noseSneerLeft`, `noseSneerRight`, `tongueOut`

### Kalidokit (Deprecated — Use Direct Mapping)

> ⚠️ **Kalidokit is officially deprecated.** Solutions are being integrated directly into MediaPipe. We will use Kalidokit's mapping logic **as reference** but implement the blendshape-to-VRM mapping ourselves, since Kalidokit's last release was v1.1 and it targets the old `@mediapipe/holistic` API, not `@mediapipe/tasks-vision`.

We extract two things from Kalidokit:
1. **Face.solve()** — mapping from face landmarks to euler rotations + expression values
2. **Pose.solve()** — mapping from pose landmarks to bone rotations

These are reimplemented in our `tracking/` module using the current MediaPipe Tasks Vision API.

---

## 6. Parsers

### ARKit Blend Shapes → VRM Expressions

The core mapping pipeline. MediaPipe outputs 52 ARKit blend shapes. VRM has a fixed set of preset expression names. We map between them:

```typescript
// tracking/expression-map.ts

/**
 * Maps MediaPipe ARKit blend shapes to VRM expression names.
 * VRM preset expression names: happy, angry, sad, surprised, relaxed,
 *   aa, ih, ou, ee, oh, blink, blinkLeft, blinkRight, lookUp, lookDown,
 *   lookLeft, lookRight, neutral + custom expressions.
 */
export const ARKIT_TO_VRM: Record<string, string> = {
  // Eyes
  eyeBlinkLeft: 'blinkLeft',
  eyeBlinkRight: 'blinkRight',
  eyeWideLeft: '',    // No direct VRM preset — handled as blend override
  eyeWideRight: '',  // No direct VRM preset — handled as blend override
  eyeLookDownLeft: 'lookDown',
  eyeLookDownRight: 'lookDown',
  eyeLookInLeft: 'lookLeft',
  eyeLookInRight: 'lookRight',
  eyeLookOutLeft: 'lookLeft',
  eyeLookOutRight: 'lookRight',
  eyeLookUpLeft: 'lookUp',
  eyeLookUpRight: 'lookUp',
  eyeSquintLeft: '',   // Mapped to partial blink
  eyeSquintRight: '',  // Mapped to partial blink

  // Brows
  browDownLeft: 'angry',
  browDownRight: 'angry',
  browInnerUp: '',      // Contributes to surprised
  browOuterUpLeft: '',  // Contributes to relaxed
  browOuterUpRight: '', // Contributes to relaxed

  // Mouth — vowels (VRM has dedicated visemes)
  jawOpen: 'aa',
  mouthFunnel: 'ou',
  mouthWideLeft: 'happy',  // Combined with mouthSmile
  mouthWideRight: 'happy',

  // Mouth — visemes
  mouthClose: '',         // Weight reduction on vowel visemes
  mouthLowerDownLeft: '', // Contributes to aa weight
  mouthLowerDownRight: '',
  mouthUpperUpLeft: '',   // Contributes to ee
  mouthUpperUpRight: '',

  // Smile / emotion
  mouthSmileLeft: 'happy',
  mouthSmileRight: 'happy',
  mouthFrownLeft: 'sad',
  mouthFrownRight: 'sad',
  mouthPucker: '',       // No direct preset

  // Nose
  noseSneerLeft: 'angry',
  noseSneerRight: 'angry',

  // Cheeks
  cheekPuff: '',
  cheekSquintLeft: '',
  cheekSquintRight: '',

  // Jaw
  jawForward: '',
  jawLeft: '',
  jawRight: '',
}

/**
 * Composite expression solver.
 * Some VRM expressions require multiple ARKit blend shapes.
 * e.g., "surprise" = browInnerUp + jawOpen + eyeWide
 */
export function computeVRMExpressions(
  blendShapes: Record<string, number>
): Record<string, number> {
  const vrm: Record<string, number> = {}

  // Direct 1:1 mappings
  for (const [arkitName, vrmName] of Object.entries(ARKIT_TO_VRM)) {
    if (!vrmName) continue
    const weight = blendShapes[arkitName] ?? 0
    if (weight > 0) {
      vrm[vrmName] = Math.min(1, (vrm[vrmName] ?? 0) + weight)
    }
  }

  // Composite emotions
  vrm.surprised = blendShapes.browInnerUp * 0.3
    + blendShapes.jawOpen * 0.3
    + (blendShapes.eyeWideLeft ?? 0) * 0.2
    + (blendShapes.eyeWideRight ?? 0) * 0.2

  vrm.relaxed = (blendShapes.browOuterUpLeft ?? 0) * 0.5
    + (blendShapes.browOuterUpRight ?? 0) * 0.5
    + (1 - (blendShapes.eyeBlinkLeft ?? 0)) * 0.2
    + (1 - (blendShapes.eyeBlinkRight ?? 0)) * 0.2

  // Smooth blinking (prevent jitter)
  // Handled in tracking loop with blink smoothing

  return vrm
}
```

### MediaPipe Landmarks → VRM Bone Rotations

Head rotation is extracted from face landmarks (nose tip, forehead, chin triangulation) and applied to the VRM humanoid bone `head`. Pose landmarks map to spine, shoulders, elbows, and wrists.

```typescript
// tracking/pose-solver.ts

export interface BoneRotations {
  head: { x: number; y: number; z: number }
  neck: { x: number; y: number; z: number }
  spine: { x: number; y: number; z: number }
  leftShoulder: { x: number; y: number; z: number }
  rightShoulder: { x: number; y: number; z: number }
  leftUpperArm: { x: number; y: number; z: number }
  rightUpperArm: { x: number; y: number; z: number }
  leftLowerArm: { x: number; y: number; z: number }
  rightLowerArm: { x: number; y: number; z: number }
}

/**
 * Extract head euler rotation from face landmarks.
 * Uses nose tip, forehead midpoint, and chin to form a coordinate frame.
 */
export function solveHeadRotation(
  landmarks: NormalizedLandmark[]
): { x: number; y: number; z: number } {
  // Landmark indices:
  // 10 = forehead center, 152 = chin, 1 = nose tip
  // 234 = left ear, 454 = right ear
  // ...implementation derives yaw, pitch, roll
}

/**
 * Solve upper-body bone rotations from pose landmarks.
 * Optional — only computed when enablePoseTracking is true.
 */
export function solvePoseBones(
  poseLandmarks: NormalizedLandmark[],
  poseWorldLandmarks: NormalizedLandmark[]
): BoneRotations | null {
  // ...implementation
}
```

---

## 7. Constants

```typescript
// constants.ts

export const OSA_DATA_BASE_URL =
  'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data'

export const MVP_COLLECTION_IDS = [
  '100avatars-r1',
  '100avatars-r2',
  '100avatars-r3',
] as const

/** VRM humanoid bone names we animate */
export const VRM_BONES = {
  HEAD: 'head',
  NECK: 'neck',
  SPINE: 'spine',
  CHEST: 'chest',
  LEFT_SHOULDER: 'leftShoulder',
  RIGHT_SHOULDER: 'rightShoulder',
  LEFT_UPPER_ARM: 'leftUpperArm',
  RIGHT_UPPER_ARM: 'rightUpperArm',
  LEFT_LOWER_ARM: 'leftLowerArm',
  RIGHT_LOWER_ARM: 'rightLowerArm',
} as const

/** VRM preset expression names */
export const VRM_EXPRESSIONS = {
  HAPPY: 'happy',
  ANGRY: 'angry',
  SAD: 'sad',
  SURPRISED: 'surprised',
  RELAXED: 'relaxed',
  AA: 'aa',
  IH: 'ih',
  OU: 'ou',
  EE: 'ee',
  OH: 'oh',
  BLINK: 'blink',
  BLINK_LEFT: 'blinkLeft',
  BLINK_RIGHT: 'blinkRight',
  LOOK_UP: 'lookUp',
  LOOK_DOWN: 'lookDown',
  LOOK_LEFT: 'lookLeft',
  LOOK_RIGHT: 'lookRight',
  NEUTRAL: 'neutral',
} as const

/** Smoothing constants */
export const TRACKING_SMOOTHING = {
  /** Lerp factor per frame (0 = no smoothing, 1 = instant) */
  POSITION: 0.3,
  ROTATION: 0.4,
  BLINK: 0.25, // Eyelids need more smoothing to avoid jitter
  EXPRESSION: 0.35,
  /** Minimum weight to apply (below this, set to 0) */
  EXPRESSION_THRESHOLD: 0.02,
} as const

/** MediaPipe config */
export const MEDIAPIPE_CONFIG = {
  FACE_MODEL: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  FACE_NUM_LANDMARKS: 478,
  FACE_NUM_BLENDSHAPES: 52,
  FACE_MIN_DETECTION_CONFIDENCE: 0.5,
  FACE_MIN_TRACKING_CONFIDENCE: 0.5,
  FACE_MIN_PRESENCE_CONFIDENCE: 0.5,
  POSE_MODEL: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker/float16/latest/pose_landmarker.task',
} as const

/**
 * Hardware profile — auto-detected or user-specified.
 * Values below are defaults; overridden by WebatarEngine based on detected capabilities.
 */
export const HARDWARE_PROFILES = {
  /** Dasua (development machine) */
  dasua: {
    gpu: 'RTX 2070 8GB',
    cpu: 'Ryzen 5 2600 (6C/12T)',
    webcam: 'Logitech C930e (1080p MJPEG, H.264 HW encode)',
    // C930e's wide FOV (90°) means face fills more of frame at desk distance
    // → higher tracking confidence, can use lower resolution for tracking
    webcamResolution: { width: 640, height: 480 }, // Tracking resolution (downscaled from 1080p)
    webcamFps: 30,                // C930e does 30fps at 1080p MJPEG
    faceTrackingFps: 30,          // Can sustain 30fps on WASM with this CPU
    poseTrackingFps: 15,          // Halve pose tracking — optional, saves CPU
    renderFps: 60,                // RTX 2070 has headroom for 60fps
    enablePoseTracking: true,     // Ryzen 2600 can handle it
    enableHandTracking: false,    // Skip — too CPU-heavy for 6-core
    maxCachedVRMs: 5,             // 62GB RAM, 5 VRMs is trivial
    gpuWebGLMaxTextureUnits: 16,  // RTX 2070 has plenty; VRM materials are lightweight
    smoothing: {
      position: 0.3,
      rotation: 0.4,
      blink: 0.25,
      expression: 0.35,
    },
  },
  /** Low-end fallback profile (auto-selected if GPU < 4GB or CPU < 4 cores) */
  low: {
    webcamResolution: { width: 320, height: 240 },
    webcamFps: 15,
    faceTrackingFps: 15,
    poseTrackingFps: 0,          // Disable pose on low-end
    renderFps: 30,
    enablePoseTracking: false,
    enableHandTracking: false,
    maxCachedVRMs: 3,
    gpuWebGLMaxTextureUnits: 8,
    smoothing: {
      position: 0.25,            // More smoothing to hide lower framerate
      rotation: 0.3,
      blink: 0.2,
      expression: 0.25,
    },
  },
} as const
```

---

## 8. Error Handling

| Error | Code | Cause | Recovery |
|-------|------|-------|----------|
| Camera permission denied | `CAMERA_DENIED` | User blocked webcam access | Show permission prompt, retry |
| No camera found | `CAMERA_NOT_FOUND` | No webcam device | Show setup instructions |
| MediaPipe init failed | `MEDIAPIPE_INIT_FAILED` | WASM load error, incompatible browser | Fallback: show static avatar |
| Face not detected | `FACE_NOT_DETECTED` | No face in frame | Keep last known pose, apply idle animation after 2s |
| VRM load failed | `VRM_LOAD_FAILED` | Network error, corrupt file, CORS | Try CORS proxy, show error in UI |
| VRM missing expressions | `VRM_NO_EXPRESSIONS` | Avatar has no blend shapes | Log warning, animate bones only |
| VRM missing humanoid | `VRM_NO_HUMANOID` | Avatar has no humanoid rig | Reject avatar, show in gallery as "limited" |
| Low FPS warning | `LOW_FPS` | FPS < 24 for 10 frames | Disable pose tracking, reduce quality |
| OSA API fetch failed | `OSA_FETCH_FAILED` | GitHub raw down, network error | Use cached data, show offline mode |

### Error boundaries

- **Engine-level:** `WebatarEngine` catches all errors, updates `state.status` to `'error'`, and sets `state.error`.
- **React-level:** Error boundary wraps the 3D canvas and tracking UI. Falls back to static avatar render.
- **Tracking-level:** If face detection fails mid-session, hold last pose and smoothly transition to idle animation after 2 seconds.

---

## 9. Caching

### OSA Registry Data

- `projects.json` and avatar collection JSONs are cached in memory with a 1-hour TTL.
- VRM model files are cached in the browser's Cache API (Service Worker) with no expiry (they're on Arweave — content-addressed, permanent).
- Thumbnails are cached as blob URLs with an LRU cache of 50 items.

### VRM Models

```typescript
// caching model cache
const VRM_CACHE = new Map<string, { vrm: VRM; lastUsed: number }>()
const MAX_CACHED_VRMS = 5  // Keep 5 avatars loaded for fast switching

function evictVRMCache() {
  // LRU eviction when cache exceeds MAX_CACHED_VRMS
  // Dispose Three.js materials, geometries, textures
}
```

---

## 10. Rate Limiting

- **OSA Registry:** No rate limits (static GitHub raw files). Cache aggressively (1hr minimum).
- **Arweave/IPFS model downloads:** Permanent, content-addressed. No rate limits, but files can be large (5–20 MB per VRM).
- **MediaPipe model downloads:** One-time download (~5MB WASM + model). Cache in Service Worker.
- **Self-imposed limits:**
  - Max concurrent VRM downloads: 3
  - Max cached VRM models: 5
  - Tracking frame budget: 16ms (targeting 60fps for face, 30fps for pose)

---

## 11. Testing Strategy

### Unit Tests (Vitest)

| Module | What to test |
|--------|-------------|
| `tracking/expression-map.ts` | ARKit → VRM mapping: all 52 blend shapes map correctly, composite emotions compute expected weights, threshold filters zero-value noise |
| `tracking/pose-solver.ts` | Head rotation extraction from landmark arrays, bone rotation clamping, null handling for missing landmarks |
| `osa/client.ts` | Fetch projects, fetch avatars, handle 404, handle network error, validate schema |
| `vrm/utils.ts` | VRM loading, expression setting with missing expression (graceful), bone rotation on non-existent bone (no-op) |
| `caching/cache.ts` | LRU eviction, TTL expiry, Service Worker cache operations |

### Integration Tests (Playwright)

| Scenario | Steps |
|----------|-------|
| Camera starts | Mount app → grant camera → verify video stream visible |
| Avatar loads | Select avatar from gallery → verify Three.js scene renders VRM |
| Face tracking activates | Start tracking → move face → verify avatar moves within 200ms |
| Avatar switching | During tracking → switch to different avatar → verify smooth transition |
| Error recovery | Deny camera → verify error state → grant camera → verify recovery |

### Performance Benchmarks (Vitest)

- Expression mapping: < 0.5ms per frame on mid-range hardware
- Bone rotation solving: < 0.3ms per frame
- VRM model load: < 3s on 10Mbps connection
- Frame budget: 60fps face-only, 30fps with pose tracking

---

## 12. Project Structure

```
webatar/
├── public/
│   └── models/                  # Pre-downloaded VRM for offline dev
│       └── 031_Devil.vrm
├── src/
│   ├── main.tsx                 # React entry
│   ├── App.tsx                  # Root component
│   ├── components/
│   │   ├── AvatarCanvas.tsx     # Three.js canvas + VRM render
│   │   ├── AvatarGallery.tsx    # Grid of OSA avatars with thumbnails
│   │   ├── TrackingOverlay.tsx  # Debug: show face/pose landmarks
│   │   ├── WebcamPreview.tsx    # Small camera mirror
│   │   ├── Controls.tsx         # Start/stop tracking, settings
│   │   └── Status.tsx           # FPS, tracking state, error
│   ├── hooks/
│   │   ├── useWebatar.ts        # Main engine hook
│   │   ├── useAvatarGallery.ts  # OSA registry + avatar list
│   │   ├── useFaceTracking.ts   # MediaPipe lifecycle
│   │   └── useAnimationFrame.ts  # requestAnimationFrame loop
│   ├── engine/
│   │   ├── WebatarEngine.ts     # Core orchestrator (init, start, stop, render loop)
│   │   └── types.ts             # Engine config & state types
│   ├── tracking/
│   │   ├── face-tracker.ts      # MediaPipe FaceLandmarker wrapper
│   │   ├── pose-tracker.ts      # MediaPipe PoseLandmarker wrapper (optional)
│   │   ├── expression-map.ts   # ARKit → VRM expression mapping
│   │   ├── pose-solver.ts      # Landmarks → bone rotations
│   │   └── smoothing.ts         # Lerp/EMA smoothing for all values
│   ├── vrm/
│   │   ├── loader.ts            # VRMLoaderPlugin + GLTFLoader setup
│   │   ├── expressions.ts       # setVRMExpression(), compute expressions
│   │   ├── bones.ts             # rotateVRMBone(), humanoid bone access
│   │   └── look-at.ts           # Eye tracking from gaze direction
│   ├── osa/
│   │   ├── client.ts            # Fetch projects.json + avatar collections
│   │   ├── types.ts             # Project & Avatar Zod schemas
│   │   └── cache.ts             # In-memory + Service Worker caching
│   ├── rendering/
│   │   ├── scene.ts             # Three.js scene, camera, lighting
│   │   ├── background.ts        # Gradient/environment background
│   │   └── postprocessing.ts    # Bloom, outline (optional)
│   ├── constants.ts
│   └── utils/
│       ├── math.ts              # Lerp, clamp, quatFromEuler, etc.
│       └── permissions.ts       # Camera permission helper
├── tests/
│   ├── unit/
│   │   ├── expression-map.test.ts
│   │   ├── pose-solver.test.ts
│   │   ├── osa-client.test.ts
│   │   └── smoothing.test.ts
│   ├── integration/
│   │   ├── camera-start.playwright.ts
│   │   ├── avatar-load.playwright.ts
│   │   └── tracking.playwright.ts
│   └── benchmarks/
│       └── expression-mapping.bench.ts
├── Spec.md                       # This file
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 13. Usage Examples

### Basic — Drop-in React Component

```tsx
import { WebatarEngine } from 'webatar'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const engine = new WebatarEngine({
  canvas,
  enablePoseTracking: true,
  debugOverlay: false,
})

await engine.init()
await engine.loadAvatar('https://arweave.net/...')
engine.start()
```

### React Hook — Full App

```tsx
import { useWebatar, useAvatarGallery } from 'webatar'

function App() {
  const { engine, state, loadAvatar, startTracking, stopTracking } = useWebatar({
    canvas: canvasRef.current!,
    smoothingFactor: 0.35,
  })

  const { projects, avatars, loading } = useAvatarGallery({
    collectionIds: ['100avatars-r1', '100avatars-r2', '100avatars-r3'],
  })

  return (
    <div className="flex h-screen">
      <AvatarGallery avatars={avatars} onSelect={(a) => loadAvatar(a.model_file_url)} />
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="w-full h-full" />
        <WebcamPreview />
        <Status fps={state.fps} tracking={state.faceDetected} />
      </div>
    </div>
  )
}
```

### Expression Mapping Only (No Webcam)

```tsx
import { computeVRMExpressions } from 'webatar/tracking/expression-map'

const vrmExpressions = computeVRMExpressions({
  jawOpen: 0.8,
  mouthSmileLeft: 0.6,
  mouthSmileRight: 0.6,
  eyeBlinkLeft: 0.1,
  eyeBlinkRight: 0.1,
})
// → { aa: 0.8, happy: 0.6, blink: 0.1, surprised: 0.24, relaxed: 0.36 }
```

---

## 14. Security & Ethics

### Privacy

- **All processing is local.** MediaPipe runs entirely in the browser via WASM. No webcam frames or facial data leave the device.
- **No server-side components.** The OSA registry is static JSON. VRM models are from Arweave/IPFS (content-addressed, no tracking).
- **Camera access** follows browser permission model. Graceful degradation if denied.
- **No telemetry.** No analytics, no tracking pixels, no third-party scripts by default.

### Content Safety

- OSA avatars are all CC0 or CC-BY licensed. No proprietary content.
- Webcam video is never stored, transmitted, or recorded.
- Avatar gallery thumbnails are served from Arweave/IPFS — no tracking cookies.

### Responsible AI

- Face tracking data (landmarks, blend shapes) is ephemeral — exists only in memory during the render frame.
- No facial recognition or identification. No faces are stored, compared, or identified.
- The tracking pipeline only extracts geometric data (landmark positions and blend shape weights), never biometric identity.

---

## 15. Changelog & Versioning

- **v0.1.0 (MVP)** — Face tracking + VRM expressions for 100 Avatars R1–R3
- **v0.2.0** — Pose tracking (upper body), avatar gallery with search/filter
- **v0.3.0** — All OSA collections, avatar customization (colors, accessories)
- **v1.0.0** — Stable API, recording/streaming output, scene backgrounds

---

## 16. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `three` | ^0.180.0 | 3D rendering engine |
| `@pixiv/three-vrm` | ^3.0.0 | VRM model loading, expressions, humanoid bones |
| `@mediapipe/tasks-vision` | ^0.10.18 | Face + Pose landmarker (WASM, in-browser) |
| `react` | ^19.0.0 | UI framework |
| `react-dom` | ^19.0.0 | DOM rendering |
| `@react-three/fiber` | ^9.0.0 | React bindings for Three.js |
| `@react-three/drei` | ^10.0.0 | Three.js helpers (OrbitControls, Environment) |
| `zod` | ^3.23.0 | Schema validation |
| `vite` | ^6.0.0 | Build tool |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^3.0.0 | Unit tests |
| `@playwright/test` | ^1.50.0 | Integration tests |
| `typescript` | ^5.7.0 | Type checking |
| `@types/three` | ^0.180.0 | Three.js types |
| `tailwindcss` | ^4.0.0 | Styling |

### Why not Kalidokit?

Kalidokit is officially deprecated (see their README). It targets the old MediaPipe JS API (`@mediapipe/holistic`) which uses a callback-based pattern. The modern `@mediapipe/tasks-vision` API is promise-based and returns structured blend shapes directly. We implement the mapping logic ourselves — it's ~200 lines of straightforward math that we control and can optimize.

### Why not Aniface?

Aniface (`@aniface/core`) is a good reference project but:
1. It targets GLB models with ARKit blend shapes, not VRM expressions
2. It bundles its own Three.js renderer — we need fine-grained control over VRM bone rotation
3. It doesn't support pose tracking or the OSA registry
4. Its API is opinionated around a single-avatar flow; we need gallery + switching

### Architecture Decision: Three-vrm + MediaPipe Direct

**Chosen:** `@pixiv/three-vrm` + `@mediapipe/tasks-vision` with custom mapping layer.

**Alternatives considered:**
1. **Kalidokit + old MediaPipe** — Deprecated, outdated API, but proven. Rejected.
2. **Aniface** — Simple but GLB-only, no VRM expression system, no pose. Rejected.
3. **Morphix** — Good reference (React Three Fiber + MediaPipe + Kalidokit + VRM), but it's a full app not a library. We take architectural inspiration but build our own. Referenced for architecture.
4. **Ready Player Me SDK** — Locked to their avatar system. Rejected.
5. **VRoid + Unity** — Desktop-only. Rejected.

**Rationale:** The three-vrm library is the standard for VRM in the browser. MediaPipe Tasks Vision is the current supported API. The custom mapping layer gives us full control over expression quality and performance tuning.

---

## Appendix A: Hardware Optimization Profile

### Development Machine: `dasua`

| Component | Spec | Impact |
|-----------|------|--------|
| CPU | AMD Ryzen 5 2600 (6C/12T, 3.5GHz) | MediaPipe WASM uses 2–3 threads. Face tracking at 30fps is comfortable. Pose tracking at 15fps is sustainable. |
| GPU | NVIDIA RTX 2070 8GB (primary, active) | ✅ More than enough for Three.js + VRM. 6.7GB free VRAM. 60fps rendering with post-processing. |
| GPU | NVIDIA GTX 1060 3GB (secondary, offline) | Could be activated via offload for streaming/encoding if recording is added later. |
| RAM | 62GB DDR4 (47GB available) | ✅ No constraint. Cache 5 VRM models (~250MB) is trivial. |
| Webcam | Logitech C930e (USB 2.0) | ✅ Premium cam. 1080p MJPEG @30fps, H.264 HW encoding, 90° FOV. One of the best cams for face tracking. |
| Storage | 1.9TB NVMe (983GB free) | ✅ Model caching is free. |
| Display | 2×1080p, Wayland | ✅ Standard rendering — no 4K stress. |
| OS | Arch Linux, kernel 7.0.3 | Full Vulkan/WebGL2/WebGPU support. Nouveau-free (NVIDIA proprietary drivers v595.71). |

### Webcam-Specific Optimizations (C930e)

1. **Track at 640×480, display at 1080p** — The C930e captures 1080p MJPEG. We send 640×480 YUYV to MediaPipe (lower CPU for WASM inference) while displaying the 1080p stream in the preview.

2. **Use MJPEG format** — The C930e has H.264 hardware encoding. Request MJPEG from the webcam to offload compression from the CPU. Browser `getUserMedia` handles decoding.

3. **90° FOV advantage** — Wider FOV means the face stays in frame during head turns. Tracking confidence stays higher at desk distance (~60cm) than with narrower cams.

4. **USB 2.0 is fine** — The C930e on USB 2.0 (480Mbps) handles 640×480@30fps YUYV (~55MB/s) well within bandwidth. No need for USB 3.x.

### GPU-Specific Optimizations (RTX 2070)

1. **WebGL2 capable** — Three.js will use WebGL2 for full shader support. VRM MToon materials render correctly.

2. **WebGPU-ready** — `@pixiv/three-vrm` v3 supports WebGPU via `MToonNodeMaterial`. We'll default to WebGL2 (broader compatibility) but can opt into WebGPU for ~10% GPU efficiency gain on RTX.

3. **Post-processing is cheap** — Bloom, SSAO, ambient occlusion are nearly free on RTX. Enable by default on this GPU.

4. **Multi-model rendering** — RTX 2070's 8GB VRAM can comfortably render 5+ VRM models simultaneously. Gallery "preview" mode rendering 3–5 avatars alongside the active avatar is viable.

### CPU-Specific Optimizations (Ryzen 5 2600)

1. **MediaPipe uses Web Workers** — Face/Pose landmarker runs in a dedicated worker thread. On 6C/12T, this leaves 5 cores for rendering.

2. **OffscreenCanvas** — Move Three.js rendering to an OffscreenCanvas in a worker. Main thread stays free for React UI.

3. **Pose tracking at half framerate** — Run face at 30fps, pose at 15fps. Halves pose CPU cost with minimal visual difference (upper body moves slower than face).

4. **float16 models** — MediaPipe models come in float16 (smaller WASM downloads, slightly faster inference on CPUs without AVX-512). The Ryzen 2600 supports AVX2, not AVX-512, so float16 is the right choice.

### Auto-Detection Strategy

```typescript
// engine/hardware-profile.ts

export interface HardwareProfile {
  tier: 'high' | 'mid' | 'low'
  webcamResolution: { width: number; height: number }
  webcamFps: number
  faceTrackingFps: number
  poseTrackingFps: number
  renderFps: number
  enablePoseTracking: boolean
  enableHandTracking: boolean
  maxCachedVRMs: number
  smoothing: { position: number; rotation: number; blink: number; expression: number }
}

export async function detectHardwareProfile(): Promise<HardwareProfile> {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')!

  // GPU detection
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const gpuRenderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : 'unknown'
  const gpuMem = (gl as WebGL2RenderingContext)
    ?. getExtension('WEBGL_video_texture') ? undefined : undefined // No direct VRAM query in WebGL

  // Use WEBGL_max_texture_units as proxy for GPU capability
  const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)

  // CPU cores (approximate — browser reports logical cores)
  const cpuCores = navigator.hardwareConcurrency ?? 4

  // Memory (approximate — deviceMemory API)
  const deviceMemory = (navigator as any).deviceMemory ?? 4 // GB, approximate

  // Webcam capabilities (probed on init)
  let webcamMaxFps = 30
  let webcamMaxWidth = 640

  // Tier determination
  const isHighEnd = maxTextureUnits >= 16 && cpuCores >= 8
  const isMid = maxTextureUnits >= 8 && cpuCores >= 4

  if (isHighEnd) return HARDWARE_PROFILES.dasua  // Or dynamic high profile
  if (isMid) return { ...HARDWARE_PROFILES.dasua, enablePoseTracking: true, faceTrackingFps: 24 }
  return HARDWARE_PROFILES.low
}
```

---

## Appendix B: MVP Scope

### In Scope (v0.1.0)
- ✅ Webcam face tracking → VRM facial expressions
- ✅ Head rotation tracking → VRM head bone rotation
- ✅ Upper-body pose tracking → shoulder/arm bones (optional, togglable)
- ✅ 100 Avatars R1–R3 gallery (300 avatars, CC0)
- ✅ Real-time avatar switching during tracking
- ✅ Smooth expression animation with blink stabilization
- ✅ FPS counter and tracking quality indicator

### Out of Scope (v0.1.0)
- ❌ Hand/finger tracking
- ❌ Full-body animation
- ❌ Avatar customization
- ❌ Recording/streaming output
- ❌ Scene backgrounds or environments
- ❌ Voice/audio input
- ❌ VRM avatar creation or editing
- ❌ Server-side rendering

### Deferred to v0.2.0+
- All OSA collections (VIPE, Grifters, etc.)
- Avatar search and filtering
- Scene backgrounds
- Recording to video file
- Streaming to OBS via virtual camera

---

## Appendix C: Blend Shape Mapping Reference

### Key Mapping Table

| # | ARKit Blend Shape | VRM Expression | Notes |
|---|-------------------|----------------|-------|
| 1 | `eyeBlinkLeft` | `blinkLeft` | Direct, with smoothing |
| 2 | `eyeBlinkRight` | `blinkRight` | Direct, with smoothing |
| 3 | `jawOpen` | `aa` | Primary vowel viseme |
| 4 | `mouthSmileLeft` | `happy` | Weighted 0.6, combined with right |
| 5 | `mouthSmileRight` | `happy` | Weighted 0.6, combined with left |
| 6 | `browDownLeft` | `angry` | Weighted, combined with right |
| 7 | `browDownRight` | `angry` | Weighted, combined with left |
| 8 | `mouthFrownLeft` | `sad` | Weighted, combined with right |
| 9 | `mouthFrownRight` | `sad` | Weighted, combined with left |
| 10 | `browInnerUp` | Composite → `surprised` | Combined with jawOpen, eyeWide |
| 11 | `mouthFunnel` | `ou` | Vowel viseme |
| 12 | `eyeLookUpLeft/Right` | `lookUp` | Gaze-based, split L/R |
| 13 | `eyeLookDownLeft/Right` | `lookDown` | Gaze-based, split L/R |
| 14 | `eyeLookInLeft/Right` | `lookLeft`/`lookRight` | Cross-mapped |
| 15 | `eyeLookOutLeft/Right` | `lookLeft`/`lookRight` | Opposite direction |

### Composite Emotions

| VRM Expression | ARKit Inputs | Weight Formula |
|----------------|-------------|----------------|
| `surprised` | `browInnerUp`, `jawOpen`, `eyeWideLeft`, `eyeWideRight` | `0.3 * browInnerUp + 0.3 * jawOpen + 0.2 * eyeWideLeft + 0.2 * eyeWideRight` |
| `relaxed` | `browOuterUpLeft`, `browOuterUpRight`, inverse blink | `0.5 * avg(browOuterUp) + 0.2 * (1 - avg(blink))` |

### Important: VRM Override Behavior

VRM expressions have an **override system**. When `overrideBlink` is set to `block`, the expression prevents blinking. When set to `blend`, it partially overrides. When `overrideMouth` is set, the expression takes priority over vowel visemes.

**Our approach:** Set expression weights using `vrm.expressionManager.setValue(name, weight)` and call `vrm.expressionManager.update()` each frame. The override system handles conflicts automatically — e.g., a `happy` expression with `overrideMouth: blend` will blend with the `aa` viseme rather than overriding it completely.

---

## Appendix D: Performance Budget

| Metric | Target | Action if exceeded |
|--------|--------|--------------------|
| Face tracking frame time | < 8ms | Reduce resolution, skip alternate frames |
| Expression mapping | < 0.5ms | Optimize with lookup table |
| VRM render frame time | < 8ms | Reduce model quality, disable postprocessing |
| Total frame budget | < 16ms (60fps) | Disable pose tracking, reduce to 30fps |
| VRM model load time | < 3s | Show loading progress, cache aggressively |
| Memory per avatar | < 50MB | Dispose unused materials/geometries |
| Total memory (3 cached avatars) | < 150MB | Reduce MAX_CACHED_VRMS |

---

*MVP: 300 CC0 avatars, real-time face tracking, browser-native, zero-install. Let's build it. 🐉*
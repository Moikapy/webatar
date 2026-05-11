# Body Tracking & Camera-Distance Avatar Positioning — Feature Spec Draft

> Status: Draft — needs brainstorming and design before implementation.

## What the User Wants

1. **Full body tracking** — track shoulders, elbows, spine from the webcam so the avatar mirrors your upper-body pose
2. **Camera-distance mapping** — when you lean toward/away from the camera, the avatar moves closer/further in the 3D scene, creating a sense of physical presence

## Current State

- `FaceTracker` handles MediaPipe Face Landmarker only (52 blend shapes + 478 landmarks + head rotation)
- `pose-solver.ts` has `solvePoseBones()` that computes upper-body bone rotations from pose landmarks — **but it's never called**
- `WebatarConfig` has `enablePoseTracking: boolean` (default true) — **but it's not wired to anything**
- `useWebatar` only creates `FaceTracker`, no `PoseLandmarker`
- The Three.js camera is fixed at `[0, 1.3, 2]` looking at `[0, 1.0, 0]` — no distance adaptation

## What Needs to Be Built

### 1. PoseTracker Module (new: `src/tracking/pose-tracker.ts`)

Parallel to `FaceTracker`:
- Wraps `@mediapipe/tasks-vision` `PoseLandmarker`
- Same WASM lifecycle pattern (init/start/stop/destroy/processFrame)
- `processFrame(video, timestamp)` → `PoseTrackingResult { poseLandmarks, poseWorldLandmarks }`
- Runs at **15fps** (per Spec.md hardware profile — halves CPU cost)
- Separate `PoseLandmarker` instance, not shared with `FaceLandmarker`

### 2. Wire Pose Tracking into useWebatar

- Create `PoseTracker` instance alongside `FaceTracker`
- Run at 15fps (separate interval or every other frame)
- Call `solvePoseBones()` with pose landmarks
- Apply bone rotations via `rotateVRMBone()` in the afterUpdate callback

### 3. Camera-Distance Mapping (new: `src/tracking/camera-distance.ts`)

Pure function that:
- Takes face/pose landmarks
- Computes a **depth value** (how close the user is to the camera)
- Returns a camera position offset or avatar position offset

Two approaches:
- **Face landmark scale** — the size of the face bounding box in normalized coords correlates with distance. Bigger face = closer.
- **Pose landmark depth** — the z-coordinate of nose/shoulders gives actual depth from camera

The avatar (or camera) position slides along the Z axis proportionally. With smoothing to avoid jank.

### 4. VRMLoader Camera Update

- `frameCamera()` currently computes a static position
- Need to support dynamic camera distance driven by the tracking pipeline
- Option A: Move the camera (change camera.position.z)
- Option B: Move the avatar (change vrm.scene.position.z)
- Option A is better — keeps the avatar at origin for bone rotations

## Open Questions

1. **Should pose tracking be toggleable?** — The spec has `enablePoseTracking` but it's currently a no-op. The user may want to turn it off for performance.
2. **15fps vs 30fps for pose?** — Spec says 15fps (half the face tracking rate). Does this create visible jitter on body movement?
3. **How smooth should camera distance be?** — Need aggressive smoothing (EMA with factor ~0.2) so the avatar doesn't lurch forward/back.
4. **What about arm/hand animation?** — Pose solver currently only does head/neck/spine/shoulders/upper arms. Should we add elbow and wrist rotation?
5. **MediaPipe model size** — Pose model is ~4MB. Need to handle the download gracefully (loading indicator).

## Dependencies

- `@mediapipe/tasks-vision` already installed (has PoseLandmarker)
- `solvePoseBones()` already exists in `pose-solver.ts`
- `rotateVRMBone()` already exists in `bones.ts`
- `applyIdlePose()` already exists in `idle-pose.ts`

## Estimated Scope

- **PoseTracker module**: ~150 lines (similar to FaceTracker)
- **useWebatar wiring**: ~60 lines (interval, state, processFrame)
- **Camera-distance mapping**: ~80 lines (pure function + smoothing)
- **VRMLoader camera update**: ~30 lines (dynamic position)
- **Tests**: ~200 lines (TDD)
- **Total**: ~520 lines new code

This is a solid 1-2 session feature.
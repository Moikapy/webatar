# 1:1 Body Position Mapping — Design Spec Draft

> Status: Draft — needs tuning and testing before implementation.

## What

Mirror the user's full body position to the avatar in 1:1. When the user sits, the avatar sits. When they lean, it leans. The avatar's root position tracks the user's hip center from MediaPipe pose world landmarks.

## Current State

- Face expressions → VRM expressions ✅
- Head rotation → head/neck bones ✅  
- Pose bone *rotations* → spine/shoulder/arm rotations ✅
- Camera distance (face size) → camera Z movement ✅
- **Avatar root position** → FIXED at origin ❌

## What's Missing

The avatar's root position (hips/feet) is always at origin. The spine and hip *rotations* are applied, but the avatar never actually moves its center of mass. So sitting looks like standing with bent knees, not actual sitting.

## Implementation Plan

### 1. Extract hip position from pose world landmarks

MediaPipe provides `poseWorldLandmarks` — 3D positions in meters from the camera. Key landmarks:
- 23 = left hip
- 24 = right hip
- Hip center = average of 23 and 24

From hip center, derive:
- **hipX**: horizontal position (left/right lean)
- **hipY**: vertical position (sitting lowers Y)
- **hipZ**: depth (already partially handled via camera distance)

### 2. Map hip position to avatar root position

```typescript
// In afterUpdate callback:
const hipCenter = poseWorldLandmarks[23] && poseWorldLandmarks[24]
  ? {
      x: (poseWorldLandmarks[23].x + poseWorldLandmarks[24].x) / 2,
      y: (poseWorldLandmarks[23].y + poseWorldLandmarks[24].y) / 2,
      z: (poseWorldLandmarks[23].z + poseWorldLandmarks[24].z) / 2,
    }
  : null

if (vrm && hipCenter) {
  // Scale: MediaPipe world coords → VRM scene coords
  // Hip center at standing height ≈ (0, 0.9, 0) in world
  // Map to VRM: X mirrors (left in camera = right in scene), Y inverts
  vrm.scene.position.x = hipCenter.x * -0.5  // mirror + scale down
  vrm.scene.position.y = (0.9 - hipCenter.y) * 0.8  // sitting = lower Y
}
```

### 3. Smooth the position like we smooth camera distance

```typescript
smoothedAvatarPosition = lerpVec3(prev, current, 0.15)
```

### 4. Sitting detection

From hip Y relative to shoulder Y:
- If hips are significantly lower than standing baseline → sitting
- Apply hip rotation (bend forward) to create natural seated posture
- Blend between standing idle pose and seated pose

### 5. Floor clamping

Avatar root Y should never go below 0 (floor). Clamp:
```typescript
vrm.scene.position.y = Math.max(0, smoothedPosition.y)
```

## Open Questions

1. **Scale factor** — MediaPipe world coords are in meters, VRM scene units vary. Need calibration.
2. **Reference pose** — Need to capture a "standing T-pose" baseline to compute offsets from.
3. **Standing vs sitting transition** — Smooth blend between poses, not instant snap.
4. **Legs** — VRM models have leg bones but sitting requires IK (inverse kinematics) or pre-made sitting animations, not just rotation. This is the hard part.
5. **Camera follow** — If avatar moves, camera needs to follow to keep it in frame.

## Estimated Scope

- Avatar position mapping: ~50 lines new, ~20 lines modified
- Sitting detection + pose blending: ~80 lines new
- Smoothing + clamping: ~30 lines (already partially exists)
- Tuning and testing: significant iteration time
- Total: ~160 lines new code, 1-2 sessions
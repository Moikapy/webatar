// Webatar — Webcam-driven real-time animation of VRM avatars
// Export all public modules

// Tracking pipeline
export { computeVRMExpressions, computeCompositeExpressions, filterNoise, ARKIT_TO_VRM, EXPRESSION_THRESHOLD } from './tracking/expression-map'
export { lerp, lerpVec3, smoothExpressions, BlinkStabilizer } from './tracking/smoothing'
export { solveHeadRotation, solvePoseBones } from './tracking/pose-solver'
export type { NormalizedLandmark, HeadRotation, BoneRotations } from './tracking/pose-solver'
export { FaceTracker } from './tracking/face-tracker'
export type { TrackerState, FaceTrackingResult } from './tracking/face-tracker'

// VRM
export { setVRMExpression, applyExpressionsToVRM } from './vrm/expressions'
export { rotateVRMBone } from './vrm/bones'
export type { VRMExpressionManager, VRMHumanoid, VRMInstance } from './vrm/types'

// OSA registry
export { OSAClient } from './osa/client'
export { PROJECT_SCHEMA, AVATAR_SCHEMA } from './osa/types'
export type { Project, Avatar } from './osa/types'

// Engine
export { WebatarEngine } from './engine/WebatarEngine'
export type { WebatarConfig, WebatarState, WebatarStatus } from './engine/WebatarEngine'

// Utils
export { lerp as mathLerp, clamp, degToRad, radToDeg, distance3D, distance2D } from './utils/math'
export { requestCameraPermission, stopStream, listCameras, checkCameraPermission } from './utils/permissions'
export type { PermissionState, CameraInfo } from './utils/permissions'

// Constants
export { OSA_DATA_BASE_URL, MVP_COLLECTION_IDS, VRM_BONES, VRM_EXPRESSIONS, TRACKING_SMOOTHING, MEDIAPIPE_CONFIG, HARDWARE_PROFILES } from './constants'
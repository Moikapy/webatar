/**
 * Constants for the Webatar project.
 * Generated from Spec.md §7 and hardware profile.
 */

/** OSA registry base URL */
export const OSA_DATA_BASE_URL =
  'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data'

/** MVP collection IDs (all CC0) */
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
  POSITION: 0.3,
  ROTATION: 0.4,
  BLINK: 0.25,
  EXPRESSION: 0.35,
  EXPRESSION_THRESHOLD: 0.02,
} as const

/** MediaPipe config */
export const MEDIAPIPE_CONFIG = {
  FACE_MODEL:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  FACE_NUM_LANDMARKS: 478,
  FACE_NUM_BLENDSHAPES: 52,
  FACE_MIN_DETECTION_CONFIDENCE: 0.5,
  FACE_MIN_TRACKING_CONFIDENCE: 0.5,
  FACE_MIN_PRESENCE_CONFIDENCE: 0.5,
  POSE_MODEL:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker/float16/latest/pose_landmarker.task',
} as const

/** Hardware performance profiles */
export const HARDWARE_PROFILES = {
  /** High-end profile (development machine: Ryzen 2600 + RTX 2070 + C930e) */
  high: {
    webcamResolution: { width: 640, height: 480 },
    webcamFps: 30,
    faceTrackingFps: 30,
    poseTrackingFps: 15,
    renderFps: 60,
    enablePoseTracking: true,
    enableHandTracking: false,
    maxCachedVRMs: 5,
    smoothing: {
      position: 0.3,
      rotation: 0.4,
      blink: 0.25,
      expression: 0.35,
    },
  },
  /** Low-end fallback profile */
  low: {
    webcamResolution: { width: 320, height: 240 },
    webcamFps: 15,
    faceTrackingFps: 15,
    poseTrackingFps: 0,
    renderFps: 30,
    enablePoseTracking: false,
    enableHandTracking: false,
    maxCachedVRMs: 3,
    smoothing: {
      position: 0.25,
      rotation: 0.3,
      blink: 0.2,
      expression: 0.25,
    },
  },
} as const
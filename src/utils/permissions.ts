/**
 * Camera permission helper for browser environments.
 * Pure utility — no side effects, returns promises.
 */

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable'

export interface CameraInfo {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

/**
 * Request camera permission from the browser.
 * Returns the video stream if granted, throws if denied.
 */
export async function requestCameraPermission(
  constraints: MediaStreamConstraints = { video: { width: 640, height: 480, facingMode: 'user' } },
): Promise<MediaStream> {
  console.assert(typeof navigator !== 'undefined', 'navigator must be available')
  console.assert(typeof navigator.mediaDevices !== 'undefined', 'mediaDevices must be available')

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new Error('CAMERA_DENIED: User denied camera permission')
      }
      if (error.name === 'NotFoundError') {
        throw new Error('CAMERA_NOT_FOUND: No camera device available')
      }
      if (error.name === 'NotReadableError') {
        throw new Error('CAMERA_NOT_FOUND: Camera is in use by another application')
      }
    }
    throw new Error(`CAMERA_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Stop all tracks in a media stream.
 */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

/**
 * List available video input devices.
 */
export async function listCameras(): Promise<CameraInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'videoinput')
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
      kind: d.kind,
    }))
}

/**
 * Check current camera permission state without prompting.
 */
export async function checkCameraPermission(): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return 'unavailable'
  }

  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return result.state as PermissionState
  } catch {
    return 'unavailable'
  }
}
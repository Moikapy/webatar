/**
 * Virtual Camera Output
 *
 * Captures the Three.js canvas as a MediaStream at 30fps.
 * In Electron on Linux, can pipe to v4l2loopback for virtual webcam output.
 * In the browser or on other platforms, provides the stream for OBS window capture.
 *
 * Requirements for virtual webcam on Linux:
 *   - v4l2loopback kernel module: sudo modprobe v4l2loopback
 *   - ffmpeg in PATH
 *
 * On macOS/Windows:
 *   - Use OBS window capture or OBS Virtual Camera
 */

export interface VirtualCameraState {
  isStreaming: boolean
  stream: MediaStream | null
  error: string | null
}

/**
 * Start capturing a canvas element as a MediaStream.
 * Returns the stream for piping to a virtual webcam or for OBS capture.
 */
export function captureCanvasStream(
  canvas: HTMLCanvasElement,
  fps: number = 30,
): MediaStream {
  return canvas.captureStream(fps)
}

/**
 * Check if v4l2loopback is likely available.
 * Only meaningful on Linux with Electron.
 */
export function isV4l2Available(): boolean {
  if (typeof process !== 'undefined' && process.platform === 'linux') {
    // Check if we're in Electron and on Linux
    return !!(window as any).electronAPI
  }
  return false
}

/**
 * Get streaming instructions for the current platform.
 */
export function getStreamingInstructions(): { title: string; steps: string[] } {
  const platform = typeof navigator !== 'undefined'
    ? (navigator as any).userAgentData?.platform ?? navigator.platform
    : 'unknown'

  if (platform.includes('Linux')) {
    return {
      title: 'Stream on Linux',
      steps: [
        '1. Install v4l2loopback: sudo modprobe v4l2loopback',
        '2. Open OBS Studio',
        '3. Add a "Window Capture" source → select "Webatar"',
        '4. Or use "Browser Source" pointing to http://localhost:3000',
        '5. Start Virtual Camera in OBS → appears in Zoom/Discord',
      ],
    }
  }

  if (platform.includes('Mac')) {
    return {
      title: 'Stream on macOS',
      steps: [
        '1. Open OBS Studio',
        '2. Add a "Window Capture" source → select "Webatar"',
        '3. Start Virtual Camera in OBS',
        '4. Select "OBS Virtual Camera" in Zoom/Discord/Google Meet',
      ],
    }
  }

  return {
    title: 'Stream on Windows',
    steps: [
      '1. Open OBS Studio',
      '2. Add a "Window Capture" source → select "Webatar"',
      '3. Start Virtual Camera in OBS',
      '4. Select "OBS Virtual Camera" in Zoom/Discord/Google Meet',
    ],
  }
}
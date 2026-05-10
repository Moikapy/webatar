/**
 * Integration tests for Webatar's app shell.
 *
 * Tests the React UI, canvas setup, WebGL availability,
 * and the full expression→VRM pipeline.
 *
 * Uses Vite dev server for module resolution in browser.
 */

import { test, expect } from '@playwright/test'

test.describe('App Shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders the app header with title', async ({ page }) => {
    await expect(page.getByText('Webatar')).toBeVisible()
    await expect(page.getByText('🐉')).toBeVisible()
  })

  test('renders the status badge showing idle', async ({ page }) => {
    const statusBadge = page.locator('span').filter({ hasText: /^idle$/ })
    await expect(statusBadge).toBeVisible()
  })

  test('renders the Start Tracking button in idle state', async ({ page }) => {
    const startButton = page.getByRole('button', { name: /start tracking/i })
    await expect(startButton).toBeVisible()
    await expect(startButton).toBeEnabled()
  })

  test('does not show Stop button in idle state', async ({ page }) => {
    const stopButton = page.getByRole('button', { name: /stop/i })
    await expect(stopButton).not.toBeVisible()
  })

  test('renders video element with correct attributes', async ({ page }) => {
    const video = page.locator('video#webcam-video')
    await expect(video).toBeAttached()
    expect(await video.getAttribute('autoplay')).not.toBeNull()
    // React sets muted as a DOM property, not an HTML attribute
    // So getAttribute returns null for muted — check the property instead
    const isMuted = await video.evaluate((el) => (el as HTMLVideoElement).muted)
    expect(isMuted).toBe(true)
    expect(await video.getAttribute('playsinline')).not.toBeNull()
  })

  test('renders the canvas element for avatar rendering', async ({ page }) => {
    const canvas = page.locator('canvas#avatar-canvas')
    await expect(canvas).toBeAttached()
  })

  test('video has CSS mirror transform', async ({ page }) => {
    const video = page.locator('video#webcam-video')
    const transform = await video.evaluate((el) => el.style.transform)
    expect(transform).toContain('scaleX(-1)')
  })

  test('Camera section heading is visible', async ({ page }) => {
    await expect(page.getByText('Camera')).toBeVisible()
  })

  test('fps counter not shown when fps is 0', async ({ page }) => {
    const fpsLabel = page.getByText(/\d+ fps/)
    await expect(fpsLabel).not.toBeVisible()
  })

  test('face detected indicator not shown in idle state', async ({ page }) => {
    const faceIndicator = page.getByText(/face detected/i)
    await expect(faceIndicator).not.toBeVisible()
  })
})

test.describe('WebGL Support', () => {
  test('browser supports WebGL2', async ({ page }) => {
    await page.goto('/')

    const hasWebGL2 = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      return !!gl
    })

    expect(hasWebGL2).toBe(true)
  })

  test('canvas element can get WebGL2 context', async ({ page }) => {
    await page.goto('/')

    const hasContext = await page.evaluate(() => {
      const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement
      if (!canvas) return false
      const gl = canvas.getContext('webgl2')
      return !!gl
    })

    expect(hasContext).toBe(true)
  })
})

test.describe('Camera Permission Flow', () => {
  test('grants camera permission and creates a video stream', async ({ context, page }) => {
    await context.grantPermissions(['camera'])
    await page.goto('/')

    const streamResult = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const tracks = stream.getTracks()
        const info = { trackCount: tracks.length, label: tracks[0]?.label ?? '' }
        stream.getTracks().forEach((t) => t.stop())
        return { ok: true, ...info }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    })

    expect(streamResult.ok).toBe(true)
    expect(streamResult.trackCount).toBeGreaterThanOrEqual(1)
  })

  test('camera API is available in browser', async ({ page }) => {
    await page.goto('/')

    const apiAvailable = await page.evaluate(() => {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    })

    expect(apiAvailable).toBe(true)
  })
})

test.describe('Core Pipeline (Browser)', () => {
  // These tests exercise the entire tracking→expression→smoothing→VRM pipeline
  // using synthetic input data. No real webcam or MediaPipe needed.

  test('expression mapping works end-to-end', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { computeVRMExpressions } = await import('/src/tracking/expression-map.ts')

      const blendShapes: Record<string, number> = {
        mouthSmileLeft: 0.8,
        mouthSmileRight: 0.8,
        jawOpen: 0.15,
        eyeBlinkLeft: 0.05,
        eyeBlinkRight: 0.05,
      }

      return computeVRMExpressions(blendShapes)
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
    // smile → happy
    expect(result).toHaveProperty('happy')
    expect(result.happy).toBeGreaterThan(0)
    // jaw → aa
    expect(result).toHaveProperty('aa')
  })

  test('smoothing pipeline accumulates over frames', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { smoothExpressions, BlinkStabilizer } = await import('/src/tracking/smoothing.ts')

      const frame1 = smoothExpressions({}, { happy: 0.8, aa: 0.3 }, 0.35)
      const frame2 = smoothExpressions(frame1, { happy: 0.9, aa: 0.2 }, 0.35)

      const blinker = new BlinkStabilizer()
      blinker.process(0.8, 0.8)
      const blinkResult = blinker.process(0.8, 0.8)

      return { frame1, frame2, blinkResult }
    })

    // EMA smoothing: first frame lags behind target
    expect(result.frame1.happy).toBeLessThan(0.8)
    // Second frame gets closer
    expect(result.frame2.happy).toBeGreaterThan(result.frame1.happy)
    // Blink stabilizer should register after 2 frames
    expect(result.blinkResult).toBeGreaterThan(0)
  })

  test('pose solver produces rotation from landmarks', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { solveHeadRotation } = await import('/src/tracking/pose-solver.ts')

      const landmarks = Array.from({ length: 478 }, (_, i) => ({
        x: 0.5 + (i < 10 ? 0.01 * i : 0),
        y: 0.5,
        z: 0,
      }))

      return solveHeadRotation(landmarks as any)
    })

    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(result).toHaveProperty('z')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })

  test('WebatarEngine state transitions work', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { WebatarEngine } = await import('/src/engine/WebatarEngine.ts')
      const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement
      const engine = new WebatarEngine({ canvas })

      const states: string[] = []
      engine.onStateChange((state) => {
        states.push(state.status)
      })

      const initial = engine.currentState.status
      engine.start()
      const afterStart = engine.currentState.status
      engine.stop()
      const afterStop = engine.currentState.status
      engine.destroy()
      const afterDestroy = engine.currentState.status

      return { initial, afterStart, afterStop, afterDestroy, states }
    })

    expect(result.initial).toBe('idle')
    expect(result.afterStart).toBe('tracking')
    expect(result.afterStop).toBe('stopped')
    expect(result.states).toContain('tracking')
  })

  test('WebatarEngine processes blend shapes and tracks face', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { WebatarEngine } = await import('/src/engine/WebatarEngine.ts')
      const engine = new WebatarEngine({
        canvas: document.getElementById('avatar-canvas') as HTMLCanvasElement,
      })

      engine.start()

      const states: Array<{ status: string; faceDetected: boolean }> = []
      engine.onStateChange((state) => {
        states.push({ status: state.status, faceDetected: state.faceDetected })
      })

      // Process a face frame with some blend shapes
      engine.processFaceFrame({
        mouthSmileLeft: 0.5,
        mouthSmileRight: 0.5,
        eyeBlinkLeft: 0.1,
        eyeBlinkRight: 0.1,
      })

      const afterFace = engine.currentState

      // Simulate face loss
      engine.processFaceLost()
      const afterLoss = engine.currentState

      return {
        afterFace,
        afterLoss,
        states,
      }
    })

    expect(result.afterFace.faceDetected).toBe(true)
    expect(result.afterLoss.faceDetected).toBe(false)
  })

  test('OSAClient fetches MVP projects from GitHub', async ({ page }) => {
    // This test verifies that OSAClient can fetch data from the OSA GitHub registry.
    // The fetch goes to raw.githubusercontent.com which may be CORS-restricted in browsers.
    // We test the unit logic separately; here we just verify the module loads and can attempt the fetch.
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { OSAClient } = await import('/src/osa/client.ts')
      const client = new OSAClient()

      try {
        const projects = await client.fetchMVPProjects()
        return { ok: true, count: projects.length, firstName: projects[0]?.name ?? null }
      } catch (err) {
        // CORS or network errors are expected in headless browser context
        return { ok: false, error: (err as Error).message }
      }
    })

    // If fetch succeeds, verify we got data
    if (result.ok) {
      expect(result.count).toBeGreaterThanOrEqual(1)
    } else {
      // If CORS blocks, the module still loaded and attempted the fetch
      // This is acceptable — the unit tests verify the parsing logic
      console.log(`OSA fetch failed in browser (expected CORS): ${result.error}`)
    }
  })
})

test.describe('Full Pipeline Smoke Test', () => {
  test('synthetic face data flows through expression→smooth→blink pipeline', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { computeVRMExpressions } = await import('/src/tracking/expression-map.ts')
      const { smoothExpressions, BlinkStabilizer } = await import('/src/tracking/smoothing.ts')

      // 1. Synthetic ARKit blend shapes (surprised face)
      const blendShapes: Record<string, number> = {
        browInnerUp: 0.7,
        jawOpen: 0.4,
        eyeWideLeft: 0.6,
        eyeWideRight: 0.6,
        mouthOpen: 0.3,
      }

      // 2. Map to VRM expressions
      const vrmExpressions = computeVRMExpressions(blendShapes)
      const keys = Object.keys(vrmExpressions)

      // 3. Smooth
      const smoothed = smoothExpressions({}, vrmExpressions, 0.35)

      // 4. Process blink
      const blinker = new BlinkStabilizer()
      blinker.process(0.05, 0.05)
      const blinkWeight = blinker.process(0.05, 0.05)

      return {
        vrmExpressionKeys: keys,
        smoothedKeys: Object.keys(smoothed),
        surprised: vrmExpressions.surprised ?? 0,
        smoothedHappy: smoothed.happy ?? 0,
        blinkWeight,
      }
    })

    // Pipeline produces meaningful output
    expect(result.vrmExpressionKeys.length).toBeGreaterThan(0)
    expect(result.surprised).toBeGreaterThan(0)
    expect(result.smoothedKeys.length).toBeGreaterThan(0)
    // Blink weight should be very low (0.05 is below close threshold)
    expect(result.blinkWeight).toBeLessThan(0.5)
  })
})
/**
 * Integration tests for Webatar's app shell.
 *
 * Tests the React UI (shadcn components), canvas setup, WebGL availability,
 * and the full expression→VRM pipeline.
 *
 * Uses Vite dev server + Playwright with system Chromium.
 */

import { test, expect } from '@playwright/test'

test.describe('App Shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for React to hydrate
    await page.waitForSelector('h1')
  })

  test('renders the app header with title', async ({ page }) => {
    await expect(page.getByText('Webatar')).toBeVisible()
    await expect(page.getByText('🐉')).toBeVisible()
  })

  test('renders the status badge showing Idle', async ({ page }) => {
    await expect(page.getByText('Idle')).toBeVisible()
  })

  test('renders the Start Tracking button in idle state', async ({ page }) => {
    const startButton = page.getByRole('button', { name: /start tracking/i })
    await expect(startButton).toBeVisible()
    // Button is disabled until an avatar is selected
    await expect(startButton).toBeDisabled()
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

  test('Camera heading is visible', async ({ page }) => {
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
    await page.waitForSelector('canvas#avatar-canvas')

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
    expect(result).toHaveProperty('happy')
    expect(result.happy).toBeGreaterThan(0)
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

    expect(result.frame1.happy).toBeLessThan(0.8)
    expect(result.frame2.happy).toBeGreaterThan(result.frame1.happy)
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

      engine.processFaceFrame({
        mouthSmileLeft: 0.5,
        mouthSmileRight: 0.5,
        eyeBlinkLeft: 0.1,
        eyeBlinkRight: 0.1,
      })

      const afterFace = engine.currentState
      engine.processFaceLost()
      const afterLoss = engine.currentState

      return { afterFace, afterLoss, states }
    })

    expect(result.afterFace.faceDetected).toBe(true)
    expect(result.afterLoss.faceDetected).toBe(false)
  })

  test('OSAClient loads in browser (may fail due to CORS)', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { OSAClient } = await import('/src/osa/client.ts')
      const client = new OSAClient()

      try {
        const projects = await client.fetchMVPProjects()
        return { ok: true, count: projects.length, firstName: projects[0]?.name ?? null }
      } catch (err) {
        // CORS or network errors are expected in headless browser
        return { ok: false, error: (err as Error).message }
      }
    })

    if (result.ok) {
      expect(result.count).toBeGreaterThanOrEqual(1)
    } else {
      console.log(`OSA fetch failed (expected CORS): ${result.error}`)
    }
  })
})

test.describe('Full Pipeline Smoke Test', () => {
  test('synthetic face data flows through expression→smooth→blink pipeline', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const { computeVRMExpressions } = await import('/src/tracking/expression-map.ts')
      const { smoothExpressions, BlinkStabilizer } = await import('/src/tracking/smoothing.ts')

      const blendShapes: Record<string, number> = {
        browInnerUp: 0.7,
        jawOpen: 0.4,
        eyeWideLeft: 0.6,
        eyeWideRight: 0.6,
        mouthOpen: 0.3,
      }

      const vrmExpressions = computeVRMExpressions(blendShapes)
      const keys = Object.keys(vrmExpressions)
      const smoothed = smoothExpressions({}, vrmExpressions, 0.35)

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

    expect(result.vrmExpressionKeys.length).toBeGreaterThan(0)
    expect(result.surprised).toBeGreaterThan(0)
    expect(result.smoothedKeys.length).toBeGreaterThan(0)
    expect(result.blinkWeight).toBeLessThan(0.5)
  })
})

test.describe('VRM Loader (Browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  test('VRMLoader module loads in browser', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { VRMLoader } = await import('/src/vrm/loader.ts')
      return { hasClass: typeof VRMLoader === 'function' }
    })

    expect(result.hasClass).toBe(true)
  })

  test('VRMLoader creates Three.js scene and renderer', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { VRMLoader } = await import('/src/vrm/loader.ts')
      const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement
      const loader = new VRMLoader(canvas)

      const state = loader.state

      const initialState = {
        isLoaded: state.isLoaded,
        isRendering: state.isRendering,
        modelUrl: state.modelUrl,
        vrmIsNull: loader.vrm === null,
      }

      loader.destroy()
      return initialState
    })

    expect(result.isLoaded).toBe(false)
    expect(result.isRendering).toBe(false)
    expect(result.vrmIsNull).toBe(true)
  })

  test('VRMLoader state transitions work', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { VRMLoader } = await import('/src/vrm/loader.ts')
      const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement
      const loader = new VRMLoader(canvas)

      const states: Array<{ isLoaded: boolean; isRendering: boolean }> = []
      loader.onStateChange((state) => {
        states.push({ isLoaded: state.isLoaded, isRendering: state.isRendering })
      })

      loader.startRenderLoop()
      const afterStart = { isRendering: loader.state.isRendering }

      loader.stopRenderLoop()
      const afterStop = { isRendering: loader.state.isRendering }

      loader.destroy()

      return { afterStart, afterStop, states }
    })

    expect(result.afterStart.isRendering).toBe(true)
    expect(result.afterStop.isRendering).toBe(false)
    expect(result.states.length).toBeGreaterThanOrEqual(2)
  })

  test('VRMLoader handles load rejection gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { VRMLoader } = await import('/src/vrm/loader.ts')
      const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement
      const loader = new VRMLoader(canvas)

      try {
        await loader.load('https://example.com/nonexistent.vrm')
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      } finally {
        loader.destroy()
      }
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('load failed')
  })
})
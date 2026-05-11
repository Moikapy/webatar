/**
 * VRMLoader — Three.js scene + VRM loading.
 *
 * Manages a WebGL renderer, scene, camera, and loads VRM avatars.
 * Provides the render loop that drives avatar animation.
 *
 * Browser-only. Unit tests mock Three.js and @pixiv/three-vrm.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm'

export interface VRMLoaderState {
  isLoaded: boolean
  isRendering: boolean
  modelUrl: string | null
}

type StateListener = (state: VRMLoaderState) => void

export class VRMLoader {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  private clock: THREE.Clock
  public currentVRM: VRM | null = null
  /** Whether the background is transparent (for OBS capture) */
  public transparentBg = false
  private animationFrameId: number | null = null
  private isRendering = false
  private listeners: Set<StateListener> = new Set()
  private afterUpdateCallbacks: Set<() => void> = new Set()
  private _state: VRMLoaderState = {
    isLoaded: false,
    isRendering: false,
    modelUrl: null,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = this.createRenderer(canvas)
    this.scene = this.createScene()
    this.camera = this.createCamera(canvas)
    this.clock = new THREE.Clock()

    // Handle resize
    this.handleResize()
    window.addEventListener('resize', this.handleResize)
  }

  // ─── Public API ───────────────────────────────────────────────────────

  get vrm(): VRM | null {
    return this.currentVRM
  }

  get state(): VRMLoaderState {
    return { ...this._state }
  }

  onStateChange(callback: StateListener): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Load a VRM model from a URL.
   */
  async load(url: string): Promise<VRM> {
    // Unload any existing model
    this.unload()

    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.register((parser: unknown) => new VRMLoaderPlugin(parser as any))

      loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM
          if (!vrm) {
            reject(new Error('Loaded file is not a valid VRM'))
            return
          }

          // Add to scene
          this.scene.add(vrm.scene)

          // Rotate 180° on Y so model faces the camera
          // VRM default is +Z forward; Three.js camera looks at -Z
          vrm.scene.rotation.y = Math.PI
          this.frameCamera(vrm.scene)

          this.currentVRM = vrm
          this.updateState({ isLoaded: true, modelUrl: url })

          // Kick off rendering if not already running
          if (!this.isRendering) {
            this.startRenderLoop()
          }

          resolve(vrm)
        },
        undefined,
        (error) => {
          reject(new Error(`VRM load failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
        },
      )
    })
  }

  /**
   * Remove the current VRM model from the scene.
   */
  unload(): void {
    if (this.currentVRM) {
      this.scene.remove(this.currentVRM.scene)
      this.currentVRM = null
    }
    this.updateState({ isLoaded: false, modelUrl: null })
  }

  /**
   * Register a callback to run AFTER vrm.update() but BEFORE render.
   * Use this for bone rotations that VRM's normalization would overwrite.
   */
  onAfterUpdate(callback: () => void): () => void {
    this.afterUpdateCallbacks.add(callback)
    return () => this.afterUpdateCallbacks.delete(callback)
  }

  /**
   * Toggle transparent background for OBS capture.
   * When enabled, scene background is removed (alpha channel shows through).
   * When disabled, restores the default dark background.
   */
  setTransparentBg(enabled: boolean): void {
    this.transparentBg = enabled
    if (this.scene) {
      this.scene.background = enabled ? null : new THREE.Color(0x0a0a0e)
    }
  }

  /**
   * Start the render loop.
   */
  startRenderLoop(): void {
    if (this.isRendering) return
    this.isRendering = true
    this.updateState({ isRendering: true })
    this.render()
  }

  /**
   * Stop the render loop.
   */
  stopRenderLoop(): void {
    this.isRendering = false
    this.updateState({ isRendering: false })
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.stopRenderLoop()
    this.unload()
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
    this.listeners.clear()
  }

  // ─── Internal: Scene setup ────────────────────────────────────────────

  private createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true, // Always enable alpha for transparent background support
    })
    renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 480)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    return renderer
  }

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0e)

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    // Directional light (main)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(1, 1, 1)
    scene.add(dirLight)

    // Back light for rim
    const backLight = new THREE.DirectionalLight(0x10b981, 0.3)
    backLight.position.set(-1, 0.5, -1)
    scene.add(backLight)

    return scene
  }

  private createCamera(canvas: HTMLCanvasElement): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      30,
      (canvas.clientWidth || 640) / (canvas.clientHeight || 480),
      0.1,
      100,
    )
    camera.position.set(0, 1.3, 2)
    camera.lookAt(0, 1.0, 0)
    return camera
  }

  private frameCamera(sceneRoot: THREE.Object3D): void {
    // Compute bounding box to center and frame the model
    const box = new THREE.Box3().setFromObject(sceneRoot)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Position camera at a distance that frames the model
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera.fov * (Math.PI / 180)
    const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5

    this.camera.position.set(center.x, center.y + size.y * 0.1, center.z + cameraDistance)
    this.camera.lookAt(center)
  }

  private handleResize = (): void => {
    const width = this.canvas.clientWidth || 640
    const height = this.canvas.clientHeight || 480
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  // ─── Internal: Render loop ────────────────────────────────────────────

  private render = (): void => {
    if (!this.isRendering) return

    const delta = this.clock.getDelta()

    // Update VRM (normalizes bones to rest pose)
    if (this.currentVRM) {
      this.currentVRM.update(delta)
    }

    // Apply bone rotations AFTER VRM normalization, BEFORE render.
    // This is where idle pose, head tracking, and body tracking
    // bone rotations go — anything VRM.update() would overwrite.
    for (const cb of this.afterUpdateCallbacks) {
      cb()
    }

    // Render
    this.renderer.render(this.scene, this.camera)

    this.animationFrameId = requestAnimationFrame(this.render)
  }

  // ─── Internal: State ──────────────────────────────────────────────────

  private updateState(partial: Partial<VRMLoaderState>): void {
    this._state = { ...this._state, ...partial }
    for (const listener of this.listeners) {
      listener(this._state)
    }
  }
}
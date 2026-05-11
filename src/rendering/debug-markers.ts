/**
 * DebugSceneOverlay — 3D debug markers showing tracking data in the Three.js scene.
 *
 * Visualizes:
 *   - Yellow sphere: camera distance indicator (where camera is)
 *   - Cyan sphere: hip center position (where your body maps to)
 *   - Green crosshair: look-at target point
 *
 * Directly adds/removes Three.js objects from the scene.
 * Toggle with tuningConfig.showDebugScene or the 🎯 button.
 */

import * as THREE from 'three'
import { tuningConfig } from '../tracking/tuning-config'

interface DebugMarkers {
  cameraDot: THREE.Mesh
  hipDot: THREE.Mesh
  lookAtCrosshair: THREE.Group
}

let markers: DebugMarkers | null = null

const CAMERA_GEO = new THREE.SphereGeometry(0.05, 8, 8)
const HIP_GEO = new THREE.SphereGeometry(0.04, 8, 8)

function createMarkers(): DebugMarkers {
  const cameraDot = new THREE.Mesh(
    CAMERA_GEO,
    new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.7 }),
  )
  cameraDot.name = '__debug_camera'

  const hipDot = new THREE.Mesh(
    HIP_GEO,
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 }),
  )
  hipDot.name = '__debug_hip'

  const lookAtCrosshair = createCrosshair(0x00ff00, 0.1)
  lookAtCrosshair.name = '__debug_lookat'

  return { cameraDot, hipDot, lookAtCrosshair }
}

function createCrosshair(color: number, size: number): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({ color })

  const axes = [
    [new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0)],
    [new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0)],
    [new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size)],
  ]

  for (const [start, end] of axes) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end])
    group.add(new THREE.Line(geo, mat))
  }

  return group
}

/**
 * Add debug markers to a Three.js scene. Safe to call multiple times.
 */
export function addDebugMarkers(scene: THREE.Scene): void {
  if (markers) return
  markers = createMarkers()
  scene.add(markers.cameraDot)
  scene.add(markers.hipDot)
  scene.add(markers.lookAtCrosshair)
  setVisible(tuningConfig.showDebugScene)
}

/**
 * Remove debug markers from the scene.
 */
export function removeDebugMarkers(scene: THREE.Scene): void {
  if (!markers) return
  scene.remove(markers.cameraDot)
  scene.remove(markers.hipDot)
  scene.remove(markers.lookAtCrosshair)
  markers = null
}

/**
 * Show or hide debug markers.
 */
export function setVisible(visible: boolean): void {
  if (!markers) return
  markers.cameraDot.visible = visible
  markers.hipDot.visible = visible
  markers.lookAtCrosshair.visible = visible
}

/**
 * Update debug marker positions from tracking data.
 * Called every frame in the render loop.
 */
export interface DebugTrackingData {
  cameraDistance: number | null
  hipPosition: { x: number; y: number } | null
}

export function updateDebugMarkers(data: DebugTrackingData): void {
  if (!markers) return

  // Camera position indicator (magenta sphere)
  const camDist = data.cameraDistance ?? tuningConfig.cameraDefaultDistance
  markers.cameraDot.position.set(0, tuningConfig.cameraY, camDist)

  // Hip center (cyan sphere)
  const hipPos = data.hipPosition
  if (hipPos) {
    markers.hipDot.position.set(hipPos.x, tuningConfig.modelYOffset + hipPos.y, 0)
    markers.hipDot.visible = true
  } else {
    markers.hipDot.visible = false
  }

  // Look-at target (green crosshair) at fixed position
  markers.lookAtCrosshair.position.set(0, tuningConfig.cameraLookAtY, 0)
}
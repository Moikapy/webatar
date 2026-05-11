/**
 * WebcamOverlay — Debug overlay that draws face mesh landmarks and
 * blend shape labels on top of the webcam video feed.
 *
 * Sits in the left panel on top of the <video> element.
 * Only draws when the debug toggle is active.
 *
 * The overlay canvas runs its own rAF loop for drawing,
 * not tied to the 30fps tracking interval.
 */

import { useRef, useEffect, useCallback } from 'react'
import { drawFaceLandmarks, drawBlendShapeLabels } from '../tracking/overlay-render'
import { OVERLAY_DEFAULTS } from '../constants'
import type { LandmarkStyle, LabelStyle } from '../tracking/overlay-render'

export interface OverlayLayers {
  video: boolean
  landmarks: boolean
  blendShapes: boolean
}

interface WebcamOverlayProps {
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>
  blendShapes: Readonly<Record<string, number>>
  layers: OverlayLayers
  className?: string
}

/**
 * WebcamOverlay renders landmarks and blend shape labels on top of
 * the webcam video. The <video> element is the visual background —
 * this canvas only adds the debug data on top.
 *
 * When `layers.video` is false, the canvas is transparent.
 * When `layers.video` is true, landmarks and blend shapes render.
 */
export function WebcamOverlay({
  landmarks,
  blendShapes,
  layers,
  className,
}: WebcamOverlayProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  const showDebug = layers.video && (layers.landmarks || layers.blendShapes)

  const drawFrame = useCallback(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Resize canvas backing store if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    // Clear previous frame
    ctx.clearRect(0, 0, width, height)

    if (!showDebug) return

    // Draw face mesh landmarks
    if (layers.landmarks && landmarks.length > 0) {
      const landmarkStyle: LandmarkStyle = {
        color: OVERLAY_DEFAULTS.LANDMARK.color,
        radius: OVERLAY_DEFAULTS.LANDMARK.radius,
        opacity: OVERLAY_DEFAULTS.LANDMARK.opacity,
      }
      drawFaceLandmarks(ctx, landmarks, landmarkStyle, width, height, true)
    }

    // Draw blend shape labels
    if (layers.blendShapes && Object.keys(blendShapes).length > 0) {
      const labelStyle: LabelStyle = {
        color: OVERLAY_DEFAULTS.LABEL.color,
        fontSize: OVERLAY_DEFAULTS.LABEL.fontSize,
        lineHeight: OVERLAY_DEFAULTS.LABEL.lineHeight,
        threshold: OVERLAY_DEFAULTS.LABEL.threshold,
        maxLabels: OVERLAY_DEFAULTS.LABEL.maxLabels,
        backgroundColor: OVERLAY_DEFAULTS.LABEL.backgroundColor,
        paddingX: OVERLAY_DEFAULTS.LABEL.paddingX,
        paddingY: OVERLAY_DEFAULTS.LABEL.paddingY,
      }
      drawBlendShapeLabels(ctx, blendShapes, labelStyle, width, height)
    }
  }, [landmarks, blendShapes, layers.landmarks, layers.blendShapes, showDebug])

  useEffect(() => {
    let active = true

    const loop = () => {
      if (!active) return
      drawFrame()
      rafRef.current = requestAnimationFrame(loop)
    }

    // Start rAF loop if debug overlay is active
    if (showDebug) {
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      active = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [drawFrame, showDebug])

  return (
    <canvas
      ref={overlayCanvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}
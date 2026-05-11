/**
 * WebcamOverlay — Toggleable debug overlay showing webcam feed,
 * face mesh landmarks, and blend shape labels over the avatar canvas.
 *
 * Renders three independent layers controlled by the `layers` prop:
 *   - video: semi-transparent webcam feed drawn via canvas drawImage
 *   - landmarks: face mesh dots
 *   - blendShapes: active blend shape names + weights
 *
 * All rendering happens on a single 2D overlay canvas — no DOM manipulation
 * of the video element needed.
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
  videoRef: React.RefObject<HTMLVideoElement | null>
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>
  blendShapes: Readonly<Record<string, number>>
  layers: OverlayLayers
  videoOpacity?: number
  className?: string
}

/**
 * WebcamOverlay renders the debug overlay on top of the avatar canvas.
 * Each layer (video, landmarks, blend shapes) is independently toggleable.
 *
 * The overlay canvas runs its own rAF loop for drawing,
 * not tied to the 30fps tracking interval.
 */
export function WebcamOverlay({
  videoRef,
  landmarks,
  blendShapes,
  layers,
  videoOpacity = OVERLAY_DEFAULTS.VIDEO.defaultOpacity,
  className,
}: WebcamOverlayProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

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

    // Layer 1: Draw video frame as background
    if (layers.video) {
      const video = videoRef.current
      if (video && video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = videoOpacity
        // Mirror the video horizontally to match the landmark mirroring
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, width, height)
        ctx.restore()
      }
    }

    // Layer 2: Draw face mesh landmarks
    if (layers.landmarks && landmarks.length > 0) {
      const landmarkStyle: LandmarkStyle = {
        color: OVERLAY_DEFAULTS.LANDMARK.color,
        radius: OVERLAY_DEFAULTS.LANDMARK.radius,
        opacity: OVERLAY_DEFAULTS.LANDMARK.opacity,
      }
      drawFaceLandmarks(ctx, landmarks, landmarkStyle, width, height, true)
    }

    // Layer 3: Draw blend shape labels
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
  }, [videoRef, landmarks, blendShapes, layers, videoOpacity])

  useEffect(() => {
    let active = true

    const loop = () => {
      if (!active) return
      drawFrame()
      rafRef.current = requestAnimationFrame(loop)
    }

    // Start rAF loop if any layer is active
    if (layers.video || layers.landmarks || layers.blendShapes) {
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      active = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [drawFrame, layers.video, layers.landmarks, layers.blendShapes])

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
        zIndex: 20,
      }}
    />
  )
}
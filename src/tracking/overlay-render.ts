/**
 * Overlay rendering — pure drawing functions for face tracking debug overlay.
 *
 * Draws face mesh landmarks and blend shape labels on a 2D canvas.
 * All functions are pure: take a context and data, draw, return void.
 * No side effects beyond Canvas API drawing calls.
 */

export interface LandmarkStyle {
  color: string
  radius: number
  opacity: number
}

export interface LabelStyle {
  color: string
  fontSize: number
  lineHeight: number
  threshold: number
  maxLabels: number
  backgroundColor: string
  paddingX: number
  paddingY: number
}

/**
 * Draw face mesh landmarks as dots on a 2D canvas.
 *
 * @param ctx - Canvas 2D rendering context
 * @param landmarks - Array of { x, y, z } in normalized [0,1] coordinates
 * @param style - Visual style for the dots
 * @param canvasWidth - Canvas pixel width for coordinate scaling
 * @param canvasHeight - Canvas pixel height for coordinate scaling
 * @param mirrorX - Mirror x-coordinates (set true to match mirrored video)
 */
export function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>,
  style: LandmarkStyle,
  canvasWidth: number,
  canvasHeight: number,
  mirrorX: boolean = true,
): void {
  if (landmarks.length === 0) return

  ctx.save()
  ctx.fillStyle = style.color
  ctx.globalAlpha = style.opacity

  for (const lm of landmarks) {
    const x = mirrorX ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth
    const y = lm.y * canvasHeight

    ctx.beginPath()
    ctx.arc(x, y, style.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Draw active blend shape labels with weights on a 2D canvas.
 *
 * Labels are drawn in the top-left corner, sorted by weight descending.
 * Shapes below the threshold are filtered out.
 *
 * @param ctx - Canvas 2D rendering context
 * @param blendShapes - Name→weight map of active blend shapes
 * @param style - Visual style for the labels
 * @param canvasWidth - Canvas pixel width (unused, for future layout)
 * @param canvasHeight - Canvas pixel height (unused, for future layout)
 */
export function drawBlendShapeLabels(
  ctx: CanvasRenderingContext2D,
  blendShapes: Readonly<Record<string, number>>,
  style: LabelStyle,
  _canvasWidth: number,
  _canvasHeight: number,
): void {
  if (Object.keys(blendShapes).length === 0) return

  // Filter and sort by weight descending
  const entries = Object.entries(blendShapes)
    .filter(([, weight]) => weight >= style.threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, style.maxLabels)

  if (entries.length === 0) return

  ctx.save()
  ctx.globalAlpha = 1
  ctx.font = `${style.fontSize}px monospace`

  const startX = 8
  let yPos = style.lineHeight + 4

  for (const [name, weight] of entries) {
    const label = `${name}: ${weight.toFixed(2)}`
    const textMetrics = ctx.measureText(label)
    const textWidth = textMetrics.width

    // Background pill
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(
      startX - style.paddingX,
      yPos - style.fontSize - style.paddingY,
      textWidth + style.paddingX * 2,
      style.fontSize + style.paddingY * 2,
    )

    // Label text
    ctx.fillStyle = style.color
    ctx.fillText(label, startX, yPos)

    yPos += style.lineHeight
  }

  ctx.restore()
}
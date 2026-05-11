/**
 * TuningPanel — Live-adjustable debug panel for tracking parameters.
 *
 * All sliders write directly to `tuningConfig` (a mutable object, no React state).
 * The tracking loop reads from `tuningConfig` by reference, so changes
 * are instant with zero re-renders.
 *
 * Toggle with Ctrl+D or the 🔧 button in the header.
 */

import { useState, useCallback } from 'react'
import { tuningConfig, resetTuningConfig, exportTuningConfig } from '../tracking/tuning-config'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="w-32 text-right text-muted-foreground truncate" title={label}>
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
      <span className="w-12 text-right tabular-nums text-foreground font-mono">
        {value.toFixed(step < 0.1 ? 2 : 1)}
      </span>
    </div>
  )
}

export function TuningPanel() {
  const [, forceUpdate] = useState(0)
  const refresh = useCallback(() => forceUpdate((n) => n + 1), [])

  const handleExport = useCallback(() => {
    const config = exportTuningConfig()
    navigator.clipboard.writeText(config).then(() => {
      alert('Config copied to clipboard!')
    }).catch(() => {
      console.log('[TuningPanel] Config:', config)
    })
  }, [])

  const handleReset = useCallback(() => {
    resetTuningConfig()
    refresh()
  }, [refresh])

  return (
    <div className="fixed bottom-0 right-0 z-50 w-80 max-h-[80vh] overflow-y-auto bg-background/95 border border-border rounded-tl-lg shadow-lg p-3 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">🔧 Tuning Panel</h3>
        <div className="flex gap-1">
          <button onClick={handleReset} className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
            Reset
          </button>
          <button onClick={handleExport} className="px-2 py-0.5 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Model Position */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Model Position</p>
        <Slider label="Y Offset" value={tuningConfig.modelYOffset} min={-2} max={2} step={0.05} onChange={(v) => { tuningConfig.modelYOffset = v; refresh() }} />
        <Slider label="Hip Scale X" value={tuningConfig.hipScaleX} min={-2} max={2} step={0.05} onChange={(v) => { tuningConfig.hipScaleX = v; refresh() }} />
        <Slider label="Hip Scale Y" value={tuningConfig.hipScaleY} min={-2} max={2} step={0.05} onChange={(v) => { tuningConfig.hipScaleY = v; refresh() }} />
        <Slider label="Hip Smooth" value={tuningConfig.hipPositionSmoothing} min={0} max={1} step={0.01} onChange={(v) => { tuningConfig.hipPositionSmoothing = v; refresh() }} />
      </div>

      {/* Head Rotation */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Head Rotation</p>
        <Slider label="Head Scale" value={tuningConfig.headScale} min={0} max={1} step={0.05} onChange={(v) => { tuningConfig.headScale = v; refresh() }} />
        <Slider label="Neck Scale" value={tuningConfig.neckScale} min={0} max={1} step={0.05} onChange={(v) => { tuningConfig.neckScale = v; refresh() }} />
      </div>

      {/* Smoothing */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Smoothing</p>
        <Slider label="Expression" value={tuningConfig.expressionSmoothing} min={0} max={1} step={0.05} onChange={(v) => { tuningConfig.expressionSmoothing = v; refresh() }} />
        <Slider label="Head" value={tuningConfig.headSmoothing} min={0} max={1} step={0.05} onChange={(v) => { tuningConfig.headSmoothing = v; refresh() }} />
        <Slider label="Pose Bones" value={tuningConfig.poseSmoothing} min={0} max={1} step={0.05} onChange={(v) => { tuningConfig.poseSmoothing = v; refresh() }} />
      </div>

      {/* Body Pose */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Body Pose</p>
        <Slider label="Spine Scale" value={tuningConfig.spineScale} min={0} max={2} step={0.1} onChange={(v) => { tuningConfig.spineScale = v; refresh() }} />
        <Slider label="Shoulder" value={tuningConfig.shoulderScale} min={0} max={2} step={0.1} onChange={(v) => { tuningConfig.shoulderScale = v; refresh() }} />
        <Slider label="Upper Arm" value={tuningConfig.upperArmScale} min={0} max={2} step={0.1} onChange={(v) => { tuningConfig.upperArmScale = v; refresh() }} />
      </div>

      {/* Face Tracking Camera */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Face Tracking</p>
        <Slider label="Track Scale" value={tuningConfig.faceTrackScale} min={0} max={2} step={0.05} onChange={(v) => { tuningConfig.faceTrackScale = v; refresh() }} />
        <Slider label="Track Smooth" value={tuningConfig.faceTrackSmoothing} min={0} max={1} step={0.01} onChange={(v) => { tuningConfig.faceTrackSmoothing = v; refresh() }} />
      </div>

      {/* Camera */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Camera</p>
        <Slider label="Cam Y" value={tuningConfig.cameraY} min={0} max={3} step={0.1} onChange={(v) => { tuningConfig.cameraY = v; refresh() }} />
        <Slider label="LookAt Y" value={tuningConfig.cameraLookAtY} min={0} max={3} step={0.1} onChange={(v) => { tuningConfig.cameraLookAtY = v; refresh() }} />
        <Slider label="Cam Dist Smooth" value={tuningConfig.cameraDistanceSmoothing} min={0} max={1} step={0.01} onChange={(v) => { tuningConfig.cameraDistanceSmoothing = v; refresh() }} />
        <Slider label="Default Dist" value={tuningConfig.cameraDefaultDistance} min={1} max={8} step={0.1} onChange={(v) => { tuningConfig.cameraDefaultDistance = v; refresh() }} />
        <Slider label="Min Dist" value={tuningConfig.cameraMinDistance} min={0.5} max={4} step={0.1} onChange={(v) => { tuningConfig.cameraMinDistance = v; refresh() }} />
        <Slider label="Max Dist" value={tuningConfig.cameraMaxDistance} min={3} max={12} step={0.5} onChange={(v) => { tuningConfig.cameraMaxDistance = v; refresh() }} />
        <Slider label="Ref Area" value={tuningConfig.cameraReferenceArea} min={0.01} max={0.3} step={0.01} onChange={(v) => { tuningConfig.cameraReferenceArea = v; refresh() }} />
        <Slider label="Z-Depth Scale" value={tuningConfig.cameraDepthScale} min={0} max={10} step={0.5} onChange={(v) => { tuningConfig.cameraDepthScale = v; refresh() }} />
      </div>

      {/* Live Readout */}
      <div className="rounded bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">
        <p>model.pos: <span id="tuning-model-pos">—</span></p>
        <p>hip.pos: <span id="tuning-hip-pos">—</span></p>
        <p>face.offset: <span id="tuning-face-offset">—</span></p>
        <p>cam.dist: <span id="tuning-cam-dist">—</span></p>
      </div>
    </div>
  )
}
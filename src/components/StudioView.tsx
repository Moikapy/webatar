/**
 * StudioView — VTuber-focused layout. Avatar is hero, webcam is PIP.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │ ┌──────┐                                         │
 *   │ │ 📷   │           AVATAR                        │
 *   │ │ PIP  │           (full viewport)               │
 *   │ └──────┘                                         │
 *   │                                                    │
 *   │  [▶ Start]  [🔍 Debug]  [🎯 Scene]  [🎬 Perf]  │
 *   └──────────────────────────────────────────────────┘
 */

import { WebcamOverlay } from './WebcamOverlay'

interface StudioViewProps {
  // Video
  videoRef: React.RefObject<HTMLVideoElement | null>
  // Canvas
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  // State
  state: { status: string }
  error: string | null
  avatarUrl: string | null
  // Tracking data
  showDebugOverlay: boolean
  overlayLayers: { video: boolean; landmarks: boolean; blendShapes: boolean }
  latestLandmarks: ReadonlyArray<{ x: number; y: number; z: number }>
  latestBlendShapes: Record<string, number>
  // Debug
  showDebugScene: boolean
  showTuningPanel: boolean
  pipVisible: boolean
  // Callbacks
  onStart: () => Promise<void>
  onStop: () => void
  onDestroy: () => void
  onToggleDebug: () => void
  onToggleDebugScene: () => void
  onToggleTuning: () => void
  onTogglePip: () => void
  onSetViewMode: (mode: 'studio' | 'performance') => void
}

export function StudioView({
  videoRef,
  canvasRef,
  state,
  error,
  avatarUrl,
  showDebugOverlay,
  overlayLayers,
  latestLandmarks,
  latestBlendShapes,
  showDebugScene,
  showTuningPanel,
  pipVisible,
  onStart,
  onStop,
  onDestroy,
  onToggleDebug,
  onToggleDebugScene,
  onToggleTuning,
  onTogglePip,
  onSetViewMode,
}: StudioViewProps) {
  const isTracking = state.status === 'tracking'
  const isIdle = state.status === 'idle'
  const isInitializing = state.status === 'initializing'
  const isError = state.status === 'error' || state.status === 'stopped'

  return (
    <div className="relative flex-1 bg-muted">
      {/* Avatar canvas — fills the entire viewport */}
      <canvas
        ref={canvasRef}
        id="avatar-canvas"
        className="absolute inset-0 w-full h-full"
      />

      {/* Webcam PIP bubble — top-left corner */}
      {pipVisible && (
        <div className="absolute top-3 left-3 z-20">
          <div className="relative w-48 h-36 rounded-lg overflow-hidden shadow-lg ring-2 ring-border">
            <video
              ref={videoRef}
              id="webcam-video"
              className="absolute inset-0 w-full h-full object-contain"
              autoPlay
              playsInline
              muted
              style={{ transform: 'scaleX(-1)' }}
            />
            {isTracking && (
              <WebcamOverlay
                landmarks={latestLandmarks}
                blendShapes={latestBlendShapes}
                layers={overlayLayers}
                className="w-full h-full"
              />
            )}
            {/* PIP controls */}
            <div className="absolute top-1 right-1 flex gap-1">
              <button
                className={`size-5 flex items-center justify-center rounded text-[10px] transition-colors ${
                  showDebugOverlay
                    ? 'bg-primary/80 text-white'
                    : 'bg-background/60 text-foreground hover:bg-background/80'
                }`}
                onClick={onToggleDebug}
                title="Toggle debug overlay"
              >
                🔍
              </button>
              <button
                className="size-5 flex items-center justify-center rounded bg-background/60 text-foreground hover:bg-background/80 text-[10px] transition-colors"
                onClick={onTogglePip}
                title="Hide webcam"
              >
                ✕
              </button>
            </div>
            {/* Status indicator */}
            {isTracking && (
              <div className="absolute bottom-1 left-1 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] text-white/70 font-mono">LIVE</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show PIP button when hidden */}
      {!pipVisible && (
        <div className="absolute top-3 left-3 z-20">
          <button
            className="px-2 py-1 text-xs rounded bg-background/80 text-muted-foreground hover:text-foreground transition-colors border border-border/50 flex items-center gap-1"
            onClick={onTogglePip}
            title="Show webcam"
          >
            📷 Show
          </button>
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-t from-background/90 via-background/60 to-transparent pt-8">
          {isIdle && (
            <button
              className={avatarUrl ? 'btn-primary' : 'btn-primary opacity-40 cursor-not-allowed'}
              onClick={onStart}
              disabled={!avatarUrl}
            >
              {avatarUrl ? '▶ Start Tracking' : 'Select an Avatar →'}
            </button>
          )}
          {isTracking && (
            <>
              <button
                className="bg-destructive/10 text-destructive hover:bg-destructive/20 px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                onClick={onStop}
              >
                ■ Stop
              </button>
              <button className="btn-outline text-sm" onClick={onDestroy}>
                Reset
              </button>
            </>
          )}
          {isInitializing && (
            <button className="btn-primary opacity-60 cursor-not-allowed" disabled>
              Initializing…
            </button>
          )}
          {isError && (
            <>
              <button className="btn-outline text-sm" onClick={onStart}>
                Retry
              </button>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={onDestroy}>
                Reset
              </button>
            </>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Tool buttons */}
          {isTracking && (
            <>
              <button
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showDebugScene
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
                }`}
                onClick={onToggleDebugScene}
                title="Show 3D debug markers"
              >
                🎯 Scene
              </button>
            </>
          )}
          <button
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showTuningPanel
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            onClick={onToggleTuning}
            title="Tuning panel (Ctrl+D)"
          >
            🔧 Tuning
          </button>
          <button
            className="px-2 py-1 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors border border-primary/30"
            onClick={() => onSetViewMode('performance')}
            title="Fullscreen transparent background for OBS capture"
          >
            🎬 Performance
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}

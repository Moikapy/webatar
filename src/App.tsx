/**
 * Webatar Studio App — ToxSam-inspired editorial dark UI.
 *
 * Features:
 *   - Persisted avatar selection via localStorage
 *   - Tab navigation between Studio, Avatars, Settings
 *   - 50/50 split view: webcam+debug on left, avatar on right
 *   - Real-time face tracking with VRM avatar rendering
 *   - Debug overlay shows landmarks and blend shapes on the webcam feed
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { useWebatar } from './hooks/useWebatar'
import { AvatarGallery } from './components/AvatarGallery'
import { TuningPanel } from './components/TuningPanel'
import { StudioView } from './components/StudioView'
import { tuningConfig } from './tracking/tuning-config'
import type { Avatar } from './osa/types'
import { Badge } from './components/ui/badge'
import { Separator } from './components/ui/separator'
import { useTheme } from './theme'

const STORAGE_KEY = 'webatar-selected-avatar'

/** Save minimal avatar info to localStorage */
function saveAvatar(avatar: Avatar | null): void {
  try {
    if (avatar) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: avatar.id,
        name: avatar.name,
        model_file_url: avatar.model_file_url,
        thumbnail_url: avatar.thumbnail_url,
        metadata: avatar.metadata,
      }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
  }
  } catch { /* localStorage may be unavailable */ }
}

/** Load saved avatar info from localStorage (partial — no project_id etc.) */
function loadAvatar(): Pick<Avatar, 'id' | 'name' | 'model_file_url' | 'thumbnail_url' | 'metadata'> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  idle:          { label: 'Idle',       dot: 'bg-muted-foreground' },
  initializing:  { label: 'Loading…',   dot: 'bg-primary animate-pulse' },
  tracking:      { label: 'Tracking',   dot: 'bg-primary' },
  error:         { label: 'Error',      dot: 'bg-destructive' },
  stopped:       { label: 'Stopped',   dot: 'bg-muted-foreground' },
}

type TabValue = 'studio' | 'avatars' | 'settings'
type ViewMode = 'studio' | 'performance'

export function App() {
  const { theme, toggleTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('studio')
  const [showDebugOverlay, setShowDebugOverlay] = useState(false)
  const [showTuningPanel, setShowTuningPanel] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('studio')
  const [pipVisible, setPipVisible] = useState(true)

  // Restore last-selected avatar from localStorage
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(() => {
    const saved = loadAvatar()
    if (!saved) return null
    return {
      ...saved,
      project_id: '',
      description: '',
      is_public: true,
      created_at: '',
      updated_at: '',
      format: 'VRM' as const,
    } as Avatar
  })

  const avatarUrl = selectedAvatar?.model_file_url ?? null

  const { state, error, start, stop, destroy, setTransparentBg, setDebugScene, latestBlendShapes, latestLandmarks } = useWebatar(
    canvasRef,
    videoRef,
    avatarUrl ?? undefined,
  )

  // Persist avatar selection
  const handleSelectAvatar = useCallback((avatar: Avatar) => {
    setSelectedAvatar(avatar)
    saveAvatar(avatar)
  }, [])

  const handleStart = useCallback(async () => {
    await start()
  }, [start])

  const handleStop = useCallback(() => {
    stop()
  }, [stop])

  const handleDestroy = useCallback(() => {
    destroy()
  }, [destroy])

  const statusConfig = STATUS_LABELS[state.status] ?? STATUS_LABELS.idle

  const overlayLayers = showDebugOverlay
    ? { video: true, landmarks: true, blendShapes: true }
    : { video: false, landmarks: false, blendShapes: false }

  // Sync tuning config overlay/debug flags from state (one-way binding)
  tuningConfig.showOverlay = showDebugOverlay

  // Toggle transparent background when switching to/from performance mode
  useEffect(() => {
    setTransparentBg(viewMode === 'performance')
  }, [viewMode, setTransparentBg])

  // Keyboard shortcut: Ctrl+D to toggle tuning panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        setShowTuningPanel(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Header hidden in performance mode */}
      {viewMode === 'studio' && (
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <nav className="container-custom">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-lg font-bold tracking-tight text-foreground hover:opacity-70 transition-opacity"
              >
                WEBATAR
              </a>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusConfig.dot}`} />
                <span className="text-small text-muted-foreground">{statusConfig.label}</span>
                {state.fps > 0 && (
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {state.fps} fps
                  </span>
                )}
                {state.faceDetected && (
                  <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                    👁 Face
                  </Badge>
                )}
              </div>
            </div>

            {/* Navigation tabs */}
            <div className="flex items-center gap-1">
              {(['studio', 'avatars', 'settings'] as const).map((tab) => {
                const label = tab === 'studio' ? 'Studio' : tab === 'avatars' ? 'Avatars' : 'Settings'
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-small font-medium uppercase tracking-wider transition-colors relative
                      ${isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {label}
                    {tab === 'avatars' && selectedAvatar && (
                      <span className="ml-1 text-primary">✓</span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="ml-2 p-1.5 text-small text-muted-foreground hover:text-foreground transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {selectedAvatar && (
              <div className="flex items-center gap-2 text-small text-muted-foreground">
                <span>🎭 {selectedAvatar.name}</span>
                {selectedAvatar.metadata?.number && (
                  <span className="text-caption">#{selectedAvatar.metadata.number}</span>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>
      )}

      {viewMode === 'studio' && <Separator />}

      {/* ─── Main content ─── */}
      <main className="flex flex-1 flex-col pt-14">
        {/* ─── Studio View — Avatar hero, webcam PIP ─── */}
        {activeTab === 'studio' && viewMode === 'studio' && (
          <StudioView
            videoRef={videoRef}
            canvasRef={canvasRef}
            state={state}
            error={error}
            avatarUrl={avatarUrl}
            showDebugOverlay={showDebugOverlay}
            overlayLayers={overlayLayers}
            latestLandmarks={latestLandmarks}
            latestBlendShapes={latestBlendShapes}
            showDebugScene={tuningConfig.showDebugScene}
            showTuningPanel={showTuningPanel}
            pipVisible={pipVisible}
            onStart={handleStart}
            onStop={handleStop}
            onDestroy={handleDestroy}
            onToggleDebug={() => setShowDebugOverlay(prev => !prev)}
            onToggleDebugScene={() => {
              tuningConfig.showDebugScene = !tuningConfig.showDebugScene
              setDebugScene(tuningConfig.showDebugScene)
            }}
            onToggleTuning={() => setShowTuningPanel(prev => !prev)}
            onTogglePip={() => setPipVisible(prev => !prev)}
            onSetViewMode={setViewMode}
          />
        )}

        {/* Performance View — fullscreen avatar, transparent background for OBS */}
        {activeTab === 'studio' && viewMode === 'performance' && (
          <div className="relative flex-1">
            <canvas
              ref={canvasRef}
              id="avatar-canvas"
              className="w-full h-full"
            />
            {/* Minimal overlay — top right */}
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                className="px-3 py-1.5 text-xs rounded bg-background/80 text-foreground hover:bg-background transition-colors border border-border/50"
                onClick={() => setViewMode('studio')}
                title="Return to Studio mode"
              >
                ✕ Studio
              </button>
            </div>
            {/* Controls — bottom center */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {state.status === 'idle' && (
                <button
                  className={avatarUrl ? 'btn-primary' : 'btn-primary opacity-40 cursor-not-allowed'}
                  onClick={handleStart}
                  disabled={!avatarUrl}
                >
                  Start Tracking
                </button>
              )}
              {state.status === 'tracking' && (
                <button
                  className="bg-destructive/80 text-white hover:bg-destructive px-4 py-2 rounded-md text-sm transition-colors"
                  onClick={handleStop}
                >
                  Stop
                </button>
              )}
              {state.status === 'initializing' && (
                <button className="btn-primary opacity-60 cursor-not-allowed" disabled>
                  Initializing…
                </button>
              )}
            </div>
          </div>
        )}

        {/* Avatars View */}
        {activeTab === 'avatars' && (
          <div className="container-custom section-padding">
            <div className="flex flex-col gap-8">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-caption uppercase tracking-widest text-muted-foreground mb-2">
                    Browse
                  </p>
                  <h2 className="text-headline text-foreground">Avatar Gallery</h2>
                </div>
                {selectedAvatar && (
                  <button
                    className="link-hover text-small text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setActiveTab('studio')}
                  >
                    Go to Studio →
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                <AvatarGallery
                  onSelect={handleSelectAvatar}
                  selectedId={selectedAvatar?.id ?? null}
                />
              </div>

              {selectedAvatar && (
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-small">
                  <span className="font-medium text-foreground">Selected:</span>
                  <span className="text-foreground">{selectedAvatar.name}</span>
                  <span className="text-muted-foreground">#{selectedAvatar.metadata?.number}</span>
                  <a
                    href={selectedAvatar.model_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-primary hover:underline underline-offset-4"
                  >
                    View on Arweave ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeTab === 'settings' && (
          <div className="container-custom section-padding">
            <div className="max-w-2xl">
              <p className="text-caption uppercase tracking-widest text-muted-foreground mb-2">
                Configuration
              </p>
              <h2 className="text-headline text-foreground mb-8">Settings</h2>

              <div className="flex flex-col gap-8">
                {/* Model section */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">VRM Model</h3>
                  <div className="rounded-lg border border-border p-3">
                    <input
                      type="text"
                      value={selectedAvatar?.model_file_url ?? ''}
                      readOnly
                      className="w-full bg-transparent text-sm text-muted-foreground"
                    />
                    <p className="text-caption text-muted-foreground mt-2">
                      Select an avatar from the Avatars tab to change the model.
                    </p>
                  </div>
                </div>

                {/* Tracking section */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Tracking</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-foreground">Pose Tracking</span>
                      <Badge variant="outline" className="border-primary/40 text-primary">On</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-foreground">Smoothing Factor</span>
                      <span className="text-small text-muted-foreground">0.35 (default)</span>
                    </div>
                  </div>
                </div>

                {/* System section */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">System</h3>
                  <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground font-mono">
                    Status: {state.status} · FPS: {state.fps} · Face: {state.faceDetected ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border">
        <div className="container-custom py-6">
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground">
              © 2025 Webatar. Open Source Avatars ↗
            </p>
            <button
              className="text-small text-muted-foreground hover:text-foreground transition-colors link-hover"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Back to Top ↑
            </button>
          </div>
        </div>
      </footer>
      {/* Tuning Panel — Ctrl+D to toggle */}
      {showTuningPanel && <TuningPanel />}
    </div>
  )
}
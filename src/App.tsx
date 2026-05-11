/**
 * Webatar Studio App — ToxSam-inspired editorial dark UI.
 *
 * Features:
 *   - Persisted avatar selection via localStorage
 *   - Tab navigation between Studio, Avatars, Settings
 *   - Real-time face tracking with VRM avatar rendering
 */

import { useRef, useState, useCallback } from 'react'
import { useWebatar } from './hooks/useWebatar'
import { AvatarGallery } from './components/AvatarGallery'
import { WebcamOverlay, type OverlayLayers } from './components/WebcamOverlay'
import type { Avatar } from './osa/types'
import { Badge } from './components/ui/badge'
import { Separator } from './components/ui/separator'

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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('studio')

  const [overlayLayers, setOverlayLayers] = useState<OverlayLayers>({
    video: false,
    landmarks: false,
    blendShapes: false,
  })

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

  const { state, error, start, stop, destroy, latestBlendShapes, latestLandmarks } = useWebatar(
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

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* ─── Header ─── */}
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

      <Separator />

      {/* ─── Main content ─── */}
      <main className="flex flex-1 flex-col pt-14">
        {/* Studio View */}
        {activeTab === 'studio' && (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col lg:flex-row">
              {/* Camera panel — hidden when overlay video is active (avoid duplicate) */}
              <aside className={`w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border ${overlayLayers.video ? 'hidden lg:hidden' : ''}`}>
                <div className="p-4">
                  <p className="text-caption uppercase tracking-widest text-muted-foreground mb-3">
                    Camera
                  </p>
                  <video
                    ref={videoRef}
                    id="webcam-video"
                    className="aspect-video w-full rounded-lg bg-muted"
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
              </aside>

              {/* Avatar canvas */}
              <div className="flex flex-1 flex-col items-center justify-center p-4 lg:p-8">
                <div className="relative w-full max-w-3xl">
                  <canvas
                    ref={canvasRef}
                    id="avatar-canvas"
                    className="aspect-square w-full rounded-lg bg-muted"
                  />
                  <WebcamOverlay
                    videoRef={videoRef}
                    landmarks={latestLandmarks}
                    blendShapes={latestBlendShapes}
                    layers={overlayLayers}
                    className="aspect-square w-full rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Controls footer */}
            <div className="flex items-center justify-center gap-3 border-t border-border px-6 py-4">
              {state.status === 'idle' && (
                <button
                  className={avatarUrl ? 'btn-primary' : 'btn-primary opacity-40 cursor-not-allowed'}
                  onClick={handleStart}
                  disabled={!avatarUrl}
                >
                  {avatarUrl ? 'Start Tracking' : 'Select an Avatar →'}
                </button>
              )}
              {state.status === 'tracking' && (
                <>
                  <button className="bg-destructive/10 text-destructive hover:bg-destructive/20 px-6 py-3 rounded-md font-medium text-sm transition-colors" onClick={handleStop}>
                    Stop
                  </button>
                  <button className="btn-outline" onClick={handleDestroy}>
                    Reset
                  </button>
                </>
              )}
              {state.status === 'initializing' && (
                <button className="btn-primary opacity-60 cursor-not-allowed" disabled>
                  Initializing…
                </button>
              )}
              {(state.status === 'error' || state.status === 'stopped') && (
                <>
                  <button className="btn-outline" onClick={handleStart}>
                    Retry
                  </button>
                  <button className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={handleDestroy}>
                    Reset
                  </button>
                </>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Debug overlay toggles — video is the master switch */}
              {state.status === 'tracking' && (
                <div className="flex items-center gap-1 ml-4">
                  <button
                    className={`px-2 py-1 text-xs rounded transition-colors ${overlayLayers.video ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setOverlayLayers(prev => ({ ...prev, video: !prev.video }))}
                  >
                    🎥 Video
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded transition-colors ${overlayLayers.landmarks && overlayLayers.video ? 'bg-primary/20 text-primary' : !overlayLayers.video ? 'opacity-40 cursor-not-allowed bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    onClick={() => overlayLayers.video && setOverlayLayers(prev => ({ ...prev, landmarks: !prev.landmarks }))}
                    disabled={!overlayLayers.video}
                  >
                    📍 Landmarks
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded transition-colors ${overlayLayers.blendShapes && overlayLayers.video ? 'bg-primary/20 text-primary' : !overlayLayers.video ? 'opacity-40 cursor-not-allowed bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    onClick={() => overlayLayers.video && setOverlayLayers(prev => ({ ...prev, blendShapes: !prev.blendShapes }))}
                    disabled={!overlayLayers.video}
                  >
                    🏷️ Shapes
                  </button>
                </div>
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
    </div>
  )
}
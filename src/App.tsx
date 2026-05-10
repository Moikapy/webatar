/**
 * Webatar Studio App — Three views: Studio, Avatars, Settings.
 *
 * - Studio: Full-screen camera + avatar rendering + controls
 * - Avatars: Full-screen gallery grid to browse/pick avatars
 * - Settings: Configuration (VRM URL, tracking options, etc.)
 */

import { useRef, useState, useCallback } from 'react'
import { useWebatar } from './hooks/useWebatar'
import { AvatarGallery } from './components/AvatarGallery'
import type { Avatar } from './osa/types'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card, CardContent } from './components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { Separator } from './components/ui/separator'

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  idle: { label: 'Idle', variant: 'outline' },
  initializing: { label: 'Loading…', variant: 'secondary' },
  tracking: { label: 'Tracking', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
  stopped: { label: 'Stopped', variant: 'outline' },
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const avatarUrl = selectedAvatar?.model_file_url ?? null

  const { state, error, start, stop, destroy } = useWebatar(
    canvasRef,
    videoRef,
    avatarUrl ?? undefined,
  )

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
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            🐉 <span className="text-primary">Webatar</span>
          </h1>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          {state.fps > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {state.fps} fps
            </span>
          )}
          {state.faceDetected && (
            <Badge variant="outline" className="gap-1">
              👁 Face detected
            </Badge>
          )}
        </div>
        {selectedAvatar && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>🎭 {selectedAvatar.name}</span>
            {selectedAvatar.metadata?.number && (
              <span className="text-xs">#{selectedAvatar.metadata.number}</span>
            )}
          </div>
        )}
      </header>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="studio" className="flex flex-1 flex-col overflow-hidden">
        <TabsList variant="line" className="mx-6 mt-2">
          <TabsTrigger value="studio">🎬 Studio</TabsTrigger>
          <TabsTrigger value="avatars">🧑‍🎨 Avatars ({selectedAvatar ? '1 selected' : 'none'})</TabsTrigger>
          <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
        </TabsList>

        <Separator />

        {/* Studio View */}
        <TabsContent value="studio" className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col lg:flex-row">
            {/* Camera */}
            <aside className="w-full lg:w-80">
              <Card className="h-full rounded-none border-0 border-b lg:border-b-0 lg:border-r">
                <CardContent className="p-4">
                  <video
                    ref={videoRef}
                    id="webcam-video"
                    className="aspect-video w-full rounded-lg bg-muted"
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </CardContent>
              </Card>
            </aside>

            {/* Avatar canvas */}
            <div className="flex flex-1 items-center justify-center p-4 lg:p-6">
              <Card className="w-full max-w-3xl">
                <CardContent className="flex items-center justify-center p-2">
                  <canvas
                    ref={canvasRef}
                    id="avatar-canvas"
                    className="aspect-square w-full rounded-lg bg-muted"
                  />
                </CardContent>
              </Card>
            </div>
          </main>

          {/* Controls */}
          <footer className="flex items-center justify-center gap-3 border-t border-border px-6 py-4">
            {state.status === 'idle' && (
              <Button
                variant="default"
                size="lg"
                onClick={handleStart}
                disabled={!avatarUrl}
              >
                Start Tracking
              </Button>
            )}
            {state.status === 'tracking' && (
              <>
                <Button variant="destructive" size="lg" onClick={handleStop}>
                  Stop
                </Button>
                <Button variant="outline" size="lg" onClick={handleDestroy}>
                  Reset
                </Button>
              </>
            )}
            {(state.status === 'initializing') && (
              <Button variant="secondary" size="lg" disabled>
                Initializing…
              </Button>
            )}
            {(state.status === 'error' || state.status === 'stopped') && (
              <>
                <Button variant="outline" size="lg" onClick={handleStart}>
                  Retry
                </Button>
                <Button variant="ghost" size="lg" onClick={handleDestroy}>
                  Reset
                </Button>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </footer>
        </TabsContent>

        {/* Avatars View */}
        <TabsContent value="avatars" className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center p-6">
            <Card className="w-full max-w-4xl h-full flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-4 p-6 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Avatar Gallery</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedAvatar}
                    onClick={() => {
                      const tabs = document.querySelector('[data-slot="tabs"]') as HTMLDivElement
                      const studioBtn = tabs?.querySelector('[value="studio"]') as HTMLButtonElement
                      if (studioBtn) studioBtn.click()
                    }}
                  >
                    Go to Studio →
                  </Button>
                </div>
                <AvatarGallery
                  onSelect={setSelectedAvatar}
                  selectedId={selectedAvatar?.id ?? null}
                />
                {selectedAvatar && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                    <span className="font-medium">Selected:</span>
                    <span>{selectedAvatar.name}</span>
                    <span className="text-muted-foreground">#{selectedAvatar.metadata?.number}</span>
                    <a
                      href={selectedAvatar.model_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-primary hover:underline"
                    >
                      View on Arweave →
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings View */}
        <TabsContent value="settings" className="flex flex-1">
          <div className="mx-auto w-full max-w-2xl p-6">
            <Card>
              <CardContent className="flex flex-col gap-6 p-6">
                <h2 className="text-lg font-semibold">Settings</h2>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">VRM Model URL</label>
                  <input
                    type="text"
                    value={selectedAvatar?.model_file_url ?? ''}
                    readOnly
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Select an avatar from the <em>Avatars</em> tab to change the model.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Tracking</label>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm">Pose Tracking</span>
                    <Badge variant="outline">On</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm">Smoothing Factor</span>
                    <span className="text-sm text-muted-foreground">0.35 (default)</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">System</label>
                  <div className="rounded-md border border-border p-3 text-xs text-muted-foreground font-mono">
                    Status: {state.status} | FPS: {state.fps} | Face: {state.faceDetected ? 'Yes' : 'No'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

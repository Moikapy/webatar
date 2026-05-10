/**
 * Webatar App — Webcam-driven real-time VRM avatar animation.
 *
 * Uses useWebatar hook to orchestrate:
 *   - Camera permission + stream
 *   - MediaPipe face tracking
 *   - Three.js VRM rendering
 *   - Expression + head rotation application
 */

import { useRef, useState, useCallback } from 'react'
import { useWebatar } from './hooks/useWebatar'
import { AvatarGallery } from './components/AvatarGallery'
import type { Avatar } from './osa/types'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
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
        <h1 className="text-xl font-bold tracking-tight">
          🐉 <span className="text-primary">Webatar</span>
        </h1>
        <div className="flex items-center gap-3">
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
      </header>

      {/* ─── Main ─── */}
      <main className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Sidebar: Camera + Avatar Gallery */}
        <aside className="flex w-full flex-col lg:w-80 overflow-y-auto">
          <Card className="rounded-none border-0 border-b lg:border-b-0 lg:border-r">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                Camera
              </CardTitle>
            </CardHeader>
            <CardContent>
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

          <div className="border-t border-border p-4">
            <AvatarGallery
              onSelect={setSelectedAvatar}
              selectedId={selectedAvatar?.id ?? null}
            />
          </div>
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

      <Separator />

      {/* ─── Controls ─── */}
      <footer className="flex flex-col items-center justify-center gap-3 px-6 py-4 sm:flex-row">
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

        {selectedAvatar && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>🎭 {selectedAvatar.name}</span>
            {selectedAvatar.metadata?.number && (
              <span className="text-xs">#{selectedAvatar.metadata.number}</span>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </footer>
    </div>
  )
}

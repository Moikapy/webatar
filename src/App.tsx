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

  const [avatarUrl, setAvatarUrl] = useState<string>(
    'https://arweave.net/DUHQfXxfFPjlMzBoCyYD0Kuz7vwD7eZkT-9eOIJByzY',
  )

  const { state, error, start, stop, destroy } = useWebatar(
    canvasRef,
    videoRef,
    avatarUrl,
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
      <main className="flex flex-1 flex-col lg:flex-row">
        {/* Camera sidebar */}
        <aside className="w-full lg:w-72">
          <Card className="h-full rounded-none border-0 border-b lg:border-b-0 lg:border-r">
            <CardHeader>
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
          <Button variant="default" size="lg" onClick={handleStart}>
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

        {/* Avatar URL input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="VRM URL"
            className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </footer>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { WebatarEngine } from './engine'
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
  const [status, setStatus] = useState<string>('idle')
  const [fps, setFps] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // @ts-expect-error TS6133 — will be used when engine wires up with React state
  const _engineRef = useState<WebatarEngine | null>(null)[0]

  const handleStart = useCallback(async () => {
    const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement
    if (!canvas) return

    const engine = new WebatarEngine({
      canvas,
      enablePoseTracking: true,
      smoothingFactor: 0.35,
    })

    engine.onStateChange((state) => {
      setStatus(state.status)
      setFps(state.fps)
      setFaceDetected(state.faceDetected)
      if (state.error) setError(state.error)
    })

    try {
      await engine.init()
      engine.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Init failed')
    }
  }, [])

  const handleStop = useCallback(() => {
    // engineRef will be used when we wire up full lifecycle
  }, [])

  const statusConfig = STATUS_LABELS[status] ?? STATUS_LABELS.idle

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-xl font-bold tracking-tight">
          🐉 <span className="text-primary">Webatar</span>
        </h1>
        <div className="flex items-center gap-3">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          {fps > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {fps} fps
            </span>
          )}
          {faceDetected && (
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
                id="avatar-canvas"
                className="aspect-square w-full rounded-lg bg-muted"
              />
            </CardContent>
          </Card>
        </div>
      </main>

      <Separator />

      {/* ─── Controls ─── */}
      <footer className="flex items-center justify-center gap-4 px-6 py-4">
        {status === 'idle' && (
          <Button variant="default" size="lg" onClick={handleStart}>
            Start Tracking
          </Button>
        )}
        {status === 'tracking' && (
          <Button variant="destructive" size="lg" onClick={handleStop}>
            Stop
          </Button>
        )}
        {(status === 'initializing') && (
          <Button variant="secondary" size="lg" disabled>
            Initializing…
          </Button>
        )}
        {(status === 'error' || status === 'stopped') && (
          <Button variant="outline" size="lg" onClick={handleStart}>
            Retry
          </Button>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </footer>
    </div>
  )
}
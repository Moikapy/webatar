import { useState, useCallback } from 'react'
import { WebatarEngine } from './engine'

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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight">
          🐉 <span className="text-emerald-400">Webatar</span>
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="px-2 py-1 rounded bg-gray-800">{status}</span>
          {fps > 0 && <span className="text-gray-400">{fps} fps</span>}
          {faceDetected && <span className="text-emerald-400">👁 Face detected</span>}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Video preview (small) */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-800 p-4">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Camera</h2>
          <video
            id="webcam-video"
            className="w-full rounded-lg bg-gray-900"
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
          />
        </aside>

        {/* Avatar canvas (main) */}
        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            id="avatar-canvas"
            className="w-full max-w-3xl aspect-square rounded-lg bg-gray-900"
          />
        </div>
      </main>

      {/* Controls */}
      <footer className="px-6 py-4 border-t border-gray-800 flex items-center justify-center gap-4">
        {status === 'idle' && (
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
          >
            Start Tracking
          </button>
        )}
        {status === 'tracking' && (
          <button
            onClick={handleStop}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
          >
            Stop
          </button>
        )}
        {error && (
          <p className="text-red-400 text-sm">Error: {error}</p>
        )}
      </footer>
    </div>
  )
}
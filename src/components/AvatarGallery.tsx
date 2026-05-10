/**
 * AvatarGallery — Browse and select VRM avatars from OSA registry.
 *
 * Fetches MVP collections (R1–R3) thumbnails from Arweave,
 * displays them in a scrollable grid, and lets users pick one.
 */

import { useState, useEffect, useCallback } from 'react'
import { OSAClient } from '../osa/client'
import type { Avatar } from '../osa/types'

interface AvatarGalleryProps {
  onSelect: (avatar: Avatar) => void
  selectedId?: string | null
}

export function AvatarGallery({ onSelect, selectedId }: AvatarGalleryProps) {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAvatars = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = new OSAClient()
      const data = await client.fetchMVPAvatars()
      // Only show avatars that have a thumbnail and model URL
      const valid = data.filter(
        (a) => a.thumbnail_url && a.model_file_url,
      )
      setAvatars(valid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatars')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAvatars()
  }, [fetchAvatars])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading avatars…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm text-destructive">
        <p>{error}</p>
        <button
          onClick={fetchAvatars}
          className="rounded-md bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Select Avatar ({avatars.length} available)
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 overflow-y-auto max-h-60">
        {avatars.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => onSelect(avatar)}
            className={`group relative aspect-square overflow-hidden rounded-lg border transition-all hover:ring-2 hover:ring-primary ${
              selectedId === avatar.id
                ? 'ring-2 ring-primary border-primary'
                : 'border-border'
            }`}
            title={`${avatar.name} (${avatar.metadata?.number ?? ''})`}
          >
            <img
              src={avatar.thumbnail_url}
              alt={avatar.name}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white truncate">
              {avatar.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
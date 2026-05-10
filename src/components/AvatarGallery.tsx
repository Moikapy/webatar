/**
 * AvatarGallery — Browse and select VRM avatars from OSA registry.
 *
 * Features:
 *   - Search by name or number
 *   - Pagination (25 per page)
 *   - Denylist filtering (e.g. skip devil avatars)
 *   - Thumbnail grid with selection ring
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { OSAClient } from '../osa/client'
import type { Avatar } from '../osa/types'
import { Button } from './ui/button'

const PAGE_SIZE = 25

/** Avatar names / terms we skip. Case-insensitive substring match. */
const DENYLIST = ['devil']

interface AvatarGalleryProps {
  onSelect: (avatar: Avatar) => void
  selectedId?: string | null
}

export function AvatarGallery({ onSelect, selectedId }: AvatarGalleryProps) {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')

  const fetchAvatars = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = new OSAClient()
      const data = await client.fetchMVPAvatars()
      const valid = data.filter(
        (a) =>
          a.thumbnail_url && a.model_file_url &&
          !DENYLIST.some((d) => a.name.toLowerCase().includes(d.toLowerCase())),
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

  // Filter by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return avatars
    return avatars.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        String(a.metadata?.number ?? '').includes(q),
    )
  }, [avatars, query])

  // Pagination
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const start = (clampedPage - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, total)
  const pageItems = filtered.slice(start, end)

  const effectivePage = clampedPage !== page ? clampedPage : page

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading avatars…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-destructive">
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
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name or number…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            🔍
          </span>
        </div>
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setPage(1)
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
        <span>
          {total === 0
            ? 'No avatars found'
            : `Showing ${start + 1}-${end} of ${total} avatars`}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 overflow-y-auto flex-1">
        {pageItems.map((avatar) => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={effectivePage <= 1}
          >
            ← Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {effectivePage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={effectivePage >= totalPages}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}

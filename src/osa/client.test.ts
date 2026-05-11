import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OSAClient } from './client'
import { PROJECT_SCHEMA, AVATAR_SCHEMA } from './types'
import type { Project, Avatar } from './types'

const BASE_URL = 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data'

// Sample project data matching real OSA registry structure
const SAMPLE_PROJECTS: Project[] = [
  {
    id: '100avatars-r1',
    name: '100Avatars R1',
    creator_id: 'Polygonal-Mind',
    description: 'The first 100 avatars series (001-100)',
    is_public: true,
    license: 'CC0' as const,
    source_type: 'original' as const,
    storage_type: 'arweave',
    created_at: '2025-03-11T16:41:51.487Z',
    updated_at: '2025-03-11T16:41:51.487Z',
    avatar_data_file: 'avatars/100avatars-r1.json',
  },
]

const SAMPLE_AVATARS: Avatar[] = [
  {
    id: '27ccb24c-1fa1-4931-afed-e182b062c950',
    name: 'Devil',
    project_id: '100avatars-r1',
    description: 'Avatar 031: Devil',
    model_file_url: 'https://arweave.net/gfVzs1oH_aPaHVxpQK86HT_rqzyrFPOUKUrDJ30yprs',
    format: 'VRM' as const,
    is_public: true,
    is_draft: false,
    created_at: '2025-03-11T16:41:51.487Z',
    updated_at: '2025-03-11T16:41:51.487Z',
    thumbnail_url: 'https://arweave.net/llxwUMPCfar71x4hLTU4f1-pcsYeGDUD4Gxm1dhWaDg',
    metadata: {
      number: '031',
      series: 'R1',
      alternateModels: {
        voxel_fbx: 'https://arweave.net/t3xpaO7LFIWYhjZt1x7tAS-rm0uzTPh9eD0az1mx2Sc',
        fbx: 'https://arweave.net/-a5bUj2LqCDZq4eDPu2LOXLTNP0GZbfpyHnbn4NxuRM',
        voxel_vrm: 'https://arweave.net/KjeHShYtrG2gwa94z9f4ggRVBjHHbpWY276PPozpqgM',
      },
    },
  },
]

describe('OSAClient', () => {
  let client: OSAClient

  beforeEach(() => {
    client = new OSAClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetchResponse(data: unknown, status = 200): void {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  describe('fetchProjects', () => {
    it('fetches and validates project list from OSA registry', async () => {
      mockFetchResponse(SAMPLE_PROJECTS)

      const projects = await client.fetchProjects()

      expect(projects).toHaveLength(1)
      expect(projects[0].id).toBe('100avatars-r1')
      expect(projects[0].license).toBe('CC0')
      expect(projects[0].avatar_data_file).toBe('avatars/100avatars-r1.json')
    })

    it('constructs correct URL from base URL', async () => {
      const mockFn = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(SAMPLE_PROJECTS), { status: 200 }),
      )

      await client.fetchProjects()

      expect(mockFn).toHaveBeenCalledWith(
        `${BASE_URL}/projects.json`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    it('throws on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      await expect(client.fetchProjects()).rejects.toThrow('Network error')
    })

    it('throws on non-200 status code', async () => {
      mockFetchResponse({ error: 'Not found' }, 404)

      await expect(client.fetchProjects()).rejects.toThrow()
    })

    it('validates project schema against Zod', async () => {
      mockFetchResponse(SAMPLE_PROJECTS)

      const projects = await client.fetchProjects()

      const parsed = PROJECT_SCHEMA.array().parse(projects)
      expect(parsed).toHaveLength(1)
    })
  })

  describe('fetchAvatars', () => {
    it('fetches and validates avatars for a project', async () => {
      client.fetchProjects = async () => SAMPLE_PROJECTS
      mockFetchResponse(SAMPLE_AVATARS)

      const avatars = await client.fetchAvatars('100avatars-r1')

      expect(avatars).toHaveLength(1)
      expect(avatars[0].name).toBe('Devil')
      expect(avatars[0].format).toBe('VRM')
      expect(avatars[0].model_file_url).toContain('arweave.net')
    })

    it('constructs correct avatar URL from project ID', async () => {
      const mockFn = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(SAMPLE_AVATARS), { status: 200 }),
      )
      client.fetchProjects = async () => SAMPLE_PROJECTS

      await client.fetchAvatars('100avatars-r1')

      expect(mockFn).toHaveBeenCalledWith(
        `${BASE_URL}/avatars/100avatars-r1.json`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    it('validates avatar schema against Zod', async () => {
      client.fetchProjects = async () => SAMPLE_PROJECTS
      mockFetchResponse(SAMPLE_AVATARS)

      const avatars = await client.fetchAvatars('100avatars-r1')

      const parsed = AVATAR_SCHEMA.array().parse(avatars)
      expect(parsed).toHaveLength(1)
    })

    it('includes alternateModels when present', async () => {
      client.fetchProjects = async () => SAMPLE_PROJECTS
      mockFetchResponse(SAMPLE_AVATARS)

      const avatars = await client.fetchAvatars('100avatars-r1')

      expect(avatars[0].metadata?.alternateModels?.fbx).toBeDefined()
    })
  })

  describe('fetchMVPProjects', () => {
    it('fetches only MVP collections (R1–R3)', async () => {
      const allProjects: Project[] = [
        ...SAMPLE_PROJECTS,
        {
          id: 'vipe-heroes-genesis',
          name: 'VIPE Heroes Genesis',
          creator_id: 'vipe',
          description: 'Genesis collection',
          is_public: true,
          license: 'CC-BY' as const,
          source_type: 'nft' as const,
          storage_type: 'ipfs',
          created_at: '2023-06-01T17:14:15.854Z',
          updated_at: '2026-01-17T09:35:20.372Z',
          avatar_data_file: 'avatars/vipe-heroes-genesis.json',
        },
      ]
      mockFetchResponse(allProjects)

      const mvpProjects = await client.fetchMVPProjects()

      expect(mvpProjects).toHaveLength(1)
      expect(mvpProjects[0].id).toBe('100avatars-r1')
    })
  })

  describe('fetchMVPAvatars', () => {
    it('fetches all avatars from MVP collections', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(SAMPLE_AVATARS), { status: 200 }),
      )
      client.fetchProjects = async () => SAMPLE_PROJECTS

      const avatars = await client.fetchMVPAvatars()

      expect(avatars.length).toBeGreaterThan(0)
    })
  })

  describe('caching', () => {
    it('caches project list and does not re-fetch within TTL', async () => {
      let fetchCount = 0
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        fetchCount++
        return new Response(JSON.stringify(SAMPLE_PROJECTS), { status: 200 })
      })

      await client.fetchProjects()
      await client.fetchProjects()

      expect(fetchCount).toBe(1)
    })

    it('bypasses cache when forceRefresh is true', async () => {
      let fetchCount = 0
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        fetchCount++
        return new Response(JSON.stringify(SAMPLE_PROJECTS), { status: 200 })
      })

      await client.fetchProjects()
      await client.fetchProjects(true) // force refresh

      expect(fetchCount).toBe(2)
    })
  })

  describe('fetch timeout', () => {
    it('uses AbortController signal in fetch calls', async () => {
      const mockFn = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(SAMPLE_PROJECTS), { status: 200 }),
      )

      await client.fetchProjects()

      // Verify that fetch was called with an AbortSignal
      const call = mockFn.mock.calls[0]
      expect(call[1]).toHaveProperty('signal')
      expect(call[1]!.signal).toBeInstanceOf(AbortSignal)
    })
  })
})
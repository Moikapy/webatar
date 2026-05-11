import { PROJECT_SCHEMA, AVATAR_SCHEMA } from './types'
import type { Project, Avatar } from './types'
import { OSA_DATA_BASE_URL, MVP_COLLECTION_IDS } from '../constants'

/**
 * Client for the Open Source Avatars registry.
 *
 * Fetches project and avatar data from static JSON on GitHub raw.
 * Caches aggressively (1hr TTL) since data is immutable.
 * No auth needed.
 */
export class OSAClient {
  private projectCache: Project[] | null = null
  private avatarCache: Map<string, Avatar[]> = new Map()
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL_MS = 3600_000 // 1 hour
  private readonly FETCH_TIMEOUT_MS = 10_000 // 10 seconds

  constructor(private readonly baseUrl: string = OSA_DATA_BASE_URL) {}

  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Fetch all projects from the registry.
   * Results are cached for 1 hour.
   */
  async fetchProjects(forceRefresh = false): Promise<Project[]> {
    const now = Date.now()
    if (!forceRefresh && this.projectCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.projectCache
    }

    const url = `${this.baseUrl}/projects.json`
    const response = await this.fetchWithTimeout(url)

    if (!response.ok) {
      throw new Error(`OSA fetch failed: ${response.status} ${response.statusText}`)
    }

    const raw = await response.json()
    const projects = PROJECT_SCHEMA.array().parse(raw)

    this.projectCache = projects
    this.cacheTimestamp = now
    return projects
  }

  /**
   * Fetch avatars for a specific project/collection.
   * Results are cached per project ID.
   */
  async fetchAvatars(projectId: string, forceRefresh = false): Promise<Avatar[]> {
    if (!forceRefresh && this.avatarCache.has(projectId)) {
      return this.avatarCache.get(projectId)!
    }

    // Resolve avatar_data_file from project list
    const projects = await this.fetchProjects()
    const project = projects.find((p) => p.id === projectId)

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const url = `${this.baseUrl}/${project.avatar_data_file}`
    const response = await this.fetchWithTimeout(url)

    if (!response.ok) {
      throw new Error(`OSA avatar fetch failed: ${response.status} ${response.statusText}`)
    }

    const raw = await response.json()
    const avatars = AVATAR_SCHEMA.array().parse(raw)

    this.avatarCache.set(projectId, avatars)
    return avatars
  }

  /**
   * Fetch only MVP projects (100 Avatars R1–R3, all CC0).
   */
  async fetchMVPProjects(): Promise<Project[]> {
    const allProjects = await this.fetchProjects()
    const mvpIds = new Set(MVP_COLLECTION_IDS)
    return allProjects.filter((p) => mvpIds.has(p.id as (typeof MVP_COLLECTION_IDS)[number]))
  }

  /**
   * Fetch all avatars from MVP collections.
   */
  async fetchMVPAvatars(): Promise<Avatar[]> {
    const mvpProjects = await this.fetchMVPProjects()
    const allAvatars: Avatar[] = []

    for (const project of mvpProjects) {
      const avatars = await this.fetchAvatars(project.id)
      allAvatars.push(...avatars)
    }

    return allAvatars
  }
}
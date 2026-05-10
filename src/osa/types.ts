import { z } from 'zod'

/**
 * Zod schemas for the Open Source Avatars registry data.
 * Matches the API at https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data/
 *
 * See Spec.md §4 for complete type definitions.
 */

export const PROJECT_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  creator_id: z.string(),
  description: z.string(),
  is_public: z.boolean(),
  license: z.enum(['CC0', 'CC-BY']),
  source_type: z.enum(['original', 'nft']),
  storage_type: z.union([z.string(), z.array(z.string())]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  avatar_data_file: z.string(),
  source_network: z.union([z.string(), z.array(z.string())]).optional(),
  source_contract: z.union([z.string(), z.array(z.string())]).optional(),
  opensea_url: z.string().url().optional(),
})

export const AVATAR_SCHEMA = z.object({
  id: z.string().uuid(),
  name: z.string(),
  project_id: z.string(),
  description: z.string(),
  model_file_url: z.string().url(),
  format: z.literal('VRM'),
  is_public: z.boolean(),
  is_draft: z.boolean().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  thumbnail_url: z.string().url(),
  metadata: z
    .object({
      number: z.string(),
      series: z.string(),
      alternateModels: z
        .object({
          fbx: z.string().url().optional(),
          voxel_fbx: z.string().url().optional(),
          voxel_vrm: z.string().url().optional(),
        })
        .optional(),
      ardriveFiles: z
        .object({
          models: z.array(z.string()).optional(),
          thumbnails: z.array(z.string()).optional(),
          textures: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .passthrough()
    .optional(),
})

export type Project = z.infer<typeof PROJECT_SCHEMA>
export type Avatar = z.infer<typeof AVATAR_SCHEMA>
import createClient from 'openapi-fetch'
import type { paths } from './generated'

export const createApiClient = (baseUrl: string, token?: string): ReturnType<typeof createClient<paths>> =>
  createClient<paths>({
    baseUrl,
    headers: token !== undefined ? { Authorization: `Bearer ${token}` } : {},
  })

export type { paths, components } from './generated'

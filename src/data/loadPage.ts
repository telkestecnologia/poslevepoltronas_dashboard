import {
  api,
  type Branch,
  type Chair,
  type ChairOption,
  type ChairQuery,
  type ManualBlock,
  type Municipality,
} from '../api'
import type { Page } from '../types'

export type PageData =
  | {
      page: 'chairs'
      chairs: Chair[]
      total: number
      options: ChairOption[]
      branches: Branch[]
      blocks: ManualBlock[]
    }
  | {
      page: 'branches'
      branches: Branch[]
      activeCounts: Record<string, number>
      municipalities: Municipality[]
    }

// Each page requests only the data its screen needs. The overview has no API data yet.
export async function loadPage(
  credentials: string,
  page: Page,
  chairQuery: ChairQuery,
): Promise<PageData | null> {
  if (page === 'chairs') {
    const [result, options, branches, blocks] = await Promise.all([
      api.chairs(credentials, chairQuery),
      api.chairOptions(credentials),
      api.branches(credentials),
      api.blocks(credentials),
    ])
    return {
      page,
      chairs: result.items,
      total: result.total,
      options,
      branches,
      blocks,
    }
  }
  if (page === 'branches') {
    const [branches, activeCounts, municipalities] = await Promise.all([
      api.branches(credentials),
      api.activeChairCounts(credentials),
      api.municipalities(credentials),
    ])
    return { page, branches, activeCounts, municipalities }
  }
  return null
}

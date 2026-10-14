import {
  api,
  type AiKnowledge,
  type AiUnansweredQuestion,
  type Branch,
  type Chair,
  type ChairOption,
  type ChairQuery,
  type Courier,
  type ManualBlock,
  type Municipality,
  type Order,
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
  | { page: 'couriers'; couriers: Courier[] }
  | { page: 'orders'; orders: Order[]; couriers: Courier[]; branches: Branch[]; options: ChairOption[] }
  | { page: 'ai'; knowledge: AiKnowledge[]; unanswered: AiUnansweredQuestion[] }

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
  if (page === 'couriers') {
    return { page, couriers: await api.couriers(credentials) }
  }
  if (page === 'orders') {
    const [orders, couriers, branches, options] = await Promise.all([
      api.orders(credentials), api.couriers(credentials), api.branches(credentials), api.chairOptions(credentials),
    ])
    return { page, orders, couriers, branches, options }
  }
  if (page === 'ai') {
    const [knowledge, unanswered] = await Promise.all([
      api.aiKnowledge(credentials), api.aiUnanswered(credentials),
    ])
    return { page, knowledge, unanswered }
  }
  return null
}

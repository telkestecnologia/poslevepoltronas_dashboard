import type { Branch, Chair } from './api'

export type Page = 'overview' | 'chairs' | 'branches'
export type Modal =
  | { kind: 'newChair' }
  | { kind: 'editChair'; chair: Chair }
  | { kind: 'newBranch' }
  | { kind: 'editBranch'; branch: Branch }
  | null

export const CHAIR_PAGE_SIZE = 10

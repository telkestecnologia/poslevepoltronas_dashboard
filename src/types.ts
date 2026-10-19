import type { Branch, Chair, Courier } from './api'

export type Page = 'overview' | 'finance' | 'chairs' | 'branches' | 'couriers' | 'orders' | 'ai' | 'notifications'
export type Modal =
  | { kind: 'newChair' }
  | { kind: 'editChair'; chair: Chair }
  | { kind: 'newBranch' }
  | { kind: 'editBranch'; branch: Branch }
  | { kind: 'newCourier' }
  | { kind: 'editCourier'; courier: Courier }
  | null

export const CHAIR_PAGE_SIZE = 10

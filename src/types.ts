import type { Branch, Chair, Courier } from './api'

export type Page = 'overview' | 'finance' | 'chairs' | 'branches' | 'couriers' | 'agenda' | 'manualOrder' | 'orders' | 'conversations' | 'ai' | 'notifications' | 'payments' | 'profile'
export type Modal =
  /** branchId: aberta de dentro da filial, a poltrona já é cadastrada nela (sem escolher a filial). */
  | { kind: 'newChair'; branchId?: string }
  | { kind: 'editChair'; chair: Chair }
  | { kind: 'newBranch' }
  | { kind: 'editBranch'; branch: Branch }
  | { kind: 'newCourier' }
  | { kind: 'editCourier'; courier: Courier }
  | null

export const CHAIR_PAGE_SIZE = 10

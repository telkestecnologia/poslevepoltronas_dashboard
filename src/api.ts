export type ChairStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'

export type Chair = {
  id: string
  code: string
  model: string
  status: ChairStatus
  notes: string
  branchId: string
  createdAt: string
  updatedAt: string
}

export type Staff = { slug: string; tenantName: string; displayName: string; email: string }

export type Branch = { id: string; name: string; cities: { city: string; uf: string }[]; active: boolean }
export type BranchInput = { name: string; cities: { city: string; uf: string }[]; active: boolean }

export const localLoginBypass = __DASHBOARD_DEV_LOGIN_BYPASS__
const baseUrl = localLoginBypass ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
export const tenantSlug = import.meta.env.VITE_TENANT_SLUG || 'pos-leve'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(credentials: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/admin/${encodeURIComponent(tenantSlug)}${path}`, {
      ...init,
      headers: {
        ...(credentials ? { Authorization: `Basic ${credentials}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Confira se o backend está ligado.')
  }

  if (!response.ok) {
    const message = response.status === 401 ? 'E-mail ou senha inválidos.'
      : response.status === 403 ? 'Sua conta não tem acesso a esta locadora.'
      : response.status === 404 ? 'O registro não foi encontrado.'
      : response.status === 409 ? 'Já existe um cadastro igual nesta locadora.'
      : 'Não foi possível concluir a operação. Tente novamente.'
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  me: (credentials: string) => request<Staff>(credentials, '/me'),
  chairs: (credentials: string) => request<Chair[]>(credentials, '/chairs'),
  createChair: (credentials: string, data: { code: string; model: string; notes: string; branchId: string }) =>
    request<Chair>(credentials, '/chairs', { method: 'POST', body: JSON.stringify(data) }),
  updateChair: (credentials: string, id: string, data: { model: string; status: ChairStatus; notes: string; branchId: string }) =>
    request<Chair>(credentials, `/chairs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  branches: (credentials: string) => request<Branch[]>(credentials, '/branches'),
  createBranch: (credentials: string, data: BranchInput) =>
    request<Branch>(credentials, '/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (credentials: string, id: string, data: BranchInput) =>
    request<Branch>(credentials, `/branches/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

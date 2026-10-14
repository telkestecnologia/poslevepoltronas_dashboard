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
export type ChairPage = { items: Chair[]; total: number; page: number; size: number }
export type ChairOption = Pick<Chair, 'id' | 'code' | 'model' | 'branchId' | 'status'>
export type ChairQuery = {
  page: number
  size: number
  search: string
  status: ChairStatus | 'ALL'
  branchId: string
}

export type Staff = { slug: string; tenantName: string; displayName: string; email: string }
export type Courier = {
  id: string; name: string; email: string; phone: string; vehicle: string
  active: boolean; createdAt: string; updatedAt: string
}
export type CourierInput = {
  name: string; email: string; phone: string; vehicle: string; password: string; active: boolean
}

export type Municipality = { code: string; name: string; uf: string }
export type BranchMunicipality = Municipality & { freightCents: number }
export type Branch = {
  id: string
  name: string
  municipalities: BranchMunicipality[]
  active: boolean
}
export type BranchInput = {
  name: string
  municipalities: { code: string; freightCents: number }[]
  active: boolean
}
export type ManualBlock = {
  id: string
  chairId: string
  start: string
  end: string
  reason: string
  createdAt: string
}

export type OrderStatus =
  | 'PAYMENT_CONFIRMED'
  | 'DELIVERY_PENDING'
  | 'IN_USE'
  | 'PICKUP_PENDING'
  | 'COMPLETED'
export type OrderSource = 'CHECKOUT' | 'MANUAL_PREVIEW'
export type OrderIssue = {
  id: string; title: string; description: string; status: 'OPEN' | 'RESOLVED'
  resolution: string; openedBy: string; openedAt: string; resolvedBy: string | null; resolvedAt: string | null
}
export type OrderEvent = { action: string; note: string; actor: string; at: string }
export type Order = {
  id: string; customerName: string; customerPhone: string; postalCode: string; address: string
  municipalityCode: string; municipalityName: string; municipalityUf: string
  branchId: string; branchName: string; chairId: string; chairCode: string
  start: string; end: string; freightCents: number; source: OrderSource; status: OrderStatus; courierId: string | null
  issues: OrderIssue[]; history: OrderEvent[]; createdAt: string; updatedAt: string
}
export type PreviewOrderInput = {
  customerName: string; customerPhone: string; postalCode: string; address: string
  municipalityCode: string; chairId: string; start: string; end: string
}

export const localLoginBypass = __DASHBOARD_DEV_LOGIN_BYPASS__
const baseUrl = localLoginBypass
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
export const tenantSlug = import.meta.env.VITE_TENANT_SLUG || 'pos-leve'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
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
    const message =
      response.status === 401
        ? 'E-mail ou senha inválidos.'
        : response.status === 403
          ? 'Sua conta não tem acesso a esta locadora.'
          : response.status === 404
            ? 'O registro não foi encontrado.'
            : response.status >= 500
              ? 'A API encontrou um erro interno. Confira os logs do backend.'
              : response.status === 409
                ? path.startsWith('/blocks')
                  ? 'A poltrona já tem um bloqueio em parte do período.'
                  : path.startsWith('/orders')
                    ? 'A operação não é permitida no estado atual do pedido.'
                  : path.startsWith('/chairs/')
                    ? 'Não é possível mover uma poltrona com pedido em andamento.'
                  : path.startsWith('/couriers')
                    ? 'Este e-mail já está cadastrado para um entregador.'
                  : 'Já existe um cadastro igual nesta locadora.'
                : 'Não foi possível concluir a operação. Tente novamente.'
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  me: (credentials: string) => request<Staff>(credentials, '/me'),
  orders: (credentials: string) => request<Order[]>(credentials, '/orders'),
  createOrderPreview: (credentials: string, data: PreviewOrderInput) =>
    request<Order>(credentials, '/orders/previews', { method: 'POST', body: JSON.stringify(data) }),
  deleteOrderPreview: (credentials: string, id: string) =>
    request<void>(credentials, `/orders/previews/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  changeOrderStatus: (credentials: string, id: string, status: OrderStatus, note: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status, note }),
    }),
  assignOrderCourier: (credentials: string, id: string, courierId: string | null) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/courier`, {
      method: 'PATCH', body: JSON.stringify({ courierId }),
    }),
  openOrderIssue: (credentials: string, id: string, title: string, description: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/issues`, {
      method: 'POST', body: JSON.stringify({ title, description }),
    }),
  resolveOrderIssue: (credentials: string, id: string, issueId: string, resolution: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/issues/${encodeURIComponent(issueId)}/resolve`, {
      method: 'PATCH', body: JSON.stringify({ resolution }),
    }),
  couriers: (credentials: string) => request<Courier[]>(credentials, '/couriers'),
  createCourier: (credentials: string, data: CourierInput) =>
    request<Courier>(credentials, '/couriers', { method: 'POST', body: JSON.stringify(data) }),
  updateCourier: (credentials: string, id: string, data: CourierInput) =>
    request<Courier>(credentials, `/couriers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  chairs: (credentials: string, query: ChairQuery) => {
    const params = new URLSearchParams({
      page: String(query.page),
      size: String(query.size),
      search: query.search,
    })
    if (query.status !== 'ALL') params.set('status', query.status)
    if (query.branchId !== 'ALL') params.set('branchId', query.branchId)
    return request<ChairPage>(credentials, `/chairs?${params}`)
  },
  chairOptions: (credentials: string) => request<ChairOption[]>(credentials, '/chairs/options'),
  activeChairCounts: (credentials: string) =>
    request<Record<string, number>>(credentials, '/chairs/active-counts'),
  createChair: (
    credentials: string,
    data: { code: string; model: string; notes: string; branchId: string },
  ) => request<Chair>(credentials, '/chairs', { method: 'POST', body: JSON.stringify(data) }),
  updateChair: (
    credentials: string,
    id: string,
    data: { model: string; status: ChairStatus; notes: string; branchId: string },
  ) =>
    request<Chair>(credentials, `/chairs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  branches: (credentials: string) => request<Branch[]>(credentials, '/branches'),
  municipalities: (credentials: string) => request<Municipality[]>(credentials, '/municipalities'),
  blocks: (credentials: string) => request<ManualBlock[]>(credentials, '/blocks'),
  createBlock: (
    credentials: string,
    data: { chairId: string; start: string; end: string; reason: string },
  ) => request<ManualBlock>(credentials, '/blocks', { method: 'POST', body: JSON.stringify(data) }),
  deleteBlock: (credentials: string, id: string) =>
    request<void>(credentials, `/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createBranch: (credentials: string, data: BranchInput) =>
    request<Branch>(credentials, '/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (credentials: string, id: string, data: BranchInput) =>
    request<Branch>(credentials, `/branches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

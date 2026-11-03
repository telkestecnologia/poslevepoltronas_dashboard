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
  freeShipping: boolean
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
  | 'PENDING_CONTRACT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_REVIEW'
  | 'EXPIRED'
  | 'CANCELLED'
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
  start: string; end: string; stockStart: string | null; stockEnd: string | null
  deliveryTime: string | null; pickupTime: string | null; priceVersion: string | null
  rentalCents: number; freightCents: number; totalCents: number
  holdId: string | null; expiresAt: string | null
  paymentMock?: boolean | null
  paymentSandbox?: boolean | null
  source: OrderSource; status: OrderStatus; courierId: string | null
  issues: OrderIssue[]; history: OrderEvent[]; createdAt: string; updatedAt: string
}
export type OrderEvidence = {
  id: string; phase: 'DELIVERY' | 'PICKUP'; kind: 'PHOTO' | 'VIDEO'
  courierId: string; installationId: string; deviceManufacturer: string | null
  deviceModel: string | null; platform: string; osVersion: string | null
  sizeBytes: number; capturedAt: string; uploadedAt: string; readUrl: string
  contentType?: string; uploadedByName?: string | null; uploadedByStaff?: boolean
}
export type EvidenceUploadStart = {
  evidenceId: string; status: 'PENDING' | 'UPLOADED'; uploadUrl: string | null
  headers: Record<string, string>; expiresInSeconds: number
}
export type EvidenceUploadInput = {
  phase: 'DELIVERY' | 'PICKUP'; kind: 'PHOTO' | 'VIDEO'; clientMediaId: string; installationId: string
  platform: 'android' | 'ios'; contentType: string; sizeBytes: number; capturedAt: string
}

export type AccessLevel = 'ALL' | 'NONE'
export type TeamMember = {
  id: string; name: string; email: string; phone: string | null; area: string | null; jobTitle: string | null
  access: AccessLevel; enabled: boolean; self: boolean
}
export type TeamMemberInput = {
  name: string; email: string; phone: string; area: string; jobTitle: string; access: AccessLevel; password: string; enabled?: boolean
}
export type Account = {
  id: string; name: string; email: string; phone: string | null; area: string | null; jobTitle: string | null; access: AccessLevel
}

export type ConversationState = 'AI' | 'HUMAN' | 'PAUSED' | 'CLOSED'
export type ConversationRole = 'CUSTOMER' | 'AI' | 'STAFF'
export type Conversation = {
  id: string; channel: 'SITE' | 'WHATSAPP'; state: ConversationState; startedAt: string; lastMessageAt: string
  lastMessagePreview: string; lastMessageRole: ConversationRole; messageCount: number
  needsAttention: boolean; staffName: string | null; lastCustomerMessage?: string | null
  customerPhone?: string | null; windowOpen?: boolean | null
}
export type ConversationPage = {
  items: Conversation[]; total: number; page: number; size: number; whatsApp?: 'OK' | 'NOT_CONFIGURED' | 'ERROR' | null
}
export type ConversationMessage = {
  id: string; role: ConversationRole; content: string; status: string | null; staffName: string | null; createdAt: string
}
export type AiKnowledge = {
  id: string
  question: string
  answer: string
  status: 'PENDING' | 'PROCESSING' | 'INDEXED' | 'FAILED'
  createdAt: string
  updatedAt: string
}
export type AiKnowledgeInput = { question: string; answer: string }
export type AiUnansweredQuestion = {
  id: string
  question: string
  occurrences: number
  firstAskedAt: string
  lastAskedAt: string
}
export type AiNotificationSettings = { emails: string[]; whatsAppNumbers: string[] }

export type RentalOverview = {
  rentalDate: string
  rentedChairsByBranch: {
    branchId: string
    branchName: string
    totalChairs: number
    rentedChairs: number
  }[]
}
export type RevenuePeriod = 'WEEK' | 'MONTH'
export type RevenueOverview = {
  period: RevenuePeriod
  hasData: boolean
  buckets: { start: string; totalPaidCents: number }[]
}
export type FinancialEntry = {
  id: string
  branchId: string
  branchName: string
  kind: 'INFLOW' | 'OUTFLOW'
  category: string
  amountCents: number
  paymentMethod: string
  description: string
  reference: string
  occurredAt: string
  demo: boolean
}
export type FinancialReport = {
  mode: 'REAL' | 'DEMO' | 'EMPTY'
  from: string
  to: string
  balanceCents: number
  inflowCents: number
  outflowCents: number
  netCents: number
  total: number
  page: number
  size: number
  monthly: { start: string; inflowCents: number; outflowCents: number }[]
  branches: { branchId: string; branchName: string; inflowCents: number; outflowCents: number }[]
  entries: FinancialEntry[]
}
export type FinanceQuery = { from: string; to: string; branchId: string; page: number; size: number }

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
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
            : response.status === 503 && (path.startsWith('/ai/knowledge') || path.endsWith('/answer'))
              ? 'Configure uma API Key com permissão de conhecimento no backend.'
            : response.status >= 500
              ? 'A API encontrou um erro interno. Confira os logs do backend.'
              : response.status === 400 && path.startsWith('/account')
                ? 'Senha atual incorreta, ou a nova senha não tem de 12 a 72 caracteres.'
              : response.status === 409
                ? path.startsWith('/team/areas')
                  ? 'Essa cidade já está na lista.'
                  : path.startsWith('/team')
                    ? 'Já existe um usuário com este e-mail ou celular, ou a alteração deixaria a locadora sem administrador.'
                  : path.startsWith('/account')
                    ? 'Já existe um usuário com este e-mail.'
                  : path.startsWith('/conversations')
                    ? 'Passaram 24 horas desde a última mensagem do cliente. O WhatsApp só libera nova mensagem quando ele escrever de novo.'
                  : path.startsWith('/blocks')
                  ? 'A poltrona já tem um bloqueio em parte do período.'
                  : path.startsWith('/orders')
                    ? 'A operação não é permitida no estado atual do pedido.'
                  : path.startsWith('/chairs/')
                    ? 'Não é possível mover uma poltrona com pedido em andamento.'
                  : path.startsWith('/couriers')
                    ? 'Este e-mail já está cadastrado para um entregador.'
                  : path.startsWith('/ai/knowledge')
                    ? 'Esta pergunta já existe no contexto da IA.'
                  : 'Já existe um cadastro igual nesta locadora.'
                : 'Não foi possível concluir a operação. Tente novamente.'
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Rotas públicas (sem login) do "Esqueci minha senha": código pelo WhatsApp cadastrado no perfil. */
async function publicPost(path: string, body: unknown) {
  try {
    return await fetch(`${baseUrl}/api/public/${encodeURIComponent(tenantSlug)}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Confira sua internet.')
  }
}

/** Envio de foto ou vídeo pelo painel: o arquivo vai ao backend, que grava no armazenamento. */
export async function uploadEvidenceFile(credentials: string, orderId: string, phase: 'DELIVERY' | 'PICKUP', file: Blob, fileName: string) {
  const body = new FormData()
  body.append('phase', phase)
  body.append('capturedAt', new Date().toISOString())
  body.append('file', file, fileName)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/admin/${encodeURIComponent(tenantSlug)}/orders/${encodeURIComponent(orderId)}/evidence/files`, {
      method: 'POST', headers: { Authorization: `Basic ${credentials}` }, body,
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Confira sua internet.')
  }
  if (response.status === 413) throw new ApiError(413, 'Arquivo grande demais: fotos até 5 MB e vídeos até 30 MB.')
  if (response.status === 415) throw new ApiError(415, 'Formato não aceito. Envie foto JPG ou vídeo MP4/MOV.')
  if (response.status === 409) throw new ApiError(409, 'Esta etapa do pedido não aceita registros agora.')
  if (response.status === 503) throw new ApiError(503, 'O armazenamento de mídias não está configurado no servidor.')
  if (!response.ok) throw new ApiError(response.status, 'Não foi possível enviar o arquivo agora. Tente novamente.')
  return response.json() as Promise<OrderEvidence>
}

export async function requestPasswordReset(phone: string) {
  const response = await publicPost('/staff/password-reset', { phone })
  if (response.status === 400) throw new ApiError(400, 'Informe o celular com DDD, o mesmo cadastrado no seu perfil.')
  if (response.status === 503) throw new ApiError(503, 'O envio pelo WhatsApp está indisponível no momento. Fale com o administrador.')
  if (!response.ok) throw new ApiError(response.status, 'Não foi possível enviar o código agora. Tente novamente.')
}

export async function confirmPasswordReset(phone: string, code: string, newPassword: string): Promise<string> {
  const response = await publicPost('/staff/password-reset/confirm', { phone, code, newPassword })
  if (response.status === 400) throw new ApiError(400, 'Código inválido ou vencido. Confira os números ou peça outro código.')
  if (!response.ok) throw new ApiError(response.status, 'Não foi possível trocar a senha agora. Tente novamente.')
  return ((await response.json()) as { email: string }).email
}

export const api = {
  me: (credentials: string) => request<Staff>(credentials, '/me'),
  overviewRentals: (credentials: string, date: string) =>
    request<RentalOverview>(credentials, `/overview/rentals?date=${encodeURIComponent(date)}`),
  overviewRevenue: (credentials: string, period: RevenuePeriod) =>
    request<RevenueOverview>(credentials, `/overview/revenue?period=${period}`),
  finance: (credentials: string, query: FinanceQuery) =>
    request<FinancialReport>(credentials, `/finance?${new URLSearchParams({
      from: query.from, to: query.to, branchId: query.branchId, page: String(query.page), size: String(query.size),
    })}`),
  aiKnowledge: (credentials: string) => request<AiKnowledge[]>(credentials, '/ai/knowledge'),
  aiUnanswered: (credentials: string) => request<AiUnansweredQuestion[]>(credentials, '/ai/unanswered'),
  aiNotificationSettings: (credentials: string) =>
    request<AiNotificationSettings>(credentials, '/ai/notifications'),
  saveAiNotificationSettings: (credentials: string, data: AiNotificationSettings) =>
    request<AiNotificationSettings>(credentials, '/ai/notifications', {
      method: 'PUT', body: JSON.stringify(data),
    }),
  recordAiUnanswered: (credentials: string, question: string) =>
    request<AiUnansweredQuestion>(credentials, '/ai/unanswered', {
      method: 'POST', body: JSON.stringify({ question }),
    }),
  createAiKnowledge: (credentials: string, data: AiKnowledgeInput) =>
    request<AiKnowledge>(credentials, '/ai/knowledge', {
      method: 'POST', body: JSON.stringify(data),
    }),
  updateAiKnowledge: (credentials: string, id: string, data: AiKnowledgeInput) =>
    request<AiKnowledge>(credentials, `/ai/knowledge/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  deleteAiKnowledge: (credentials: string, id: string) =>
    request<void>(credentials, `/ai/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  answerAiUnanswered: (credentials: string, id: string, answer: string) =>
    request<AiKnowledge>(credentials, `/ai/unanswered/${encodeURIComponent(id)}/answer`, {
      method: 'POST', body: JSON.stringify({ answer }),
    }),
  deleteAiUnanswered: (credentials: string, id: string) =>
    request<void>(credentials, `/ai/unanswered/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  orders: (credentials: string) => request<Order[]>(credentials, '/orders'),
  simulateOrderPix: (credentials: string, id: string) =>
    request<void>(credentials, `/orders/${encodeURIComponent(id)}/pix/sandbox/pay`, { method: 'POST' }),
  checkOrderPix: (credentials: string, id: string) =>
    request<void>(credentials, `/orders/${encodeURIComponent(id)}/pix/sandbox/check`, { method: 'POST' }),
  orderEvidence: (credentials: string, id: string) =>
    request<OrderEvidence[]>(credentials, `/orders/${encodeURIComponent(id)}/evidence`),
  startEvidenceUpload: (credentials: string, id: string, data: EvidenceUploadInput) =>
    request<EvidenceUploadStart>(credentials, `/orders/${encodeURIComponent(id)}/evidence/uploads`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  completeEvidenceUpload: (credentials: string, id: string, evidenceId: string) =>
    request<OrderEvidence>(credentials, `/orders/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}/complete`,
      { method: 'POST' }),
  deleteEvidence: (credentials: string, id: string, evidenceId: string) =>
    request<void>(credentials, `/orders/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`, { method: 'DELETE' }),
  team: (credentials: string) => request<TeamMember[]>(credentials, '/team'),
  createTeamMember: (credentials: string, data: TeamMemberInput) =>
    request<TeamMember>(credentials, '/team', { method: 'POST', body: JSON.stringify(data) }),
  updateTeamMember: (credentials: string, id: string, data: TeamMemberInput) =>
    request<TeamMember>(credentials, `/team/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeTeamMember: (credentials: string, id: string) =>
    request<void>(credentials, `/team/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  teamAreas: (credentials: string) => request<string[]>(credentials, '/team/areas'),
  addTeamArea: (credentials: string, name: string) =>
    request<string[]>(credentials, '/team/areas', { method: 'POST', body: JSON.stringify({ name }) }),
  account: (credentials: string) => request<Account>(credentials, '/account'),
  changePassword: (credentials: string, currentPassword: string, newPassword: string) =>
    request<void>(credentials, '/account/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  changeEmail: (credentials: string, currentPassword: string, newEmail: string) =>
    request<Account>(credentials, '/account/email', { method: 'PUT', body: JSON.stringify({ currentPassword, newEmail }) }),
  conversations: (credentials: string) => request<ConversationPage>(credentials, '/conversations?page=0&size=50'),
  conversation: (credentials: string, id: string) => request<Conversation>(credentials, `/conversations/${encodeURIComponent(id)}`),
  conversationMessages: (credentials: string, id: string) =>
    request<ConversationMessage[]>(credentials, `/conversations/${encodeURIComponent(id)}/messages`),
  replyConversation: (credentials: string, id: string, content: string) =>
    request<ConversationMessage>(credentials, `/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),
  setConversationState: (credentials: string, id: string, state: ConversationState) =>
    request<Conversation>(credentials, `/conversations/${encodeURIComponent(id)}/state`, {
      method: 'POST', body: JSON.stringify({ state }),
    }),
  changeOrderStatus: (credentials: string, id: string, status: OrderStatus, note: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status, note }),
    }),
  expandOrderStock: (credentials: string, id: string, stockStart: string, stockEnd: string, note: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/logistics`, {
      method: 'PATCH', body: JSON.stringify({ stockStart, stockEnd, note }),
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
  setBranchFreeShipping: (credentials: string, id: string, enabled: boolean) =>
    request<Branch>(credentials, `/branches/${encodeURIComponent(id)}/free-shipping`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
}

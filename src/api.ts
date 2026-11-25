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
/** Filtro da tela de poltronas: estado do cadastro ou AVAILABLE (livre hoje) / IN_USE (alugada hoje). */
export type ChairFilter = ChairStatus | 'ALL' | 'AVAILABLE' | 'IN_USE'
export type ChairSituation = { available: number; inUse: number; maintenance: number }
export type ChairQuery = {
  page: number
  size: number
  search: string
  status: ChairFilter
  branchId: string
}

/** role MEMBER = parceiro ("Começa do zero"): vê só os dados das filiais branchIds. */
export type Staff = { slug: string; tenantName: string; displayName: string; email: string; role?: 'ADMIN' | 'MEMBER'; branchIds?: string[] }
export type Courier = {
  id: string; name: string; email: string; phone: string; vehicle: string
  active: boolean; createdAt: string; updatedAt: string
}
export type CourierInput = {
  name: string; email: string; phone: string; vehicle: string; password: string; active: boolean
}

export type Municipality = { code: string; name: string; uf: string }
/** Bairro com frete próprio (ex.: em Fortaleza cada bairro tem um valor); os demais usam o frete da cidade. */
export type DistrictFreight = { name: string; freightCents: number }
export type BranchMunicipality = Municipality & { freightCents: number; districts?: DistrictFreight[] }
export type Branch = {
  id: string
  name: string
  municipalities: BranchMunicipality[]
  active: boolean
  freeShipping: boolean
}
export type BranchInput = {
  name: string
  municipalities: { code: string; freightCents: number; districts?: DistrictFreight[] }[]
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
  /** Pago, mas a cliente precisa de outra data (ex.: cirurgia remarcada): poltrona bloqueada num período provável. */
  | 'AWAITING_NEW_DATE'
export type OrderSource = 'CHECKOUT' | 'MANUAL_PREVIEW' | 'MANUAL'
/** Pedidos de verdade: do site ou da Isa (CHECKOUT) e cadastrados à mão pela equipe (MANUAL). */
export const REAL_SOURCES: OrderSource[] = ['CHECKOUT', 'MANUAL']
export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO'
export type ManualReason = 'ANTES_DO_SISTEMA' | 'DESCONTO' | 'SINAL' | 'FORA_DO_WHATSAPP' | 'OUTRO'
/** Pagamento lançado pela equipe num pedido cadastrado à mão. paidOn = dia em que o cliente pagou (AAAA-MM-DD). */
export type ManualPayment = { id: string; amountCents: number; method: PaymentMethod; paidOn: string; note: string | null; actor: string; at: string }
/** O que a cliente já passou para a Isa na conversa, para o pedido manual (tudo opcional). */
export type ManualOrderPrefill = {
  customerName: string | null; customerPhone: string | null; cep: string | null; street: string | null; number: string | null
  complement: string | null; district: string | null; municipalityCode: string | null; branchId: string | null
  start: string | null; end: string | null; deliveryTime: string | null; pickupTime: string | null
  rentalCents: number | null; freightCents: number | null
}
export type ManualPaymentInput = { amountCents: number; method: PaymentMethod; paidOn?: string; note?: string }
/** Cadastro manual: clientes de antes do sistema e exceções. status inicial: DELIVERY_PENDING ou IN_USE. */
export type ManualOrderInput = {
  customerName: string; customerPhone: string; cep?: string; street: string; number?: string; complement?: string
  district: string; municipalityCode: string; branchId: string; chairId: string; start: string; end: string
  deliveryTime?: string; pickupTime?: string; rentalCents: number; freightCents: number
  status: 'DELIVERY_PENDING' | 'IN_USE'; internalNote?: string; initialPayment?: ManualPaymentInput
  reason: ManualReason
  /** Contrato e pagamento por link: o pedido nasce "Aguardando contrato" (só para a poltrona que ainda vai ser entregue). */
  awaitContract?: boolean
}

/** Contrato por link do pedido manual (mesmo texto do site). status: NONE, READY (enviado), DECLINED ou ACCEPTED. */
export type ContractLinkState = {
  status: 'NONE' | 'READY' | 'DECLINED' | 'ACCEPTED'; url: string | null; phone: string
  title: string | null; sections: { title: string | null; paragraphs: string[] }[] | null; documentDate: string | null
  preparedAt: string | null; acceptedAt: string | null; declinedAt: string | null
}
/** Pagamento por link: NONE (sem link), READY (enviado), WAITING (cliente gerou Pix/cartão), PAID ou REVIEW. */
export type PaymentLinkState = {
  status: 'NONE' | 'READY' | 'WAITING' | 'PAID' | 'REVIEW'; url: string | null; phone: string; amountCents: number
  method: string | null; paidAt: string | null; receiptImageUrl: string | null; receiptPdfUrl: string | null
}
export type OrderIssue = {
  id: string; title: string; description: string; status: 'OPEN' | 'RESOLVED'
  resolution: string; openedBy: string; openedAt: string; resolvedBy: string | null; resolvedAt: string | null
}
export type OrderEvent = { action: string; note: string; actor: string; at: string }
export type Order = {
  id: string; customerName: string; customerPhone: string; postalCode: string | null; address: string
  latitude?: number | null; longitude?: number | null
  municipalityCode: string; municipalityName: string; municipalityUf: string
  branchId: string; branchName: string; chairId: string; chairCode: string
  start: string; end: string; stockStart: string | null; stockEnd: string | null
  deliveryTime: string | null; pickupTime: string | null; priceVersion: string | null
  /** Dia combinado da entrega e da retirada, antecipadas ou posteriores (null = primeiro e último dia do aluguel). */
  deliveryDate?: string | null; pickupDate?: string | null
  rentalCents: number; freightCents: number; totalCents: number
  holdId: string | null; expiresAt: string | null
  paymentMock?: boolean | null
  paymentSandbox?: boolean | null
  source: OrderSource; status: OrderStatus; courierId: string | null
  issues: OrderIssue[]; history: OrderEvent[]; createdAt: string; updatedAt: string
  totalPaidCents?: number | null; paidAt?: string | null
  /** Observação só da equipe (o cliente e a Isa não veem). */
  internalNote?: string | null
  manualPayments?: ManualPayment[] | null
  /** Por que foi cadastrado à mão. */
  manualReason?: ManualReason | null
  /** Remarcação: poltrona bloqueada no período provável enquanto a cliente não tem a nova data. */
  rescheduleHold?: RescheduleHold | null
}
/** previousStart/previousEnd: período pago antes da remarcação. */
export type RescheduleHold = {
  chairId: string; chairCode: string; start: string; end: string; previousStart: string; previousEnd: string
  note: string | null; actor: string; at: string
}
/** Poltrona livre para a remarcação; current = a poltrona do pedido. */
export type RescheduleChair = { id: string; code: string; model: string | null; notes: string | null; current: boolean }
export type RescheduleAvailability = { start: string; end: string; days: number; paidChair: RescheduleChair | null; chairs: RescheduleChair[] }
/** Filtros da lista de pedidos feitos no servidor. courierId 'NONE' = sem entregador; from/to = aluguel que encosta no período. */
export type OrderQuery = {
  statuses?: OrderStatus[]; source?: OrderSource | OrderSource[]; branchId?: string; municipalityCode?: string; courierId?: string
  from?: string; to?: string; openIssues?: boolean; search?: string
  /** delivery: pelo dia da entrega, a mais perto de hoje em cima e as já passadas no fim. */
  sort?: 'delivery'
}
/** counts e openIssues ignoram os filtros de status e de problemas (servem para os cartões de resumo). */
export type OrderPage = {
  items: Order[]; total: number; page: number; size: number
  counts: Partial<Record<OrderStatus, number>>; openIssues: number
}
export type OrderEvidence = {
  id: string; phase: 'DELIVERY' | 'PICKUP'; kind: 'PHOTO' | 'VIDEO'
  courierId: string; installationId: string; deviceManufacturer: string | null
  deviceModel: string | null; platform: string; osVersion: string | null
  sizeBytes: number; capturedAt: string; uploadedAt: string; readUrl: string
  contentType?: string; uploadedByName?: string | null; uploadedByStaff?: boolean
}

export type AccessLevel = 'ALL' | 'NONE'
export type TeamMember = {
  id: string; name: string; email: string; phone: string | null; jobTitle: string | null
  access: AccessLevel; enabled: boolean; self: boolean; branchIds?: string[]
}
export type TeamMemberInput = {
  name: string; email: string; phone: string; jobTitle: string; access: AccessLevel; password: string; enabled?: boolean
  /** Filiais do parceiro (access NONE); vazio para quem vê todos os dados. */
  branchIds: string[]
}
export type Account = {
  id: string; name: string; email: string; phone: string | null; jobTitle: string | null; access: AccessLevel
}

export type ConversationState = 'AI' | 'HUMAN' | 'PAUSED' | 'CLOSED'
export type ConversationRole = 'CUSTOMER' | 'AI' | 'STAFF'
export type Conversation = {
  id: string; channel: 'SITE' | 'WHATSAPP'; state: ConversationState; startedAt: string; lastMessageAt: string
  lastMessagePreview: string; lastMessageRole: ConversationRole; messageCount: number
  needsAttention: boolean; staffName: string | null; lastCustomerMessage?: string | null
  customerPhone?: string | null; windowOpen?: boolean | null
  customerName?: string | null; stage?: string | null
}
export type ConversationPage = {
  items: Conversation[]; total: number; page: number; size: number; whatsApp?: 'OK' | 'NOT_CONFIGURED' | 'ERROR' | null
}
/** Limite mensal do relatório do atendimento (GET /conversations/report/quota). */
export type ReportQuota = { used: number; limit: number; remaining: number; month: string }
/** Relatório geral do atendimento no período, com a análise da Isa (POST /conversations/report). */
export type ConversationReport = {
  from: string; to: string; generatedAt: string; stages: Record<string, number>; unanswered: string[]
  totals: { conversations: number; whatsApp: number; site: number; customerMessages: number; isaMessages: number; staffMessages: number
    needsAttention: number; handledByTeam: number }
  analysis: { summary: string; score: number | null; scoreReason: string; strengths: string[]; problems: string[]
    frequentQuestions: string[]; opportunities: string[]; suggestions: string[] }
}
/** Análise da IA sobre o atendimento (POST /conversations/{id}/analysis). */
export type ConversationAnalysis = { summary: string; customer: string; service: string; attention: string; suggestion: string; generatedAt: string }
export type ConversationMessage = {
  id: string; role: ConversationRole; content: string; status: string | null; staffName: string | null; createdAt: string
  images?: { url: string; caption?: string | null }[] | null
  /** Arquivos que a equipe enviou: IMAGE, VIDEO, AUDIO ou DOCUMENT (PDF). Link temporário. */
  attachments?: { url: string; kind: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'; contentType: string; filename: string }[] | null
}

/** Contrato assinado anexado a um pedido manual; url é um link temporário para abrir. */
export type ContractFile = { fileName: string; contentType: string; sizeBytes: number; uploadedBy: string; uploadedAt: string; url: string | null }

/** Detalhes da venda (a ficha da equipe). Tudo opcional. */
export type SaleDetails = {
  paymentMethod: 'PIX' | 'CARTAO' | null; pixMode: 'A_VISTA' | 'ENTRADA_E_ENTREGA' | null
  cardMode: 'A_VISTA' | 'PARCELADO' | null; cardInstallments: number | null
  discount: boolean | null; discountCents: number | null; discountNote: string | null; plan: string | null
  referral: boolean | null; referralName: string | null; invoice: boolean | null
  updatedBy?: string | null; updatedAt?: string | null
}

/** Ficha do cliente no pedido: CPF, e-mail, quem recebe e o local. Tudo opcional. */
export type CustomerDetails = {
  cpf: string | null; email: string | null; recipientName: string | null; recipientPhone: string | null
  placeType: 'CASA' | 'CONDOMINIO' | 'APARTAMENTO' | null; parking: string | null; floor: string | null
  updatedBy?: string | null; updatedAt?: string | null
}

/** Envia o contrato assinado (PDF, JPG ou PNG, até 10 MB) de um pedido manual. */
export async function uploadOrderContractFile(credentials: string, orderId: string, file: File) {
  const form = new FormData()
  form.append('file', file, file.name)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/admin/${encodeURIComponent(tenantSlug)}/orders/${encodeURIComponent(orderId)}/contract-file`, {
      method: 'POST', body: form, headers: { Authorization: `Basic ${credentials}` },
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Confira sua internet.')
  }
  if (!response.ok) throw new ApiError(response.status, (await serverMessage(response)) ?? 'Não foi possível enviar o contrato.')
  return response.json() as Promise<ContractFile>
}

/** Envia foto (JPEG) ou vídeo (MP4/MOV) da entrega ou da retirada pelo painel. */
export async function uploadOrderEvidenceFile(credentials: string, orderId: string, phase: 'DELIVERY' | 'PICKUP', file: Blob, name: string) {
  const form = new FormData()
  form.append('file', file, name)
  form.append('phase', phase)
  form.append('capturedAt', new Date().toISOString())
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/admin/${encodeURIComponent(tenantSlug)}/orders/${encodeURIComponent(orderId)}/evidence/files`, {
      method: 'POST', body: form, headers: { Authorization: `Basic ${credentials}` },
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Confira sua internet.')
  }
  if (!response.ok) {
    const message = response.status === 413 ? 'O arquivo é grande demais para enviar.'
      : response.status === 415 ? 'Envie foto (JPG, PNG ou HEIC vira JPG) ou vídeo MP4/MOV.'
        : response.status === 409 ? 'Esta etapa do pedido não aceita fotos e vídeos agora.'
          : `Erro ${response.status} ao enviar o arquivo.`
    throw new ApiError(response.status, message)
  }
  return response.json() as Promise<OrderEvidence>
}

/** Envia imagem, vídeo, áudio ou PDF (até 16 MB) na conversa, com a mensagem digitada como legenda (igual ao app). */
export async function sendConversationAttachment(credentials: string, id: string, file: File, caption: string) {
  const form = new FormData()
  form.append('file', file, file.name)
  if (caption.trim()) form.append('caption', caption.trim())
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/admin/${encodeURIComponent(tenantSlug)}/conversations/${encodeURIComponent(id)}/attachments`, {
      method: 'POST', body: form, headers: { Authorization: `Basic ${credentials}` },
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Confira sua internet.')
  }
  if (!response.ok) {
    const message = response.status === 413 ? 'O arquivo precisa ter até 16 MB.'
      : response.status === 422 || response.status === 400 ? 'Envie foto (JPG ou PNG), vídeo (MP4), áudio (MP3, M4A, AAC ou OGG) ou PDF.'
        : response.status === 409 ? 'Assuma a conversa antes de enviar, ou o WhatsApp do cliente está fora da janela de 24 horas.'
          : response.status === 502 ? 'O WhatsApp não aceitou o arquivo. Tente de novo.'
            : `Erro ${response.status} ao enviar o arquivo.`
    throw new ApiError(response.status, message)
  }
  return response.json() as Promise<ConversationMessage>
}
export type AiKnowledge = {
  id: string
  question: string
  answer: string
  status: 'PENDING' | 'PROCESSING' | 'INDEXED' | 'FAILED'
  /** STAFF_LEARNING: a Isa aprendeu sozinha com a resposta da equipe no WhatsApp. */
  origin?: 'MANUAL' | 'UNANSWERED_QUESTION' | 'STAFF_LEARNING' | string
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
  /** Conversa onde a dúvida foi feita da última vez (site ou WhatsApp). */
  lastConversationId?: string | null
  channel?: string | null
}
export type AiNotificationSettings = { emails: string[]; whatsAppNumbers: string[] }

/** Formas de pagamento aceitas pela locadora; com uma só, o site e a Isa deixam de oferecer a outra. */
export type PaymentOptions = { pix: boolean; card: boolean; maxInstallments: number }
export type PricingPlan = { id: 'essencial' | 'plus' | 'premium'; name: string; days: number; priceCents: number; popular: boolean }
export type PricingCatalog = { version: string; dailyRateCents: number; minDays: number; maxDays: number; plans: PricingPlan[] }
/** Saída lançada pela equipe (despesa). date: AAAA-MM-DD. */
export type OutflowInput = { branchId?: string; branchIds?: string[]; amountCents: number; category: string; paymentMethod: string; description: string; date: string }
export type PricingInput = { dailyRateCents: number; minDays: number; maxDays: number; plans: PricingPlan[] }

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
/** De onde veio um contato: link do site (utm/anúncio/site de origem), anúncio de clique para o WhatsApp ou resposta à Isa. */
export type LeadOrigin = {
  source: string | null; medium?: string | null; campaign?: string | null; content?: string | null
  adHeadline?: string | null; referrer?: string | null; landingPage?: string | null
  via?: 'SITE_LINK' | 'WHATSAPP_AD' | 'ISA_QUESTION' | null; declared?: string | null; firstSeenAt?: string | null
}
export type LeadSourceRow = { source: string; contacts: number; orders: number; revenueCents: number }
export type LeadSourceSummary = { from: string; to: string; rows: LeadSourceRow[] }
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
  /** Quem pagou (o cliente do pedido), quando o lançamento é um recebimento de pedido. */
  payerName?: string | null
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
  /** Nome de quem pagou cada recebimento, pela referência (pedido). */
  payers?: Record<string, string>
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

/** Motivo do erro mandado pelo backend em `message` (só nos erros esperados), com ponto final; null se não veio. */
export async function serverMessage(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json() as { message?: unknown }
    const text = typeof body?.message === 'string' ? body.message.trim() : ''
    return text ? (/[.!?…]$/.test(text) ? text : `${text}.`) : null
  } catch {
    return null
  }
}

/** PDF da equipe (contrato aceito ou comprovante do banco); null quando o pedido não tem. */
export async function orderPdf(credentials: string, orderId: string, file: 'contract.pdf' | 'pix/receipt.pdf'): Promise<Blob | null> {
  const response = await fetch(`${baseUrl}/api/admin/${encodeURIComponent(tenantSlug)}/orders/${encodeURIComponent(orderId)}/${file}`, {
    headers: { Authorization: `Basic ${credentials}` }, cache: 'no-store',
  }).catch(() => null)
  return response?.ok ? response.blob() : null
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
          ? (path === '/me' ? 'Senha correta, mas seu usuário está como "Começa do zero" e ainda não vê os dados. Peça a um administrador para mudar para "Vê todos os dados" em Perfil e equipe.' : 'Sua conta não tem acesso a esta locadora.')
          : response.status === 404
            ? 'O registro não foi encontrado.'
            : response.status === 503 && (path.startsWith('/ai/knowledge') || path.endsWith('/answer'))
              ? 'Configure uma API Key com permissão de conhecimento no backend.'
            : response.status >= 500
              ? 'A API encontrou um erro interno. Confira os logs do backend.'
              : response.status === 400 && (path.startsWith('/pricing') || path.startsWith('/payment-options'))
                ? 'O servidor recusou os valores. Confira a diária, os planos e as formas de pagamento e tente de novo.'
              : response.status === 400 && path.startsWith('/account')
                ? 'Senha atual incorreta, ou a nova senha não tem de 6 a 72 caracteres.'
              : response.status === 409
                ? path.startsWith('/team')
                    ? 'Já existe um usuário com este e-mail ou celular, ou a alteração deixaria a locadora sem administrador.'
                  : path.startsWith('/account')
                    ? 'Já existe um usuário com este e-mail.'
                  : path.startsWith('/conversations')
                    ? 'Passaram 24 horas desde a última mensagem do cliente. O WhatsApp só libera nova mensagem quando ele escrever de novo.'
                  : path.startsWith('/blocks')
                  ? 'A poltrona já tem um bloqueio em parte do período.'
                  : path.startsWith('/orders') && path.endsWith('/schedule')
                    ? 'A poltrona já está reservada em parte desses dias (outro pedido ou bloqueio). Escolha outra data ou troque a poltrona do pedido.'
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
    // O motivo escrito pelo backend (ex.: "A poltrona já está bloqueada em parte do período") explica melhor que a
    // frase por código. Login (401) e acesso (403) mantêm os textos daqui, que dizem o que fazer.
    const fromServer = response.status === 401 || response.status === 403 ? null : await serverMessage(response)
    throw new ApiError(response.status, fromServer ?? message)
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

function orderParams(query: OrderQuery, page: number, size: number) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (query.statuses?.length) params.set('status', query.statuses.join(','))
  if (query.source) params.set('source', ([] as OrderSource[]).concat(query.source).join(','))
  if (query.branchId) params.set('branchId', query.branchId)
  if (query.municipalityCode) params.set('municipalityCode', query.municipalityCode)
  if (query.courierId) params.set('courierId', query.courierId)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.openIssues) params.set('openIssues', 'true')
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.sort) params.set('sort', query.sort)
  return params
}

export const api = {
  me:(credentials: string) => request<Staff>(credentials, '/me'),
  /** null quando ainda não se sabe de onde o contato veio. */
  leadOrigin: (credentials: string, query: { phone?: string | null; conversationId?: string | null }) =>
    request<LeadOrigin | undefined>(credentials, `/lead-origins/lookup?${new URLSearchParams(Object.entries(query)
      .filter((entry): entry is [string, string] => Boolean(entry[1])))}`).then(origin => origin ?? null),
  leadSources: (credentials: string, from: string, to: string) =>
    request<LeadSourceSummary>(credentials, `/lead-origins/summary?from=${from}&to=${to}`),
  overviewRentals: (credentials: string, date: string) =>
    request<RentalOverview>(credentials, `/overview/rentals?date=${encodeURIComponent(date)}`),
  overviewRevenue: (credentials: string, period: RevenuePeriod) =>
    request<RevenueOverview>(credentials, `/overview/revenue?period=${period}`),
  finance: (credentials: string, query: FinanceQuery) =>
    request<FinancialReport>(credentials, `/finance?${new URLSearchParams({
      from: query.from, to: query.to, branchId: query.branchId, page: String(query.page), size: String(query.size),
    })}`),
  registerOutflow: (credentials: string, data: OutflowInput) =>
    request<FinancialEntry[]>(credentials, '/finance/outflows', { method: 'POST', body: JSON.stringify(data) }),
  /** Entrada lançada pela equipe (aluguel manual, aporte financeiro...): mesmos campos da saída. */
  registerInflow: (credentials: string, data: OutflowInput) =>
    request<FinancialEntry[]>(credentials, '/finance/inflows', { method: 'POST', body: JSON.stringify(data) }),
  deleteInflow: (credentials: string, id: string) =>
    request<void>(credentials, `/finance/inflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteOutflow: (credentials: string, id: string) =>
    request<void>(credentials, `/finance/outflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  aiKnowledge: (credentials: string) => request<AiKnowledge[]>(credentials, '/ai/knowledge'),
  aiUnanswered: (credentials: string) => request<AiUnansweredQuestion[]>(credentials, '/ai/unanswered'),
  aiNotificationSettings: (credentials: string) =>
    request<AiNotificationSettings>(credentials, '/ai/notifications'),
  saveAiNotificationSettings: (credentials: string, data: AiNotificationSettings) =>
    request<AiNotificationSettings>(credentials, '/ai/notifications', {
      method: 'PUT', body: JSON.stringify(data),
    }),
  paymentOptions: (credentials: string) => request<PaymentOptions>(credentials, '/payment-options'),
  savePaymentOptions: (credentials: string, data: PaymentOptions) =>
    request<PaymentOptions>(credentials, '/payment-options', { method: 'PUT', body: JSON.stringify(data) }),
  pricing: (credentials: string) => request<PricingCatalog>(credentials, '/pricing'),
  savePricing: (credentials: string, data: PricingInput) =>
    request<PricingCatalog>(credentials, '/pricing', { method: 'PUT', body: JSON.stringify(data) }),
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
  orderPage: async (credentials: string, query: OrderQuery, page: number, size: number) => {
    const result = await request<OrderPage | Order[]>(credentials, `/orders?${orderParams(query, page, size)}`)
    // Um backend sem a lista paginada ignora ?page e responde com a lista inteira.
    if (Array.isArray(result)) throw new ApiError(0, 'A API ainda não tem a lista paginada de pedidos. Publique a versão nova do backend.')
    return result
  },
  order: (credentials: string, id: string) => request<Order>(credentials, `/orders/${encodeURIComponent(id)}`),
  simulateOrderPix: (credentials: string, id: string) =>
    request<void>(credentials, `/orders/${encodeURIComponent(id)}/pix/sandbox/pay`, { method: 'POST' }),
  checkOrderPix: (credentials: string, id: string) =>
    request<void>(credentials, `/orders/${encodeURIComponent(id)}/pix/sandbox/check`, { method: 'POST' }),
  orderEvidence: (credentials: string, id: string) =>
    request<OrderEvidence[]>(credentials, `/orders/${encodeURIComponent(id)}/evidence`),
  team: (credentials: string) => request<TeamMember[]>(credentials, '/team'),
  createTeamMember: (credentials: string, data: TeamMemberInput) =>
    request<TeamMember>(credentials, '/team', { method: 'POST', body: JSON.stringify(data) }),
  updateTeamMember: (credentials: string, id: string, data: TeamMemberInput) =>
    request<TeamMember>(credentials, `/team/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeTeamMember: (credentials: string, id: string) =>
    request<void>(credentials, `/team/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  account: (credentials: string) => request<Account>(credentials, '/account'),
  changePassword: (credentials: string, currentPassword: string, newPassword: string) =>
    request<void>(credentials, '/account/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  changeEmail: (credentials: string, currentPassword: string, newEmail: string) =>
    request<Account>(credentials, '/account/email', { method: 'PUT', body: JSON.stringify({ currentPassword, newEmail }) }),
  conversations: (credentials: string) => request<ConversationPage>(credentials, '/conversations?page=0&size=50'),
  conversation: (credentials: string, id: string) => request<Conversation>(credentials, `/conversations/${encodeURIComponent(id)}`),
  conversationMessages: (credentials: string, id: string) =>
    request<ConversationMessage[]>(credentials, `/conversations/${encodeURIComponent(id)}/messages`),
  conversationReportQuota: (credentials: string) => request<ReportQuota>(credentials, '/conversations/report/quota'),
  conversationReport: (credentials: string, from: string, to: string) =>
    request<ConversationReport>(credentials, '/conversations/report', { method: 'POST', body: JSON.stringify({ from, to }) }),
  conversationAnalysis: (credentials: string, id: string) =>
    request<ConversationAnalysis>(credentials, `/conversations/${encodeURIComponent(id)}/analysis`, { method: 'POST' }),
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
  /** Botão "Saindo para entrega": avisa o cliente pelo WhatsApp, com o vídeo de entrega (uma vez por pedido). */
  notifyDeliveryDeparture: (credentials: string, id: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/delivery-departure`, { method: 'POST' }),
  /** Botão "Saindo para retirada": avisa o cliente pelo WhatsApp que o motorista está indo buscar a poltrona. */
  notifyPickupDeparture: (credentials: string, id: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/pickup-departure`, { method: 'POST' }),
  /** Entrega/retirada antecipada ou posterior: dia (AAAA-MM-DD) e/ou horário (HH:mm); o que não vier fica como está. */
  changeOrderSchedule: (credentials: string, id: string, changes: { deliveryDate?: string | null; deliveryTime?: string | null
    pickupDate?: string | null; pickupTime?: string | null }, note: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/schedule`, {
      method: 'PATCH', body: JSON.stringify({ ...changes, note }),
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
  /** Poltronas da filial livres em todo o período (cadastro manual). */
  manualOrderChairs: (credentials: string, branchId: string, start: string, end: string) =>
    request<Chair[]>(credentials, `/orders/manual/chairs?${new URLSearchParams({ branchId, start, end })}`),
  manualOrderPrefill: (credentials: string, conversationId: string) =>
    request<ManualOrderPrefill>(credentials, `/orders/manual/prefill?${new URLSearchParams({ conversationId })}`),
  /** Remarcação: poltronas da filial livres no período (sem end: o mesmo número de dias já pago). */
  rescheduleChairs: (credentials: string, id: string, start: string, end?: string) =>
    request<RescheduleAvailability>(credentials, `/orders/${encodeURIComponent(id)}/reschedule/chairs?${new URLSearchParams(end ? { start, end } : { start })}`),
  /** Sem a data certa: bloqueia a poltrona no período provável (os dias pagos antes são liberados). */
  rescheduleHold: (credentials: string, id: string, data: { chairId: string; start: string; end: string; note?: string }) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/reschedule/hold`, { method: 'POST', body: JSON.stringify(data) }),
  /** Com a data certa: o pedido vai para o novo período, com o mesmo número de dias já pago. */
  rescheduleConfirm: (credentials: string, id: string, data: { chairId: string; start: string; note?: string }) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/reschedule/confirm`, { method: 'POST', body: JSON.stringify(data) }),
  /** Solta a poltrona bloqueada da remarcação; o pedido continua aguardando a nova data. */
  rescheduleRelease: (credentials: string, id: string, note?: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/reschedule/release`, { method: 'POST', body: JSON.stringify({ note }) }),
  /** Troca a poltrona antes da entrega (os dias reservados vão para a nova poltrona). */
  changeOrderChair: (credentials: string, id: string, chairId: string, note: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/chair`, { method: 'PATCH', body: JSON.stringify({ chairId, note }) }),
  createManualOrder: (credentials: string, data: ManualOrderInput) =>
    request<Order>(credentials, '/orders/manual', { method: 'POST', body: JSON.stringify(data) }),
  cancelManualOrder: (credentials: string, id: string, reason: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/manual/cancel`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),
  contractLink: (credentials: string, id: string) =>
    request<ContractLinkState>(credentials, `/orders/${encodeURIComponent(id)}/manual/contract-link`),
  prepareContractLink: (credentials: string, id: string) =>
    request<ContractLinkState>(credentials, `/orders/${encodeURIComponent(id)}/manual/contract-link`, { method: 'POST' }),
  paymentLink: (credentials: string, id: string) =>
    request<PaymentLinkState>(credentials, `/orders/${encodeURIComponent(id)}/manual/payment-link`),
  preparePaymentLink: (credentials: string, id: string) =>
    request<PaymentLinkState>(credentials, `/orders/${encodeURIComponent(id)}/manual/payment-link`, { method: 'POST' }),
  /** Aguardando pagamento, mas combinado para depois: o pedido segue confirmado com saldo. */
  confirmManualOrder: (credentials: string, id: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/manual/confirm`, { method: 'POST' }),
  /** null quando o pedido ainda não tem contrato anexado. */
  orderContractFile: async (credentials: string, id: string) =>
    (await request<ContractFile | undefined>(credentials, `/orders/${encodeURIComponent(id)}/contract-file`)) ?? null,
  customerDetails: async (credentials: string, id: string) =>
    (await request<CustomerDetails | undefined>(credentials, `/orders/${encodeURIComponent(id)}/customer-details`)) ?? null,
  saveCustomerDetails: (credentials: string, id: string, data: CustomerDetails) =>
    request<CustomerDetails>(credentials, `/orders/${encodeURIComponent(id)}/customer-details`, { method: 'PUT', body: JSON.stringify(data) }),
  saleDetails: async (credentials: string, id: string) =>
    (await request<SaleDetails | undefined>(credentials, `/orders/${encodeURIComponent(id)}/sale-details`)) ?? null,
  saveSaleDetails: (credentials: string, id: string, data: SaleDetails) =>
    request<SaleDetails>(credentials, `/orders/${encodeURIComponent(id)}/sale-details`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrderCustomer: (credentials: string, id: string, data: { customerName: string; customerPhone: string; address: string; cep: string }) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/customer`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateOrderNote: (credentials: string, id: string, note: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/note`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  addOrderPayment: (credentials: string, id: string, data: ManualPaymentInput) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  removeOrderPayment: (credentials: string, id: string, paymentId: string) =>
    request<Order>(credentials, `/orders/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' }),
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
    if (query.status === 'AVAILABLE' || query.status === 'IN_USE') params.set('use', query.status)
    else if (query.status !== 'ALL') params.set('status', query.status)
    if (query.branchId !== 'ALL') params.set('branchId', query.branchId)
    return request<ChairPage>(credentials, `/chairs?${params}`)
  },
  chairSituation: (credentials: string, branchId: string) =>
    request<ChairSituation>(credentials, `/chairs/situation${branchId === 'ALL' ? '' : `?branchId=${encodeURIComponent(branchId)}`}`),
  chairOptions: (credentials: string) => request<ChairOption[]>(credentials, '/chairs/options'),
  activeChairCounts: (credentials: string) =>
    request<Record<string, number>>(credentials, '/chairs/active-counts'),
  createChair: (
    credentials: string,
    data: { code: string; model: string; notes: string; branchId: string },
  ) => request<Chair>(credentials, '/chairs', { method: 'POST', body: JSON.stringify(data) }),
  /**
   * Exclui a poltrona sem apagar o histórico: ela fica Inativa e a observação registra "Excluída em ... por ... Motivo: ...".
   * Com pedido em andamento o servidor recusa (409) com a explicação.
   */
  deleteChair: async (credentials: string, id: string, reason: string) => {
    await request<unknown>(credentials, `/chairs/${encodeURIComponent(id)}?reason=${encodeURIComponent(reason.trim())}`, { method: 'DELETE' })
  },
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

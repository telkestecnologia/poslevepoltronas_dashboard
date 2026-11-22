import { useEffect } from 'react'
import { api, type Courier, type Order, type OrderQuery, type OrderStatus } from '../api'

export const statusLabels: Record<OrderStatus, string> = {
  PENDING_CONTRACT: 'Aguardando contrato',
  PENDING_PAYMENT: 'Aguardando pagamento',
  PAYMENT_REVIEW: 'Pagamento em análise',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  DELIVERY_PENDING: 'Aguardando entrega',
  IN_USE: 'Em uso',
  PICKUP_PENDING: 'Aguardando retirada',
  COMPLETED: 'Concluído',
}

/** Etapas da operação, depois do pagamento confirmado. */
export const statusFlow: OrderStatus[] = ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING', 'COMPLETED']

export const isTestPayment = (order: Order) => Boolean(order.paymentMock || order.paymentSandbox)

/**
 * Forma de pagamento do pedido, pelo último evento de cobrança do histórico (o cliente pode trocar de Pix para
 * cartão e vice-versa antes de pagar). null quando não há cobrança real (contrato pendente ou pagamento de teste).
 */
export function paymentKind(order: Pick<Order, 'history'>): 'pix' | 'card' | null {
  for (let index = (order.history?.length ?? 0) - 1; index >= 0; index -= 1) {
    const action = order.history[index].action
    if (action === 'PIX_REQUESTED' || action === 'PIX_CONFIRMED') return 'pix'
    if (action === 'CARD_REQUESTED' || action === 'CARD_CONFIRMED') return 'card'
  }
  return null
}

/** "Pix", "cartão" ou "pagamento" (forma ainda desconhecida), para compor os textos. */
export function paymentName(order: Pick<Order, 'history'>) {
  const kind = paymentKind(order)
  return kind === 'pix' ? 'Pix' : kind === 'card' ? 'cartão' : 'pagamento'
}

export function orderStatusLabel(order: Order) {
  if (isTestPayment(order) && order.status === 'PENDING_PAYMENT') return 'Aguardando simulação'
  if (isTestPayment(order) && order.status === 'PAYMENT_CONFIRMED') return 'Pagamento confirmado'
  const kind = paymentKind(order)
  if (order.status === 'PENDING_PAYMENT') return kind === 'pix' ? 'Aguardando Pix' : kind === 'card' ? 'Aguardando cartão' : 'Aguardando pagamento'
  if (order.status === 'PAYMENT_REVIEW') return kind === 'pix' ? 'Pix em análise' : kind === 'card' ? 'Cartão em análise' : 'Pagamento em análise'
  return statusLabels[order.status]
}

/** "ALGUM_EVENTO" vira "Algum evento": um código novo do backend nunca aparece cru. */
function humanize(code: string) {
  const text = code.replace(/_/g, ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const eventLabels: Record<string, string> = {
  CREATED: 'Pedido criado', STOCK_EXPANDED: 'Intervalo de estoque ampliado', SCHEDULE_CHANGED: 'Horário alterado', EXPIRED: 'Prazo encerrado',
  CANCELLED: 'Pedido cancelado', COURIER_ASSIGNED: 'Entregador alterado', ISSUE_OPENED: 'Problema registrado',
  ISSUE_RESOLVED: 'Problema resolvido', PIX_REQUESTED: 'Pix gerado', PIX_CONFIRMED: 'Pagamento com Pix confirmado',
    CARD_REQUESTED: 'Pagamento com cartão solicitado', CARD_CONFIRMED: 'Pagamento com cartão aprovado',
  PIX_REVIEW: 'Pagamento em análise', MOCK_PAYMENT_REQUESTED: 'Pagamento gerado',
  MOCK_PAYMENT_CONFIRMED: 'Pagamento confirmado',
  CREATED_MANUAL: 'Pedido manual cadastrado', NOTE_UPDATED: 'Observação interna', MANUAL_PAYMENT: 'Pagamento lançado',
  MANUAL_PAYMENT_REMOVED: 'Pagamento desfeito', CHAIR_CHANGED: 'Poltrona trocada',
  BALANCE_REMINDER_SENT: 'Lembrete do pagamento (2 dias antes da entrega)',
  BALANCE_EVE_REMINDER_SENT: 'Lembrete do pagamento (véspera da entrega)',
  SALE_DETAILS_UPDATED: 'Detalhes da venda', CUSTOMER_DETAILS_UPDATED: 'Ficha do cliente', CONTRACT_FILE_UPLOADED: 'Contrato anexado',
}

/** Texto da linha do tempo para cada código de evento gravado pelo backend no histórico do pedido. */
export function eventLabel(action: string) {
  if (action.startsWith('STATUS_')) return statusLabels[action.slice(7) as OrderStatus] ?? humanize(action.slice(7))
  return eventLabels[action] ?? humanize(action)
}

export type EventTone = 'start' | 'done' | 'problem' | 'closed' | 'step'

export function eventTone(action: string): EventTone {
  if (action.startsWith('CREATED')) return 'start'
  if (['STATUS_COMPLETED', 'ISSUE_RESOLVED', 'PIX_CONFIRMED', 'CARD_CONFIRMED', 'MOCK_PAYMENT_CONFIRMED'].includes(action)) return 'done'
  if (action === 'ISSUE_OPENED' || action === 'PIX_REVIEW' || action === 'STATUS_PAYMENT_REVIEW') return 'problem'
  if (['EXPIRED', 'CANCELLED', 'STATUS_CANCELLED', 'STATUS_EXPIRED'].includes(action)) return 'closed'
  return 'step'
}

/** Tipos da linha do tempo (os mesmos do app): cada um com cor, emoji e nome. */
export const eventKinds = {
  order: { label: 'Pedido', emoji: '📝' }, payment: { label: 'Pagamento', emoji: '💰' }, delivery: { label: 'Entrega', emoji: '🚚' },
  problem: { label: 'Problema', emoji: '⚠️' }, done: { label: 'Concluído', emoji: '✅' }, closed: { label: 'Encerrado', emoji: '⛔' },
  step: { label: 'Alteração', emoji: '✏️' },
} as const

export function eventKind(action: string): keyof typeof eventKinds {
  if (action === 'ISSUE_OPENED' || /REVIEW/.test(action)) return 'problem'
  if (/CANCEL|EXPIRE/.test(action)) return 'closed'
  if (action === 'STATUS_COMPLETED' || action === 'ISSUE_RESOLVED') return 'done'
  if (action.startsWith('CREATED') || /CONTRACT/.test(action)) return 'order'
  if (/PIX|CARD|PAYMENT|BALANCE/.test(action)) return 'payment'
  if (/COURIER|DEPARTURE|STOCK|DELIVERY|PICKUP|IN_USE/.test(action)) return 'delivery'
  return 'step'
}

const actorLabels: Record<string, string> = {
  system: 'Sistema', customer: 'Cliente', inter: 'Banco Inter', asaas: 'Asaas', mock: 'Pagamento', whatsapp: 'WhatsApp', ai: 'Isa',
}

/** Quem fez o passo: o backend grava códigos (system, customer, inter...) ou o e-mail de quem estava logado. */
export function actorLabel(actor: string, couriers: Pick<Courier, 'id' | 'name'>[]) {
  if (actor.startsWith('courier:')) return couriers.find(courier => courier.id === actor.slice(8))?.name ?? 'Entregador'
  return actorLabels[actor] ?? actor
}

const PAGE_LIMIT = 100

/** Todas as páginas de um filtro já feito no servidor. Use com filtros que limitam o volume (status, período). */
export async function fetchAllOrders(credentials: string, query: OrderQuery): Promise<Order[]> {
  const items: Order[] = []
  for (let page = 0; page < 50; page += 1) {
    const result = await api.orderPage(credentials, query, page, PAGE_LIMIT)
    items.push(...result.items)
    if (result.items.length < PAGE_LIMIT || items.length >= result.total) break
  }
  return items
}

/** Roda load ao abrir, a cada intervalMs com a aba visível e quando a aba volta ao primeiro plano. */
export function usePolling(load: () => unknown, intervalMs: number) {
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, intervalMs)
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, intervalMs])
}

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`))

export const dateTimeLabel = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' }).format(new Date(value))

export const weekdayDateLabel = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`))

export const currency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

/** Pedido de verdade (site/Isa ou cadastrado à mão): ocupa poltrona, tem valor e segue a operação. */
export const isRealOrder = (order: Pick<Order, 'source'>) => order.source === 'CHECKOUT' || order.source === 'MANUAL'

/** Quanto falta o cliente pagar num pedido cadastrado à mão (0 nos pedidos do site, que o banco confirma inteiros). */
export function balanceCents(order: Pick<Order, 'source' | 'status' | 'totalCents' | 'totalPaidCents'>) {
  if (order.source !== 'MANUAL' || order.status === 'CANCELLED') return 0
  return Math.max(0, order.totalCents - (order.totalPaidCents ?? 0))
}

const beforeDelivery: OrderStatus[] = ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'DELIVERY_PENDING']
/** Lembretes do restante que o backend envia à cliente pelo WhatsApp (2 dias antes e na véspera da entrega). */
export const BALANCE_REMINDER = 'BALANCE_REMINDER_SENT'
export const BALANCE_EVE_REMINDER = 'BALANCE_EVE_REMINDER_SENT'

function plusDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export type PaymentAlert = { dueCents: number; deliveryDay: string; when: string; reminders: string; text: string }

/**
 * Pagamento pendente: pedido do Cadastro Manual com valor a receber e entrega amanhã (ou já passada) sem ter sido
 * entregue. A cliente recebe os lembretes pelo WhatsApp; a equipe vê este aviso no dia do segundo lembrete. Some
 * sozinho quando o pagamento é confirmado. Mesma regra no app.
 */
export function paymentAlert(order: Pick<Order, 'source' | 'status' | 'totalCents' | 'totalPaidCents' | 'deliveryDate' | 'start'
  | 'deliveryTime' | 'history'>, today: string): PaymentAlert | null {
  const dueCents = balanceCents(order)
  if (dueCents <= 0 || !beforeDelivery.includes(order.status)) return null
  // Aguardando pagamento sem nada pago: a venda ainda está sendo fechada, os lembretes não saem.
  if (order.status === 'PENDING_PAYMENT' && !(order.totalPaidCents ?? 0)) return null
  const deliveryDay = order.deliveryDate ?? order.start
  if (deliveryDay > plusDays(today, 1)) return null
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${deliveryDay}T12:00:00Z`))
  const shift = order.deliveryTime === '08:00-12:00' ? ' (manhã)' : order.deliveryTime === '13:00-18:00' ? ' (tarde)'
    : order.deliveryTime ? ` (${order.deliveryTime.replace('-', ' às ')})` : ''
  const when = deliveryDay === today ? `entrega hoje, ${day}${shift}` : deliveryDay < today ? `entrega era em ${day}${shift}`
    : `entrega amanhã, ${day}${shift}`
  const sent = [order.history.some(event => event.action === BALANCE_REMINDER) && '2 dias antes',
    order.history.some(event => event.action === BALANCE_EVE_REMINDER) && 'na véspera'].filter(Boolean) as string[]
  const reminders = sent.length ? `lembretes enviados: ${sent.join(' e ')}` : 'nenhum lembrete enviado pelo WhatsApp'
  return { dueCents, deliveryDay, when, reminders, text: `${when} • falta ${currency(dueCents)} • ${reminders}` }
}

/** Motivo do pedido manual, como aparece na tag amarela. */
export const manualReasonLabels = {
  ANTES_DO_SISTEMA: 'Antes do sistema', DESCONTO: 'Desconto', SINAL: 'Sinal ou pagamento em partes',
  FORA_DO_WHATSAPP: 'Venda fora do WhatsApp', OUTRO: 'Outro motivo',
} as const

/** Texto da tag amarela do pedido manual. */
export const manualTagText = (reason: string | null | undefined) => reason === 'ANTES_DO_SISTEMA'
  ? 'Pedido de antes do sistema' : `Pedido manual${reason && reason in manualReasonLabels ? ` • ${manualReasonLabels[reason as keyof typeof manualReasonLabels]}` : ''}`

export const paymentMethodLabels = { PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro' } as const

import { useEffect } from 'react'
import { api, type Courier, type Order, type OrderQuery, type OrderStatus } from '../api'

export const statusLabels: Record<OrderStatus, string> = {
  PENDING_CONTRACT: 'Aguardando contrato',
  PENDING_PAYMENT: 'Aguardando PIX',
  PAYMENT_REVIEW: 'PIX em análise',
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

export function orderStatusLabel(order: Order) {
  if (isTestPayment(order) && order.status === 'PENDING_PAYMENT') return 'Aguardando simulação'
  if (isTestPayment(order) && order.status === 'PAYMENT_CONFIRMED') return 'Teste confirmado'
  return statusLabels[order.status]
}

/** "ALGUM_EVENTO" vira "Algum evento": um código novo do backend nunca aparece cru. */
function humanize(code: string) {
  const text = code.replace(/_/g, ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const eventLabels: Record<string, string> = {
  CREATED: 'Pedido criado', STOCK_EXPANDED: 'Intervalo de estoque ampliado', EXPIRED: 'Prazo encerrado',
  CANCELLED: 'Pedido cancelado', COURIER_ASSIGNED: 'Entregador alterado', ISSUE_OPENED: 'Problema registrado',
  ISSUE_RESOLVED: 'Problema resolvido', PIX_REQUESTED: 'PIX gerado', PIX_CONFIRMED: 'Pagamento PIX confirmado',
    CARD_REQUESTED: 'Pagamento com cartão solicitado', CARD_CONFIRMED: 'Pagamento com cartão aprovado',
  PIX_REVIEW: 'Pagamento em análise', MOCK_PAYMENT_REQUESTED: 'PIX de teste gerado',
  MOCK_PAYMENT_CONFIRMED: 'Pagamento de teste confirmado',
}

/** Texto da linha do tempo para cada código de evento gravado pelo backend no histórico do pedido. */
export function eventLabel(action: string) {
  if (action.startsWith('STATUS_')) return statusLabels[action.slice(7) as OrderStatus] ?? humanize(action.slice(7))
  return eventLabels[action] ?? humanize(action)
}

export type EventTone = 'start' | 'done' | 'problem' | 'closed' | 'step'

export function eventTone(action: string): EventTone {
  if (action === 'CREATED') return 'start'
  if (['STATUS_COMPLETED', 'ISSUE_RESOLVED', 'PIX_CONFIRMED', 'CARD_CONFIRMED', 'MOCK_PAYMENT_CONFIRMED'].includes(action)) return 'done'
  if (action === 'ISSUE_OPENED' || action === 'PIX_REVIEW' || action === 'STATUS_PAYMENT_REVIEW') return 'problem'
  if (['EXPIRED', 'CANCELLED', 'STATUS_CANCELLED', 'STATUS_EXPIRED'].includes(action)) return 'closed'
  return 'step'
}

const actorLabels: Record<string, string> = {
  system: 'Sistema', customer: 'Cliente', inter: 'Banco Inter', asaas: 'Asaas', mock: 'Teste', whatsapp: 'WhatsApp', ai: 'Isa',
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
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`))

export const currency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Armchair, Bell, BellOff, Check, ChevronRight, MessagesSquare, Sparkles } from 'lucide-react'
import { api, type Conversation, type Order, type OrderStatus } from '../../api'
import { fetchAllOrders, usePolling } from '../../data/orders'
import type { Page } from '../../types'
import { helpDetail, helpTitle, needsHelp } from '../../utils/conversations'
import './attention.css'

/** Para onde o aviso leva: o pedido ou a conversa daquele aviso, ou a tela com o filtro certo. */
export type AttentionTarget = { page: Page; id?: string; chairStatus?: 'MAINTENANCE' }
type Alert = { key: string; level: 'urgent' | 'warning'; title: string; detail: string; target: AttentionTarget }

const zone = 'America/Fortaleza'
const notifyKey = 'posleve.desktop-notifications'
const notified = new Set<string>()

function todayIso() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: zone })
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
}

function time(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(iso))
}

/** Pedidos que podem gerar um aviso (regras em buildAlerts). */
const attentionStatuses: OrderStatus[] = ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING']

/** Só os pedidos em andamento ou com problema em aberto, já filtrados no servidor. */
async function fetchAttentionOrders(credentials: string) {
  const [active, withIssues] = await Promise.all([
    fetchAllOrders(credentials, { source: 'CHECKOUT', statuses: attentionStatuses }),
    fetchAllOrders(credentials, { source: 'CHECKOUT', openIssues: true }),
  ])
  const byId = new Map(active.map(order => [order.id, order]))
  for (const order of withIssues) byId.set(order.id, order)
  return [...byId.values()]
}

/** Mesmas regras de "Precisa da sua atenção" do app. */
function buildAlerts({ orders, conversations, unanswered, maintenance }: {
  orders: Order[]; conversations: Conversation[]; unanswered: number; maintenance: number
}): Alert[] {
  const now = todayIso()
  const tomorrow = addDays(now, 1)
  const items: Alert[] = []
  const who = (order: Order) => `${order.customerName} (${order.municipalityName}/${order.municipalityUf}, ${order.address})`
  const toOrder = (order: Order): AttentionTarget => ({ page: 'orders', id: order.id })
  for (const order of orders.filter(item => item.source === 'CHECKOUT')) {
    if (order.status === 'PAYMENT_REVIEW') {
      items.push({ key: `review-${order.id}`, level: 'urgent', title: 'PIX em análise', target: toOrder(order),
        detail: `${who(order)}: confira o recebimento no Asaas antes de falar com o cliente.` })
    }
    for (const issue of order.issues.filter(item => item.status === 'OPEN')) {
      items.push({ key: `issue-${issue.id}`, level: 'urgent', title: `Problema em aberto: ${issue.title}`, target: toOrder(order),
        detail: `${who(order)} • poltrona ${order.chairCode}` })
    }
    const waitingDelivery = order.status === 'PAYMENT_CONFIRMED' || order.status === 'DELIVERY_PENDING'
    const waitingPickup = order.status === 'IN_USE' || order.status === 'PICKUP_PENDING'
    if (waitingDelivery && order.start < now) {
      items.push({ key: `late-delivery-${order.id}`, level: 'urgent', title: 'Entrega atrasada', target: toOrder(order),
        detail: `${who(order)}: estava prevista para ${shortDate(order.start)}.` })
    } else if (waitingDelivery && order.start <= tomorrow && !order.courierId) {
      items.push({ key: `courier-${order.id}`, level: 'warning', title: 'Entrega sem entregador', target: toOrder(order),
        detail: `${who(order)}: entrega ${order.start === now ? 'hoje' : 'amanhã'}${order.deliveryTime ? ` às ${order.deliveryTime}` : ''}.` })
    } else if (waitingDelivery) {
      items.push({ key: `deliver-${order.id}`, level: 'warning', title: 'Entregar poltrona', target: toOrder(order),
        detail: `${who(order)}: entrega em ${shortDate(order.start)}${order.deliveryTime ? ` às ${order.deliveryTime}` : ''}.` })
    }
    if (waitingPickup && order.end < now) {
      items.push({ key: `late-pickup-${order.id}`, level: 'urgent', title: 'Retirada atrasada', target: toOrder(order),
        detail: `${who(order)}: estava prevista para ${shortDate(order.end)}.` })
    } else if (order.status === 'PICKUP_PENDING') {
      items.push({ key: `pickup-${order.id}`, level: 'warning', title: 'Retirar poltrona', target: toOrder(order),
        detail: `${who(order)}: retirada em ${shortDate(order.end)}${order.pickupTime ? ` às ${order.pickupTime}` : ''}.` })
    }
    if (order.status === 'PENDING_PAYMENT' && order.expiresAt) {
      const left = new Date(order.expiresAt).getTime() - Date.now()
      if (left > 0 && left < 2 * 60 * 60_000) {
        items.push({ key: `expiring-${order.id}`, level: 'warning', title: 'PIX perto de vencer', target: toOrder(order),
          detail: `${who(order)}: a reserva vence às ${time(order.expiresAt)}.` })
      }
    }
  }
  for (const conversation of conversations.filter(needsHelp)) {
    items.push({ key: `help-${conversation.id}-${conversation.lastMessageAt}`, level: 'urgent',
      target: { page: 'conversations', id: conversation.id },
      title: helpTitle(conversation), detail: helpDetail(conversation) })
  }
  if (unanswered > 0) {
    items.push({ key: 'unanswered', level: 'warning', title: `${unanswered} ${unanswered === 1 ? 'dúvida' : 'dúvidas'} sem resposta`,
      detail: 'Clientes perguntaram e a Isa não soube responder.', target: { page: 'ai' } })
  }
  if (maintenance > 0) {
    items.push({ key: 'maintenance', level: 'warning', title: `${maintenance} ${maintenance === 1 ? 'poltrona' : 'poltronas'} em manutenção`,
      detail: 'Elas não aparecem para aluguel no site.', target: { page: 'chairs', chairStatus: 'MAINTENANCE' } })
  }
  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'urgent' ? -1 : 1))
}

function readSetting() {
  try { return localStorage.getItem(notifyKey) === 'on' } catch { return false }
}

function iconOf(alert: Alert) {
  if (alert.target.page === 'conversations') return <MessagesSquare size={17} />
  if (alert.target.page === 'ai') return <Sparkles size={17} />
  if (alert.target.page === 'chairs') return <Armchair size={17} />
  return <AlertTriangle size={17} />
}

/**
 * "Precisa da sua atenção" da Visão geral. As conversas atualizam a cada 10 segundos e os pedidos a cada 30; com as
 * notificações do navegador ligadas, cada aviso urgente novo vira uma notificação que abre o pedido ou a conversa.
 */
export function AttentionPanel({ credentials, onOpen }: { credentials: string; onOpen: (target: AttentionTarget) => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unanswered, setUnanswered] = useState(0)
  const [maintenance, setMaintenance] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [notifyOn, setNotifyOn] = useState(() => readSetting() && typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const [notifyMessage, setNotifyMessage] = useState('')
  const onOpenRef = useRef(onOpen)
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])

  const loadConversations = useCallback(() => api.conversations(credentials)
    .then(page => setConversations(page.items), () => {}), [credentials])

  // Uma falha aqui só esconde o aviso correspondente.
  const loadOrders = useCallback(() => Promise.all([
    fetchAttentionOrders(credentials).then(setOrders, () => setOrders(current => current ?? [])),
    api.aiUnanswered(credentials).then(list => setUnanswered(list.length), () => {}),
    api.chairs(credentials, { page: 0, size: 1, search: '', status: 'MAINTENANCE', branchId: 'ALL' })
      .then(page => setMaintenance(page.total), () => {}),
  ]), [credentials])

  usePolling(loadConversations, 10_000)
  usePolling(loadOrders, 30_000)

  const alerts = useMemo(() => orders === null ? null
    : buildAlerts({ orders, conversations, unanswered, maintenance }), [orders, conversations, unanswered, maintenance])

  useEffect(() => {
    if (!notifyOn || !alerts) return
    for (const alert of alerts.filter(item => item.level === 'urgent' && !notified.has(item.key))) {
      notified.add(alert.key)
      const notification = new Notification(`Pós Leve • ${alert.title}`, { body: alert.detail, icon: '/logo-pos-leve-icon.webp', tag: alert.key })
      notification.onclick = () => { window.focus(); onOpenRef.current(alert.target) }
    }
  }, [alerts, notifyOn])

  async function toggleNotifications() {
    if (typeof Notification === 'undefined') return setNotifyMessage('Este navegador não mostra notificações.')
    if (notifyOn) {
      setNotifyOn(false)
      try { localStorage.setItem(notifyKey, 'off') } catch { /* sem armazenamento local */ }
      return
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return setNotifyMessage('O navegador bloqueou as notificações. Libere nas configurações do site.')
    // Avisos que já estão na tela não viram notificação; só os que chegarem a partir de agora.
    alerts?.forEach(alert => notified.add(alert.key))
    try { localStorage.setItem(notifyKey, 'on') } catch { /* sem armazenamento local */ }
    setNotifyMessage('')
    setNotifyOn(true)
    new Notification('Pós Leve • Notificações ativadas', { body: 'Você vai receber aqui os avisos urgentes do painel.', icon: '/logo-pos-leve-icon.webp' })
  }

  const list = alerts ?? []
  const shown = showAll ? list : list.slice(0, 3)
  const urgent = list.filter(alert => alert.level === 'urgent').length

  return <section className="glass-backdrop" aria-label="Notificações">
    <span className="glass-blob teal" /><span className="glass-blob coral" />
    <button type="button" className={`glass-card notify-toggle${notifyOn ? ' on' : ''}`} role="switch" aria-checked={notifyOn}
      onClick={() => void toggleNotifications()}>
      <span className="notify-icon">{notifyOn ? <Bell size={18} /> : <BellOff size={18} />}</span>
      <span className="notify-text"><strong>{notifyOn ? 'Notificações ativadas' : 'Ativar notificações'}</strong>
        <small>{notifyMessage || (notifyOn ? 'Você recebe um aviso no computador quando algo urgente acontecer, como uma mensagem que a Isa não conseguiu responder.'
          : 'Receba no computador os avisos urgentes, como PIX em análise ou mensagem que a Isa não soube responder.')}</small></span>
      <span className={`notify-switch${notifyOn ? ' on' : ''}`}><i /></span>
    </button>

    <div className="attention-head"><h2>Precisa da sua atenção</h2>
      {list.length > 0 && <span className={`attention-count${urgent ? ' urgent' : ''}`}>{list.length}</span>}</div>
    {alerts === null ? <div className="glass-card attention-empty"><p>Carregando avisos…</p></div>
      : list.length === 0 ? <div className="glass-card attention-empty"><span className="attention-ok"><Check size={18} /></span>
        <div><strong>Tudo em dia</strong><small>Nenhum pedido, entrega ou conversa precisando de você agora.</small></div></div>
        : <div className="glass-card attention-list">
          {shown.map(alert => <button type="button" key={alert.key} className="attention-row" onClick={() => onOpen(alert.target)}>
            <span className={`attention-icon ${alert.level}`}>{iconOf(alert)}</span>
            <span className="attention-text"><strong>{alert.title}</strong><small>{alert.detail}</small></span>
            <ChevronRight size={16} />
          </button>)}
          {list.length > 3 && <button type="button" className="attention-more" onClick={() => setShowAll(value => !value)}>
            {showAll ? 'Mostrar menos' : `Ver todos os ${list.length} avisos`}</button>}
        </div>}
  </section>
}

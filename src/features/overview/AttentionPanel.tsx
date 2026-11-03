import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, BellOff, Check, ChevronRight, MessagesSquare } from 'lucide-react'
import { api, type Conversation, type Order } from '../../api'
import type { Page } from '../../types'
import { helpDetail, helpTitle, needsHelp } from '../../utils/conversations'
import './attention.css'

type Alert = { key: string; level: 'urgent' | 'warning'; title: string; detail: string; page: Page }

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

/** Mesmas regras de "Precisa da sua atenção" do app: pedidos e conversas que a Isa não conseguiu responder. */
function buildAlerts(orders: Order[], conversations: Conversation[]): Alert[] {
  const now = todayIso()
  const tomorrow = addDays(now, 1)
  const items: Alert[] = []
  const who = (order: Order) => `${order.customerName} (${order.municipalityName}/${order.municipalityUf}, ${order.address})`
  for (const order of orders.filter(item => item.source === 'CHECKOUT')) {
    if (order.status === 'PAYMENT_REVIEW') {
      items.push({ key: `review-${order.id}`, level: 'urgent', title: 'PIX em análise', page: 'orders',
        detail: `${who(order)}: confira o recebimento no Inter antes de falar com o cliente.` })
    }
    for (const issue of order.issues.filter(item => item.status === 'OPEN')) {
      items.push({ key: `issue-${issue.id}`, level: 'urgent', title: `Problema em aberto: ${issue.title}`, page: 'orders',
        detail: `${who(order)} • poltrona ${order.chairCode}` })
    }
    const waitingDelivery = order.status === 'PAYMENT_CONFIRMED' || order.status === 'DELIVERY_PENDING'
    const waitingPickup = order.status === 'IN_USE' || order.status === 'PICKUP_PENDING'
    if (waitingDelivery && order.start < now) {
      items.push({ key: `late-delivery-${order.id}`, level: 'urgent', title: 'Entrega atrasada', page: 'orders',
        detail: `${who(order)}: estava prevista para ${shortDate(order.start)}.` })
    } else if (waitingDelivery && order.start <= tomorrow && !order.courierId) {
      items.push({ key: `courier-${order.id}`, level: 'warning', title: 'Entrega sem entregador', page: 'orders',
        detail: `${who(order)}: entrega ${order.start === now ? 'hoje' : 'amanhã'}${order.deliveryTime ? ` às ${order.deliveryTime}` : ''}.` })
    }
    if (waitingPickup && order.end < now) {
      items.push({ key: `late-pickup-${order.id}`, level: 'urgent', title: 'Retirada atrasada', page: 'orders',
        detail: `${who(order)}: estava prevista para ${shortDate(order.end)}.` })
    }
  }
  for (const conversation of conversations.filter(needsHelp)) {
    items.push({ key: `help-${conversation.id}-${conversation.lastMessageAt}`, level: 'urgent', page: 'conversations',
      title: helpTitle(conversation), detail: helpDetail(conversation) })
  }
  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'urgent' ? -1 : 1))
}

function readSetting() {
  try { return localStorage.getItem(notifyKey) === 'on' } catch { return false }
}

/**
 * "Precisa da sua atenção" da Visão geral, com o mesmo fundo de vidro do app. Atualiza a cada 10 segundos e, com as
 * notificações do navegador ligadas, avisa na hora cada mensagem que a Isa não conseguiu responder.
 */
export function AttentionPanel({ credentials, onNavigate }: { credentials: string; onNavigate: (page: Page) => void }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [notifyOn, setNotifyOn] = useState(() => readSetting() && typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const [notifyMessage, setNotifyMessage] = useState('')
  const notifyRef = useRef(notifyOn)
  useEffect(() => { notifyRef.current = notifyOn }, [notifyOn])

  const load = useCallback(() => Promise.all([api.orders(credentials), api.conversations(credentials).then(page => page.items, () => [])])
    .then(([orders, conversations]) => {
      const next = buildAlerts(orders, conversations)
      setAlerts(next)
      if (!notifyRef.current) return
      for (const alert of next.filter(item => item.level === 'urgent' && !notified.has(item.key))) {
        notified.add(alert.key)
        const notification = new Notification(`Pós Leve • ${alert.title}`, { body: alert.detail, icon: '/logo-pos-leve-icon.webp', tag: alert.key })
        notification.onclick = () => { window.focus(); onNavigate(alert.page) }
      }
    }, () => setAlerts(current => current ?? [])), [credentials, onNavigate])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 10_000)
    return () => clearInterval(timer)
  }, [load])

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
          {shown.map(alert => <button type="button" key={alert.key} className="attention-row" onClick={() => onNavigate(alert.page)}>
            <span className={`attention-icon ${alert.level}`}>{alert.page === 'conversations' ? <MessagesSquare size={17} /> : <AlertTriangle size={17} />}</span>
            <span className="attention-text"><strong>{alert.title}</strong><small>{alert.detail}</small></span>
            <ChevronRight size={16} />
          </button>)}
          {list.length > 3 && <button type="button" className="attention-more" onClick={() => setShowAll(value => !value)}>
            {showAll ? 'Mostrar menos' : `Ver todos os ${list.length} avisos`}</button>}
        </div>}
  </section>
}

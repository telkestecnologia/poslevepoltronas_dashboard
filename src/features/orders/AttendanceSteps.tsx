import { Check, X } from 'lucide-react'
import type { Order } from '../../api'

const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' })

/**
 * Etapas do atendimento de quem ainda não virou pedido (contrato, pagamento) ou não chegou a virar (prazo encerrado,
 * cancelado), igual ao app. Expirado ou cancelado mostra só o que aconteceu de fato.
 */
export function AttendanceSteps({ order }: { order: Order }) {
  const at = (...actions: string[]) => order.history.find(event => actions.includes(event.action))?.at
  const paymentAt = at('PIX_REQUESTED', 'CARD_REQUESTED', 'MOCK_PAYMENT_REQUESTED')
  const contractAt = at('STATUS_PENDING_PAYMENT', 'CONTRACT_ACCEPTED')
    ?? (paymentAt || order.status === 'PENDING_PAYMENT' || order.status === 'PAYMENT_REVIEW' ? paymentAt ?? order.createdAt : undefined)
  const endAt = at('EXPIRED', 'CANCELLED', 'STATUS_EXPIRED', 'STATUS_CANCELLED')
  const ended = order.status === 'EXPIRED' || order.status === 'CANCELLED'
  type Item = { label: string; detail: string; state: 'done' | 'current' | 'next' | 'failed' }
  const all: Item[] = [
    { label: 'Atendimento iniciado', detail: when.format(new Date(order.createdAt)), state: 'done' },
    { label: 'Contrato aceito', detail: contractAt ? when.format(new Date(contractAt)) : 'Aguardando o cliente',
      state: contractAt ? 'done' : order.status === 'PENDING_CONTRACT' ? 'current' : 'next' },
    { label: 'Pagamento gerado', detail: paymentAt ? when.format(new Date(paymentAt)) : 'Aguardando',
      state: paymentAt ? 'done' : order.status === 'PENDING_PAYMENT' ? 'current' : 'next' },
    order.status === 'EXPIRED' ? { label: 'Prazo encerrado', detail: `${endAt ? `${when.format(new Date(endAt))} • ` : ''}O pagamento não foi feito a tempo; não virou pedido.`, state: 'failed' }
      : order.status === 'CANCELLED' ? { label: 'Cancelado', detail: `${endAt ? `${when.format(new Date(endAt))} • ` : ''}Não virou pedido.`, state: 'failed' }
        : order.status === 'PAYMENT_REVIEW' ? { label: 'Pagamento em análise', detail: 'Confira o recebimento antes de orientar o cliente.', state: 'current' }
          : { label: 'Pagamento confirmado', detail: 'Quando o cliente pagar, vira pedido.', state: 'next' },
  ]
  const items = all.filter((item, index) => !ended || item.state === 'done' || index === all.length - 1)
  return <section className="panel od-card od-attendance" aria-labelledby="od-attendance-title">
    <div className="od-step-head"><h2 id="od-attendance-title">Etapas do atendimento</h2>
      {ended && <span className="order-status status-expired">Sem pedido</span>}</div>
    <ol>
      {items.map((item, index) => <li key={item.label} className={item.state}>
        <span className={`od-step-dot ${item.state}`}>{item.state === 'done' ? <Check size={14} strokeWidth={3} />
          : item.state === 'failed' ? <X size={14} strokeWidth={3} /> : index + 1}</span>
        <span><strong>{item.label}</strong><small>{item.detail}</small></span>
      </li>)}
    </ol>
  </section>
}

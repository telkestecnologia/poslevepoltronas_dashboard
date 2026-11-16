import { Armchair, CheckCircle2, ClipboardCheck, CreditCard, PackageCheck, Truck, Undo2, type LucideIcon } from 'lucide-react'
import type { Courier, Order } from '../../api'
import { actorLabel, dateTimeLabel, eventKind, eventKinds, eventLabel, weekdayDateLabel } from '../../data/orders'
import './order-journey.css'

type Step = { key: string; label: string; hint: string; icon: LucideIcon; actions: string[]; planned?: string }

/** Ordem das etapas do pedido, do início ao fim. A data de cada uma vem do histórico; as futuras mostram o previsto. */
function stepsOf(order: Order): Step[] {
  return [
    { key: 'CREATED', label: 'Pedido feito', hint: 'O cliente escolheu a poltrona e as datas', icon: ClipboardCheck, actions: ['CREATED'] },
    { key: 'PAYMENT_CONFIRMED', label: 'Pagamento confirmado', hint: 'O pagamento caiu e a reserva está garantida', icon: CreditCard,
      actions: ['STATUS_PAYMENT_CONFIRMED', 'PIX_CONFIRMED', 'CARD_CONFIRMED', 'MOCK_PAYMENT_CONFIRMED'] },
    { key: 'DEPARTURE', label: 'Saindo para entrega', hint: 'O cliente é avisado que a poltrona está a caminho', icon: Truck,
      actions: ['DELIVERY_DEPARTURE_NOTIFIED', 'STATUS_DELIVERY_PENDING'] },
    { key: 'DELIVERY_PENDING', label: 'Entrega', hint: 'O entregador leva e instala a poltrona', icon: PackageCheck,
      actions: ['STATUS_IN_USE'], planned: order.deliveryDate ?? order.start },
    { key: 'IN_USE', label: 'Em uso', hint: 'A poltrona está com o cliente', icon: Armchair, actions: ['STATUS_IN_USE'] },
    { key: 'PICKUP_PENDING', label: 'Retirada', hint: 'O entregador busca a poltrona', icon: Undo2,
      actions: ['STATUS_COMPLETED'], planned: order.pickupDate ?? order.end },
    { key: 'COMPLETED', label: 'Concluído', hint: 'Aluguel encerrado', icon: CheckCircle2, actions: ['STATUS_COMPLETED'] },
  ]
}

/** Em que etapa o pedido está agora (índice na lista acima). */
function currentIndex(order: Order) {
  switch (order.status) {
    case 'PAYMENT_CONFIRMED': return order.history.some(event => event.action === 'DELIVERY_DEPARTURE_NOTIFIED') ? 3 : 2
    case 'DELIVERY_PENDING': return 3
    case 'IN_USE': return 4
    case 'PICKUP_PENDING': return 5
    case 'COMPLETED': return 7
    default: return 1
  }
}

/**
 * Jornada do pedido (só no computador): todas as etapas numa linha, ligadas por um traço que vai se preenchendo.
 * Cada etapa diz o que é, quando aconteceu (ou quando está prevista) e quem fez.
 */
export function OrderJourney({ order, couriers }: { order: Order; couriers: Pick<Courier, 'id' | 'name'>[] }) {
  const steps = stepsOf(order)
  const now = currentIndex(order)
  const doneCount = Math.min(now, steps.length)
  const percent = Math.round((doneCount / steps.length) * 100)
  const progress = Math.min(1, now / (steps.length - 1))
  const eventOf = (step: Step) => order.history.find(event => step.actions.includes(event.action))
  return <section className="panel oj" aria-label="Jornada do pedido">
    <header className="oj-head">
      <div><span className="eyebrow">JORNADA DO PEDIDO</span>
        <h2>{now >= steps.length ? 'Pedido concluído do início ao fim' : <>Agora: <em>{steps[now].label}</em></>}</h2>
        <p>{now >= steps.length ? 'Todas as etapas foram cumpridas.' : steps[now].hint}.</p></div>
      <div className="oj-progress" aria-label={`${percent}% concluído`}>
        <strong>{percent}%</strong><span>{doneCount} de {steps.length} etapas</span>
        <div className="oj-progress-bar"><i style={{ width: `${percent}%` }} /></div>
      </div>
    </header>
    <ol className="oj-track" style={{ ['--oj-progress' as string]: progress }}>
      {steps.map((step, index) => {
        const done = index < now
        const current = index === now
        const event = done ? eventOf(step) : undefined
        const Icon = step.icon
        return <li key={step.key} className={done ? 'done' : current ? 'current' : 'next'} aria-current={current ? 'step' : undefined}>
          <span className="oj-node"><Icon size={20} strokeWidth={2.2} />{current && <i className="oj-ring" aria-hidden="true" />}</span>
          <span className="oj-tag">{done ? 'Feito' : current ? 'Agora' : 'Próxima'}</span>
          <strong>{step.label}</strong>
          {event ? <small>{dateTimeLabel(event.at)}<br />por {actorLabel(event.actor, couriers)}</small>
            : step.planned ? <small className="planned">Previsto para<br />{weekdayDateLabel(step.planned)}</small>
              : <small>{done ? 'Concluída' : current ? 'Em andamento' : 'Ainda não'}</small>}
        </li>
      })}
    </ol>
  </section>
}

/** Histórico completo (só no computador): tudo o que aconteceu, agrupado por dia, numa linha vertical contínua. */
export function OrderHistoryFull({ order, couriers }: { order: Order; couriers: Pick<Courier, 'id' | 'name'>[] }) {
  const events = [...order.history].reverse()
  const days = new Map<string, typeof events>()
  for (const event of events) {
    const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Fortaleza' })
      .format(new Date(event.at))
    days.set(day, [...(days.get(day) ?? []), event])
  }
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' })
  return <section className="panel oh" aria-labelledby="oh-title">
    <header className="oh-head">
      <div><span className="eyebrow">HISTÓRICO</span><h2 id="oh-title">Tudo o que aconteceu neste pedido</h2>
        <p>Do mais recente para o mais antigo. Cada cor é um tipo de acontecimento.</p></div>
      <div className="oh-legend">{(['order', 'payment', 'delivery', 'problem', 'done'] as const).map(key =>
        <span key={key} className={`oh-chip kind-${key}`}>{eventKinds[key].emoji} {eventKinds[key].label}</span>)}</div>
    </header>
    {[...days.entries()].map(([day, list]) => <div key={day} className="oh-day">
      <h3>{day}</h3>
      <ol className="oh-list">{list.map((event, index) => {
        const kind = eventKind(event.action)
        return <li key={`${event.at}-${index}`} className={`kind-${kind}`}>
          <time>{time.format(new Date(event.at))}</time>
          <span className="oh-dot" aria-hidden="true">{eventKinds[kind].emoji}</span>
          <div className="oh-card"><strong>{eventLabel(event.action)}</strong>
            <small>{eventKinds[kind].label} • por {actorLabel(event.actor, couriers)}</small>
            {event.note && <p>{event.note}</p>}</div>
        </li>
      })}</ol>
    </div>)}
  </section>
}

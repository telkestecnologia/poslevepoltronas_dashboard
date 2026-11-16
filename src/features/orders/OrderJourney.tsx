import { useState } from 'react'
import { Armchair, CalendarClock, CheckCircle2, ClipboardCheck, CreditCard, Images, PackageCheck, Truck, Undo2, X, type LucideIcon } from 'lucide-react'
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
export function OrderJourney({ order, couriers, onOpenMedia }: {
  order: Order; couriers: Pick<Courier, 'id' | 'name'>[]
  /** Abre as fotos e vídeos da entrega ou da retirada. */
  onOpenMedia?: (phase: 'DELIVERY' | 'PICKUP') => void
}) {
  const [opened, setOpened] = useState<number | null>(null)
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
          <button type="button" className="oj-node" onClick={() => setOpened(index)} aria-label={`Ver o que foi feito em ${step.label}`}
            title="Clique para ver o que foi feito"><Icon size={20} strokeWidth={2.2} />{current && <i className="oj-ring" aria-hidden="true" />}</button>
          <span className="oj-tag">{done ? 'Feito' : current ? 'Agora' : 'Próxima'}</span>
          <strong>{step.label}</strong>
          {event ? <small>{dateTimeLabel(event.at)}<br />por {actorLabel(event.actor, couriers)}</small>
            : step.planned ? <small className="planned">Previsto para<br />{weekdayDateLabel(step.planned)}</small>
              : <small>{done ? 'Concluída' : current ? 'Em andamento' : 'Ainda não'}</small>}
        </li>
      })}
    </ol>
    {opened !== null && <StepWindow order={order} couriers={couriers} steps={steps} index={opened} now={now}
      onOpenMedia={onOpenMedia} onClose={() => setOpened(null)} />}
  </section>
}

/** Janela de uma etapa: o que ela significa, quando aconteceu e tudo o que foi feito nela (pelo histórico). */
function StepWindow({ order, couriers, steps, index, now, onOpenMedia, onClose }: {
  order: Order; couriers: Pick<Courier, 'id' | 'name'>[]; steps: Step[]; index: number; now: number
  onOpenMedia?: (phase: 'DELIVERY' | 'PICKUP') => void; onClose: () => void
}) {
  const step = steps[index]
  const done = index < now
  const current = index === now
  const timeOf = (position: number) => {
    const event = order.history.find(item => steps[position].actions.includes(item.action))
    return event ? Date.parse(event.at) : null
  }
  // A etapa vai do fim da etapa anterior até o momento em que foi concluída (ou até agora, se é a atual).
  let start = -Infinity
  for (let position = index - 1; position >= 0; position--) {
    const time = timeOf(position)
    if (time !== null) { start = time; break }
  }
  const end = done ? timeOf(index) ?? Infinity : current ? Infinity : -Infinity
  const events = order.history.filter(event => {
    const time = Date.parse(event.at)
    return time > start && time <= end
  })
  const doneEvent = done ? order.history.find(event => step.actions.includes(event.action)) : undefined
  const media = step.key === 'DELIVERY_PENDING' ? 'DELIVERY' : step.key === 'PICKUP_PENDING' ? 'PICKUP' : null
  const Icon = step.icon
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`modal oj-window ${done ? 'done' : current ? 'current' : 'next'}`} role="dialog" aria-modal="true" aria-labelledby="oj-window-title">
      <header className="oj-window-head">
        <span className="oj-window-icon"><Icon size={24} /></span>
        <div><span className="oj-tag">{done ? 'Feito' : current ? 'Agora' : 'Próxima'} • etapa {index + 1} de {steps.length}</span>
          <h2 id="oj-window-title">{step.label}</h2><p>{step.hint}.</p></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
      </header>
      <div className="oj-window-facts">
        {doneEvent && <div><CheckCircle2 size={16} /><span>Concluída em <b>{dateTimeLabel(doneEvent.at)}</b> por <b>{actorLabel(doneEvent.actor, couriers)}</b></span></div>}
        {!done && step.planned && <div><CalendarClock size={16} /><span>Prevista para <b>{weekdayDateLabel(step.planned)}</b></span></div>}
        {current && <div><span className="oj-live" />Esta é a etapa em andamento agora.</div>}
      </div>
      <h3>O que foi feito</h3>
      {events.length === 0 ? <p className="oj-window-empty">{done || current ? 'Nada registrado nesta etapa.' : 'Esta etapa ainda não começou.'}</p>
        : <ol className="oj-window-list">{events.map((event, position) => {
          const kind = eventKind(event.action)
          return <li key={`${event.at}-${position}`} className={`kind-${kind}`}>
            <span className="oj-window-dot">{eventKinds[kind].emoji}</span>
            <div><strong>{eventLabel(event.action)}</strong>
              <small>{dateTimeLabel(event.at)} • por {actorLabel(event.actor, couriers)}</small>
              {event.note && <p>{event.note}</p>}</div>
          </li>
        })}</ol>}
      <div className="modal-actions">
        {media && (done || current) && onOpenMedia && <button type="button" className="button secondary" onClick={() => { onClose(); onOpenMedia(media) }}>
          <Images size={16} /> Ver fotos e vídeos</button>}
        <button type="button" className="button primary" onClick={onClose}>Fechar</button>
      </div>
    </section>
  </div>
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

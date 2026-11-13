import { timeLabel } from '../../utils/time'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronUp,
  Info, MapPin, Megaphone, MessageCircle, Phone, RefreshCw, Truck, X,
} from 'lucide-react'
import './order-detail.css'
import { api, ApiError, type Courier, type Order } from '../../api'
import {
  actorLabel, currency, dateLabel, dateTimeLabel, eventKind, eventKinds, eventLabel, orderStatusLabel, paymentName,
  statusFlow, statusLabels, usePolling, weekdayDateLabel,
} from '../../data/orders'
import { branchLabel, chairName } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { brazilPhoneDigits, displayPhone } from '../../utils/phone'
import { OrderEvidencePanel } from './OrderEvidencePanel'

type Props = { credentials: string; id: string; onBack: () => void }

type Notice = { tone: 'info' | 'warning' | 'danger'; text: string }

/** Avisos do momento do pedido, um por situação, no topo da página. */
function noticesOf(order: Order): Notice[] {
  const list: Notice[] = []
  const until = order.expiresAt ? dateTimeLabel(order.expiresAt) : null
  if (order.status === 'PAYMENT_REVIEW') list.push({ tone: 'danger', text: 'Não conseguimos receber o pagamento automaticamente. Confira a ocorrência e o recebimento no Asaas antes de orientar o cliente. A poltrona foi liberada, este pedido não está confirmado e não há devolução automática.' })
  if (order.id.startsWith('wa-contrato-')) list.push({ tone: 'info', text: 'Contrato enviado pelo WhatsApp e aguardando a assinatura da cliente. Entregador, fotos e problemas ficam disponíveis depois que ela assinar.' })
  else if (order.status === 'PENDING_CONTRACT') list.push({ tone: 'info', text: `Pedido ainda sem pagamento confirmado. Válido até ${until ?? 'o prazo da reserva'}; ao expirar, os dias bloqueados são liberados automaticamente.` })
  if (order.status === 'PENDING_PAYMENT' && !order.paymentMock) list.push({ tone: 'info', text: `Aguardando a confirmação do ${paymentName(order)} pelo Asaas. Reserva válida até ${until ?? 'o prazo informado'}.` })
  if (order.status === 'EXPIRED' || order.status === 'CANCELLED') list.push({ tone: 'info', text: `Pedido ${order.status === 'EXPIRED' ? 'expirado' : 'cancelado'}. A poltrona já está livre para outros aluguéis.` })
  return list
}

export function OrderDetailPage({ credentials, id, onBack }: Props) {
  const [order, setOrder] = useState<Order | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const [stockOpen, setStockOpen] = useState(false)
  const [newDelivery, setNewDelivery] = useState('')
  const [newPickup, setNewPickup] = useState('')
  const [stockStart, setStockStart] = useState('')
  const [stockEnd, setStockEnd] = useState('')
  const [stockNote, setStockNote] = useState('')
  const [pixNote, setPixNote] = useState('')
  const revision = useRef(0)

  const load = useCallback(async () => {
    const started = revision.current
    try {
      const fresh = await api.order(credentials, id)
      if (started !== revision.current) return
      setOrder(fresh)
      setMissing(false)
      setLoadError('')
    } catch (cause) {
      if (started !== revision.current) return
      if (cause instanceof ApiError && cause.status === 404) setMissing(true)
      else setLoadError(getMessage(cause))
    }
  }, [credentials, id])

  // Confirmações do entregador chegam pela API: o pedido aberto se atualiza sozinho.
  usePolling(load, 30_000)

  useEffect(() => {
    let active = true
    api.couriers(credentials).then(list => { if (active) setCouriers(list) }).catch(() => {})
    return () => { active = false }
  }, [credentials])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(''), 4000)
    return () => window.clearTimeout(timer)
  }, [saved])

  // Os campos de estoque começam com o intervalo atual do pedido.
  useEffect(() => {
    if (!order) return
    setStockStart(order.stockStart ?? '')
    setStockEnd(order.stockEnd ?? '')
  }, [order?.stockStart, order?.stockEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  async function perform(operation: () => Promise<Order>, message: string, after?: () => void) {
    setBusy(true)
    setError('')
    try {
      const changed = await operation()
      revision.current += 1
      setOrder(changed)
      setSaved(message)
      after?.()
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (missing) return <div className="od">
    <BackLink onBack={onBack} />
    <div className="panel empty-state"><h3>Pedido não encontrado</h3>
      <p>Este pedido não existe mais ou não está visível para a sua conta.</p></div>
  </div>
  if (!order) return <div className="od">
    <BackLink onBack={onBack} />
    <div className="panel empty-state" role={loadError ? 'alert' : 'status'}>
      <p>{loadError || 'Carregando pedido...'}</p>
      {loadError && <button className="button primary" onClick={() => void load()}>Tentar novamente</button>}
    </div>
  </div>

  const step = statusFlow.indexOf(order.status)
  const nextStatus = step >= 0 ? statusFlow[step + 1] : undefined
  const contractOnly = order.id.startsWith('wa-contrato-')
  const canExpand = order.source === 'CHECKOUT' && order.stockStart && order.stockEnd
    && !['EXPIRED', 'CANCELLED', 'COMPLETED', 'PAYMENT_REVIEW'].includes(order.status)
  const stockDiffers = order.stockStart && order.stockEnd && (order.stockStart !== order.start || order.stockEnd !== order.end)
  const departure = [...order.history].reverse().find(event => event.action === 'DELIVERY_DEPARTURE_NOTIFIED')
  const openIssues = order.issues.filter(issue => issue.status === 'OPEN')
  const issues = [...openIssues, ...order.issues.filter(issue => issue.status !== 'OPEN')]
  const courier = couriers.find(item => item.id === order.courierId)
  const phoneDigits = brazilPhoneDigits(order.customerPhone)
  const mapUrl = order.latitude != null && order.longitude != null
    ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.municipalityName} - ${order.municipalityUf}`)}`
  const stepLabel = (status: typeof statusFlow[number]) =>
    statusLabels[status]

  function advance() {
    if (!order || !nextStatus) return
    if (!window.confirm(`Avançar o pedido de ${order.customerName} para “${statusLabels[nextStatus]}”?`)) return
    void perform(() => api.changeOrderStatus(credentials, order.id, nextStatus, statusNote),
      `Pedido avançado para ${statusLabels[nextStatus].toLowerCase()}.`, () => setStatusNote(''))
  }

  /** Paga o pagamento de teste (Pix ou cartão) pelo sandbox do Asaas: o pedido é confirmado pelo webhook, como um real. */
  async function payTestPix() {
    if (!order) return
    setBusy(true)
    setError('')
    setPixNote('')
    try {
      await api.simulateOrderPix(credentials, order.id)
      await load()
      setPixNote('Pagamento enviado. O pedido muda de status assim que o Asaas avisar o recebimento.')
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function checkPix() {
    if (!order) return
    setBusy(true)
    setError('')
    setPixNote('')
    try {
      await api.checkOrderPix(credentials, order.id)
      await load()
      setPixNote('Consulta ao Asaas concluída. O status do pedido foi atualizado.')
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="od">
    <BackLink onBack={onBack} />

    <header className="od-header">
      <div className="od-header-main">
        <span className="eyebrow">PEDIDO • {chairName(order.chairCode, order.branchName).toUpperCase()}</span>
        <h1>{order.customerName}</h1>
        <p><MapPin size={14} /> {order.municipalityName}/{order.municipalityUf} • {branchLabel(order.branchName)}
          <span className="od-dot" aria-hidden="true">•</span> Entrada em {dateTimeLabel(order.createdAt)}</p>
      </div>
      <div className="od-header-side">
        <span className={`order-status od-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order)}</span>
        {openIssues.length > 0 && <span className="order-status status-issue_open od-status">
          {openIssues.length} {openIssues.length === 1 ? 'problema em aberto' : 'problemas em aberto'}</span>}
        <button className="icon-button" aria-label="Atualizar pedido" title="Atualizar pedido" onClick={() => void load()}>
          <RefreshCw size={17} /></button>
      </div>
    </header>

    {saved && <div className="toast od-toast" role="status"><Check size={18} />{saved}
      <button aria-label="Fechar mensagem" onClick={() => setSaved('')}><X size={16} /></button></div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {noticesOf(order).map(notice => <div key={notice.text} className={`od-notice ${notice.tone}`}>
      {notice.tone === 'danger' ? <AlertCircle size={18} /> : <Info size={18} />}<p>{notice.text}</p></div>)}

    {step >= 0 && <ol className="od-steps" aria-label={`Etapa ${step + 1} de ${statusFlow.length}: ${statusLabels[order.status]}`}>
      {statusFlow.map((status, index) => {
        const done = index < step || (index === step && status === 'COMPLETED')
        const current = index === step && !done
        return <li key={status} className={done ? 'done' : current ? 'current' : ''} aria-current={current ? 'step' : undefined}>
          <span className="od-step-dot">{done ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
          <span className="od-step-text"><strong>{stepLabel(status)}</strong>
            <small>{done ? 'Concluída' : current ? 'Etapa atual' : 'Próxima'}</small></span>
        </li>
      })}
    </ol>}

    <div className="od-layout">
      <div className="od-main">
        {nextStatus && !contractOnly && <section className="panel od-card od-next" aria-labelledby="od-next-title">
          <div className="od-card-head"><div>
            <span className="eyebrow">PRÓXIMO PASSO</span>
            <h2 id="od-next-title">Avançar para {statusLabels[nextStatus].toLowerCase()}</h2>
            <p>Quando “{stepLabel(order.status as typeof statusFlow[number]).toLowerCase()}” terminar, avance o pedido. O cliente e a equipe veem a nova etapa.</p>
          </div></div>
          <div className="od-next-form">
            <label className="order-field"><span>Observação <span className="optional">(opcional)</span></span>
              <input value={statusNote} onChange={event => setStatusNote(event.target.value)} maxLength={300}
                placeholder="Ex.: entrega reagendada com o cliente" /></label>
            <button className="button primary" disabled={busy} onClick={advance}>
              Avançar <ArrowRight size={16} /></button>
          </div>
        </section>}
        {order.status === 'COMPLETED' && <section className="panel od-card od-finished">
          <CheckCircle2 size={22} /><div><h2>Pedido concluído</h2><p>A poltrona já foi retirada e o aluguel está encerrado.</p></div>
        </section>}

        <section className="panel od-card" aria-labelledby="od-logistics-title">
          <div className="od-card-head"><h2 id="od-logistics-title"><Truck size={18} /> Entrega e retirada</h2></div>
          <div className="od-schedule">
            <div className="od-schedule-item delivery">
              <small>Entrega</small>
              <strong>{weekdayDateLabel(order.start)}</strong>
              <span>{order.deliveryTime ? timeLabel(order.deliveryTime) : 'Sem horário combinado'}</span>
            </div>
            <ArrowRight size={18} className="od-schedule-arrow" aria-hidden="true" />
            <div className="od-schedule-item pickup">
              <small>Retirada</small>
              <strong>{weekdayDateLabel(order.end)}</strong>
              <span>{order.pickupTime ? timeLabel(order.pickupTime) : 'Sem horário combinado'}</span>
            </div>
          </div>
          {stockDiffers && <p className="od-stock-note"><CalendarClock size={15} />
            Estoque bloqueado de {dateLabel(order.stockStart!)} a {dateLabel(order.stockEnd!)} (entrega antecipada ou retirada posterior).</p>}

          <div className="od-address">
            <div><small>Local de entrega</small>
              <strong>{order.address}</strong>
              <span>{order.municipalityName}/{order.municipalityUf} • {order.postalCode ? `CEP ${order.postalCode}` : 'sem CEP'}</span></div>
            {/* Com a localização do WhatsApp abre o ponto exato; sem ela, busca pelo endereço. */}
            <a className="order-map-button" target="_blank" rel="noopener noreferrer" href={mapUrl}><MapPin size={16} /> Abrir mapa</a>
          </div>

          {canExpand && <div className="od-collapse">
            <button type="button" className="od-collapse-toggle" aria-expanded={stockOpen} onClick={() => setStockOpen(value => !value)}>
              <span><strong>Entrega antecipada ou retirada posterior</strong>
                <small>Entrega {order.deliveryTime ? timeLabel(order.deliveryTime) : 'sem horário'} • Retirada {order.pickupTime ? timeLabel(order.pickupTime) : 'sem horário'}</small></span>
              {stockOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {stockOpen && <div className="od-collapse-body">
              <div className="order-form-grid">
                <label className="order-field">Novo horário de entrega
                  <input type="time" value={newDelivery} disabled={order.status === 'IN_USE' || order.status === 'PICKUP_PENDING'}
                    onChange={event => setNewDelivery(event.target.value)} /></label>
                <label className="order-field">Novo horário de retirada
                  <input type="time" value={newPickup} onChange={event => setNewPickup(event.target.value)} /></label>
              </div>
              <div><button className="button secondary" disabled={busy || (!newDelivery && !newPickup)}
                onClick={() => void perform(() => api.changeOrderSchedule(credentials, order.id, newDelivery || null, newPickup || null, ''),
                  'Horário atualizado.', () => { setNewDelivery(''); setNewPickup('') })}>
                Salvar horário</button></div>
              <div className="order-form-grid">
                <label className="order-field">Primeiro dia de estoque
                  <input type="date" value={stockStart} max={order.stockStart ?? undefined} onChange={event => setStockStart(event.target.value)} /></label>
                <label className="order-field">Último dia de estoque
                  <input type="date" value={stockEnd} min={order.stockEnd ?? undefined} onChange={event => setStockEnd(event.target.value)} /></label>
              </div>
              <label className="order-field"><span>Observação <span className="optional">(opcional)</span></span>
                <input value={stockNote} maxLength={300} onChange={event => setStockNote(event.target.value)}
                  placeholder="Ex.: entrega combinada um dia antes" /></label>
              <p className="order-muted">Os dias extras só são confirmados se a poltrona estiver livre.</p>
              <div><button className="button secondary" disabled={busy || !stockStart || !stockEnd
                || (stockStart === order.stockStart && stockEnd === order.stockEnd)}
                onClick={() => void perform(() => api.expandOrderStock(credentials, order.id, stockStart, stockEnd, stockNote),
                  'Intervalo de estoque atualizado.', () => { setStockNote(''); setStockOpen(false) })}>
                Confirmar intervalo</button></div>
            </div>}
          </div>}
        </section>

        {!contractOnly && <section className="panel od-card od-evidence">
          {departure && <div className="od-notice" role="note">
            <span className="od-notice-icon"><Megaphone size={16} /></span>
            <div><strong>Comunicado ao cliente</strong>
              <p>✓ Avisado pelo WhatsApp que a poltrona saiu para entrega em {dateTimeLabel(departure.at)}.</p></div>
          </div>}
          <OrderEvidencePanel key={`${order.id}:${order.status}`} credentials={credentials} orderId={order.id}
            status={order.status} couriers={couriers} />
        </section>}

        {!contractOnly && <section className="panel od-card" aria-labelledby="od-issues-title">
          <div className="od-card-head">
            <h2 id="od-issues-title"><AlertCircle size={18} /> Problemas
              {openIssues.length > 0 && <span className="od-count">{openIssues.length} em aberto</span>}
              {order.issues.length > 0 && openIssues.length === 0 && <span className="od-count resolved">todos resolvidos</span>}</h2>
            {!issueOpen && <button className="button secondary" onClick={() => setIssueOpen(true)}>Registrar problema</button>}
          </div>
          {issueOpen && <form className="od-issue-form" onSubmit={event => {
            event.preventDefault()
            void perform(() => api.openOrderIssue(credentials, order.id, issueTitle, issueDescription), 'Problema registrado.',
              () => { setIssueTitle(''); setIssueDescription(''); setIssueOpen(false) })
          }}>
            <label className="order-field">O que aconteceu?
              <input required maxLength={100} value={issueTitle} onChange={event => setIssueTitle(event.target.value)}
                placeholder="Ex.: Cliente ausente na entrega" autoFocus /></label>
            <label className="order-field">Detalhes
              <textarea required maxLength={1000} rows={3} value={issueDescription} onChange={event => setIssueDescription(event.target.value)}
                placeholder="Descreva o ocorrido para a equipe" /></label>
            <div className="od-actions">
              <button type="button" className="button secondary" disabled={busy} onClick={() => setIssueOpen(false)}>Cancelar</button>
              <button className="button primary" disabled={busy}>Registrar</button>
            </div>
          </form>}
          {issues.length === 0 && !issueOpen && <p className="order-muted">Nenhum problema registrado neste pedido.</p>}
          {issues.map(issue => <article key={issue.id} className={`od-issue${issue.status === 'OPEN' ? ' open' : ''}`}>
            <div className="od-issue-head"><strong>{issue.title}</strong>
              <span className={`order-status ${issue.status === 'OPEN' ? 'status-issue_open' : 'status-completed'}`}>
                {issue.status === 'OPEN' ? 'Em aberto' : 'Resolvido'}</span></div>
            <p>{issue.description}</p>
            <small>Aberto por {actorLabel(issue.openedBy, couriers)} em {dateTimeLabel(issue.openedAt)}</small>
            {issue.status === 'RESOLVED'
              ? <p className="od-resolution"><strong>Resolução:</strong> {issue.resolution}
                {issue.resolvedBy && <small> — {actorLabel(issue.resolvedBy, couriers)}{issue.resolvedAt ? `, ${dateTimeLabel(issue.resolvedAt)}` : ''}</small>}</p>
              : <form className="od-resolve" onSubmit={event => {
                event.preventDefault()
                void perform(() => api.resolveOrderIssue(credentials, order.id, issue.id, resolutions[issue.id] ?? ''), 'Problema resolvido.',
                  () => setResolutions(current => ({ ...current, [issue.id]: '' })))
              }}>
                <input aria-label={`Resolução de ${issue.title}`} required maxLength={1000} placeholder="Como foi resolvido?"
                  value={resolutions[issue.id] ?? ''} onChange={event => setResolutions(current => ({ ...current, [issue.id]: event.target.value }))} />
                <button className="button secondary" disabled={busy || !(resolutions[issue.id] ?? '').trim()}>Resolver</button>
              </form>}
          </article>)}
        </section>}
      </div>

      <aside className="od-side">
        <section className="panel od-card" aria-labelledby="od-customer-title">
          <h2 id="od-customer-title" className="od-side-title">Cliente</h2>
          <strong className="od-customer-name">{order.customerName}</strong>
          <div className="od-contact">
            <a className="od-contact-link" href={`tel:${phoneDigits}`}><Phone size={15} /> {displayPhone(order.customerPhone)}</a>
            <a className="od-contact-link whatsapp" href={`https://wa.me/55${phoneDigits}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={15} /> WhatsApp</a>
          </div>
        </section>

        <section className="panel od-card" aria-labelledby="od-rental-title">
          <h2 id="od-rental-title" className="od-side-title">Aluguel</h2>
          <dl className="od-facts">
            <div><dt>Período cobrado</dt><dd>{dateLabel(order.start)} a {dateLabel(order.end)}</dd></div>
            <div><dt>Poltrona</dt><dd>{chairName(order.chairCode, order.branchName)}</dd></div>
            <div><dt>Filial</dt><dd>{branchLabel(order.branchName)}</dd></div>
          </dl>
          <dl className="od-facts od-money">
            {order.source === 'CHECKOUT' && <div><dt>Aluguel</dt><dd>{currency(order.rentalCents)}</dd></div>}
            <div><dt>Frete</dt><dd>{order.freightCents ? currency(order.freightCents) : 'Grátis'}</dd></div>
            {order.source === 'CHECKOUT' && <div className="od-total"><dt>Total</dt><dd>{currency(order.totalCents)}</dd></div>}
          </dl>
          {order.status === 'PENDING_PAYMENT' && order.paymentSandbox && !order.paymentMock && <div className="od-sandbox admin-only">
            <button className="button primary" disabled={busy} onClick={() => void payTestPix()}>Pagar no Asaas</button>
            <button className="button secondary" disabled={busy} onClick={() => void checkPix()}>Consultar recebimento no Asaas</button>
            {pixNote && <p className="order-muted" role="status">{pixNote}</p>}
          </div>}
        </section>

        {!contractOnly && <section className="panel od-card" aria-labelledby="od-courier-title">
          <h2 id="od-courier-title" className="od-side-title">Entregador</h2>
          <select className="od-select admin-only" aria-label="Entregador do pedido" value={order.courierId ?? ''}
            disabled={busy || step < 0 || order.status === 'COMPLETED'}
            onChange={event => void perform(() => api.assignOrderCourier(credentials, order.id, event.target.value || null), 'Entregador atualizado.')}>
            <option value="">Ainda não atribuído</option>
            {couriers.filter(item => item.active || item.id === order.courierId).map(item =>
              <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inativo)'}</option>)}
          </select>
          <p className="partner-only od-courier-name">{courier?.name ?? 'Ainda não atribuído'}</p>
          {courier?.phone && <a className="od-contact-link" href={`tel:${brazilPhoneDigits(courier.phone)}`}>
            <Phone size={15} /> {displayPhone(courier.phone)}</a>}
          {step < 0 && <p className="order-muted">O entregador pode ser escolhido depois do pagamento confirmado.</p>}
        </section>}

        <section className="panel od-card" aria-labelledby="od-history-title">
          <h2 id="od-history-title" className="od-side-title">Linha do tempo</h2>
          {/* Legenda: cada cor é um tipo de acontecimento (as mesmas do app). */}
          <div className="od-tl-legend">{(['order', 'payment', 'delivery', 'problem', 'done'] as const).map(key =>
            <span key={key} className={`od-tl-chip kind-${key}`}>{eventKinds[key].emoji} {eventKinds[key].label}</span>)}</div>
          <ol className="od-timeline">
            {[...order.history].reverse().map((event, index) => {
              const kind = eventKind(event.action)
              return <li key={`${event.at}-${index}`} className={`kind-${kind}`}>
              <span className="od-timeline-dot" aria-hidden="true" />
              <div><em className="od-tl-kind">{eventKinds[kind].emoji} {eventKinds[kind].label}{index === 0 ? ' • agora' : ''}</em>
                <strong>{eventLabel(event.action)}</strong>
                <small>{dateTimeLabel(event.at)} • {actorLabel(event.actor, couriers)}</small>
                {event.note && <p>{event.note}</p>}</div>
            </li>
            })}
          </ol>
        </section>
      </aside>
    </div>
  </div>
}

function BackLink({ onBack }: { onBack: () => void }) {
  return <button type="button" className="od-back" onClick={onBack}><ArrowLeft size={16} /> Voltar para pedidos</button>
}

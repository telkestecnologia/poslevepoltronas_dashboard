import type { ReactNode } from 'react'
import { timeLabel } from '../../utils/time'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Ban, FileText, AlertCircle, ArrowLeft, ArrowRight, CalendarClock, Check, ChevronDown, ChevronUp, CheckCircle2, Info, MapPin, Megaphone, MessageCircle, Phone, RefreshCw, Truck, X, Images,
} from 'lucide-react'
import './order-detail.css'
import { api, ApiError, type Courier, type Order } from '../../api'
import {
  actorLabel, balanceCents, manualTagText, currency, dateLabel, dateTimeLabel, eventKind, eventKinds, eventLabel, isRealOrder, orderStatusLabel, paymentName,
  statusFlow, statusLabels, usePolling, weekdayDateLabel,
} from '../../data/orders'
import { branchLabel, chairName } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { brazilPhoneDigits, displayPhone } from '../../utils/phone'
import { OrderEvidencePanel } from './OrderEvidencePanel'
import { announceSaved } from '../../components/SavedToast'
import { EarlySchedule, InlineSchedule } from './EarlySchedule'
import { MediaCarousel } from './MediaCarousel'
import { AttendanceSteps } from './AttendanceSteps'
import { OrderHistoryFull, OrderJourney } from './OrderJourney'
import logoSymbol from '../../assets/logo-simbolo.png'
import leaves from '../../assets/folhas-logo.png'
import './ficha.css'
import { LeadOriginChip } from '../leads/LeadOriginChip'
import { ChairSwap, ContractFileCard, ManualPaymentsCard, OrderNoteCard } from './OrderExtras'
import { SaleDetailsCard } from './SaleDetailsCard'

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
  if (order.source === 'MANUAL') {
    list.push({ tone: 'info', text: 'Cadastrado à mão pela equipe: o contrato foi assinado fora do sistema.' })
    const due = balanceCents(order)
    if (due > 0) list.push({ tone: 'warning', text: `Falta receber ${currency(due)} deste cliente. Lance o pagamento em “Pagamentos” quando ele pagar.` })
  }
  if (order.status === 'EXPIRED' || order.status === 'CANCELLED') list.push({ tone: 'info', text: `Pedido ${order.status === 'EXPIRED' ? 'expirado' : 'cancelado'}. A poltrona já está livre para outros aluguéis.` })
  return list
}

export function OrderDetailPage({ credentials, id, onBack }: Props) {
  const [order, setOrder] = useState<Order | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [busy, setBusy] = useState(false)
  const [mediaPhase, setMediaPhase] = useState<'DELIVERY' | 'PICKUP' | null>(null)
  const [timelineAll, setTimelineAll] = useState(false)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [openPhase, setOpenPhase] = useState<'DEPARTURE' | 'DELIVERY' | 'PICKUP' | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const [pixNote, setPixNote] = useState('')
  // Fotos e vídeos de cada etapa: entrega e retirada só avançam com pelo menos um registro.
  const [evidenceCount, setEvidenceCount] = useState<{ DELIVERY: number | null; PICKUP: number | null }>({ DELIVERY: null, PICKUP: null })
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
    let active = true
    api.orderEvidence(credentials, id).then(list => {
      if (active) setEvidenceCount({ DELIVERY: list.filter(item => item.phase === 'DELIVERY').length, PICKUP: list.filter(item => item.phase === 'PICKUP').length })
    }).catch(() => {})
    return () => { active = false }
  }, [credentials, id, order?.status])

  // Confirmação de salvo no meio da tela.
  useEffect(() => { if (saved) announceSaved(saved) }, [saved])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(''), 4000)
    return () => window.clearTimeout(timer)
  }, [saved])


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
  // Sem foto ou vídeo da entrega (ou da retirada), o pedido não avança.
  const evidencePhase = order.status === 'DELIVERY_PENDING' ? 'DELIVERY' : order.status === 'PICKUP_PENDING' ? 'PICKUP' : null
  const missingEvidence = evidencePhase && evidenceCount[evidencePhase] === 0
    ? `Tire ou insira pelo menos uma foto ou vídeo da ${evidencePhase === 'DELIVERY' ? 'entrega' : 'retirada'} para avançar.` : ''
  const nextStatus = step >= 0 ? statusFlow[step + 1] : undefined
  const contractOnly = order.id.startsWith('wa-contrato-')
  const canChangeSchedule = isRealOrder(order) && !contractOnly
    && ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING'].includes(order.status)
  const stepLabel = (status: typeof statusFlow[number]) =>
    statusLabels[status]
  // Etapas na tela: as do pedido mais "Saindo para entrega" antes de "Aguardando entrega" (igual ao app).
  const displayRows = [
    { key: 'PAYMENT_CONFIRMED', label: stepLabel('PAYMENT_CONFIRMED') },
    { key: 'DEPARTURE', label: 'Saindo para entrega' },
    ...statusFlow.slice(1).map(status => ({ key: status, label: stepLabel(status) })),
  ]
  const displayStep = order.status === 'PAYMENT_CONFIRMED' ? 1 : displayRows.findIndex(row => row.key === order.status)
  // Ações de cada etapa, mostradas na janela da bolinha da jornada (no computador).
  function stepActions(key: string, { done }: { done: boolean; current: boolean }) {
    if (!order) return null
    const phase = key === 'DEPARTURE' ? 'DEPARTURE' : key === 'DELIVERY_PENDING' ? 'DELIVERY' : key === 'PICKUP_PENDING' ? 'PICKUP' : null
    const scheduleKind = phase === 'DEPARTURE' || phase === 'DELIVERY' ? 'delivery' : phase === 'PICKUP' ? 'pickup' : null
    const parts: ReactNode[] = []
    if (phase && step >= 0 && !contractOnly) {
      if (canChangeSchedule && scheduleKind && !done) parts.push(<div key="schedule" className="oj-action oj-schedule">
        <InlineSchedule order={order} kind={scheduleKind} busy={busy} onSave={saveSchedule} /></div>)
      if (phase === 'DEPARTURE') parts.push(<div key="departure" className="od-notice" role="note">
        <span className="od-notice-icon"><Megaphone size={16} /></span>
        <div><strong>Comunicado ao cliente</strong>
          <p>{departure ? `✓ Avisado pelo WhatsApp que a poltrona saiu para entrega em ${dateTimeLabel(departure.at)}.`
            : 'Avise pelo WhatsApp que a poltrona está a caminho. O cliente recebe o vídeo de como a poltrona funciona.'}</p>
          {!departure && <button type="button" className="button primary" disabled={busy} onClick={notifyDeparture}>
            <Megaphone size={16} /> Saindo para entrega</button>}</div>
      </div>)
      const evidenceStatus = phase === 'DELIVERY' ? 'DELIVERY_PENDING' : 'PICKUP_PENDING'
      if (phase !== 'DEPARTURE' && order.status === evidenceStatus) parts.push(<div key="evidence" className="oj-action">
        <h4>Fotos e vídeos {phase === 'DELIVERY' ? 'da entrega' : 'da retirada'}</h4>
        <OrderEvidencePanel key={`${order.id}:${order.status}:${phase}`} credentials={credentials} orderId={order.id}
          status={order.status} couriers={couriers} phase={phase}
          onCount={count => setEvidenceCount(current => current[phase] === count ? current : { ...current, [phase]: count })} /></div>)
    }
    // "Saindo para retirada": com a poltrona com o cliente (Em uso) ou aguardando a retirada.
    if ((key === 'IN_USE' || key === 'PICKUP_PENDING') && order.status === key && !contractOnly) parts.push(pickupNotice(`pickup-${key}`))
    return parts.length ? parts : null
  }
  function pickupNotice(id: string) {
    return <div key={id} className="od-notice" role="note">
      <span className="od-notice-icon"><Megaphone size={16} /></span>
      <div><strong>Comunicado ao cliente</strong>
        <p>{pickupDeparture ? `✓ Avisado pelo WhatsApp que o motorista estava indo buscar a poltrona em ${dateTimeLabel(pickupDeparture.at)}.`
          : 'Avise pelo WhatsApp que o motorista está indo buscar a poltrona.'}</p>
        {!pickupDeparture && <button type="button" className="button primary" disabled={busy} onClick={notifyPickup}>
          <Megaphone size={16} /> Saindo para retirada</button>}</div>
    </div>
  }
  function notifyDeparture() {
    if (!order || !window.confirm(`Avisar ${order.customerName} pelo WhatsApp que a poltrona saiu para entrega, com o vídeo de entrega?`)) return
    void perform(() => api.notifyDeliveryDeparture(credentials, order.id), 'Cliente avisado: a poltrona saiu para entrega.')
  }
  function notifyPickup() {
    if (!order || !window.confirm(`Avisar ${order.customerName} pelo WhatsApp que o motorista está indo buscar a poltrona?`)) return
    void perform(() => api.notifyPickupDeparture(credentials, order.id), 'Cliente avisado: o motorista está indo buscar a poltrona.')
  }
  /** Devolve a mensagem de erro (mostrada dentro da janela, que fica por cima da página) ou null se salvou. */
  // Card de problemas: na página e, no computador, dentro da janela da saída, da entrega e da retirada.
  function issuesCard(extra: string) {
    if (!order) return null
    return <section className={`panel od-card${extra}`} aria-labelledby={`od-issues-title${extra ? "-w" : ""}`}>
          <div className="od-card-head">
            <h2 id={`od-issues-title${extra ? "-w" : ""}`}><AlertCircle size={18} /> Encontrou algum problema?
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
        </section>
  }
  async function saveSchedule(changes: Parameters<typeof api.changeOrderSchedule>[2]) {
    setBusy(true)
    setError('')
    try {
      const changed = await api.changeOrderSchedule(credentials, order!.id, changes, '')
      revision.current += 1
      setOrder(changed)
      setSaved('Dia e horário atualizados.')
      return null
    } catch (cause) {
      return getMessage(cause)
    } finally {
      setBusy(false)
    }
  }
  const stockDiffers = order.stockStart && order.stockEnd && (order.stockStart !== order.start || order.stockEnd !== order.end)
  const departure = [...order.history].reverse().find(event => event.action === 'DELIVERY_DEPARTURE_NOTIFIED')
  const pickupDeparture = [...order.history].reverse().find(event => event.action === 'PICKUP_DEPARTURE_NOTIFIED')
  const openIssues = order.issues.filter(issue => issue.status === 'OPEN')
  const issues = [...openIssues, ...order.issues.filter(issue => issue.status !== 'OPEN')]
  const courier = couriers.find(item => item.id === order.courierId)
  const phoneDigits = brazilPhoneDigits(order.customerPhone)
  const mapUrl = order.latitude != null && order.longitude != null
    ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.municipalityName} - ${order.municipalityUf}`)}`

  function cancelManual() {
    if (!order) return
    const reason = window.prompt(`Cancelar o pedido de ${order.customerName}? A poltrona fica livre nesses dias. Motivo (opcional):`, '')
    if (reason === null) return
    void perform(() => api.cancelManualOrder(credentials, order.id, reason), 'Pedido cancelado. A poltrona está livre.')
  }

  function advance() {
    if (!order || !nextStatus) return
    if (missingEvidence) { setError(missingEvidence); return }
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

  return <div className={`od${order.source === 'MANUAL' ? ' od-manual' : ''}`}>
    <BackLink onBack={onBack} />
    {order.source === 'MANUAL' && <div className="od-manual-tag" role="note">⚠ {manualTagText(order.manualReason).toUpperCase()}</div>}

    <header className="od-header">
      <div className="od-header-main">
        <span className="eyebrow">PEDIDO • {chairName(order.chairCode, order.branchName).toUpperCase()}</span>
        <h1 className="od-name"><img src={logoSymbol} alt="" aria-hidden="true" />{order.customerName}</h1>
        <p><MapPin size={14} /> {order.municipalityName}/{order.municipalityUf} • {branchLabel(order.branchName)}
          <span className="od-dot" aria-hidden="true">•</span> Entrada em {dateTimeLabel(order.createdAt)}</p>
      </div>
      <div className="od-header-side">
        <span className={`order-status od-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order)}</span>
        {/* Ficha do cliente (igual ao app): tudo do pedido numa janela só. */}
        <button type="button" className="od-ficha-button" onClick={() => setFichaOpen(true)}><FileText size={16} /> Ficha do cliente</button>
        {openIssues.length > 0 && <span className="order-status status-issue_open od-status">
          {openIssues.length} {openIssues.length === 1 ? 'problema em aberto' : 'problemas em aberto'}</span>}
        <button className="icon-button" aria-label="Atualizar pedido" title="Atualizar pedido" onClick={() => void load()}>
          <RefreshCw size={17} /></button>
      </div>
    </header>
    {fichaOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFichaOpen(false) }}>
      {/* Ficha do cliente com cara de ficha de atendimento: papel claro, folhas da logo, campos sublinhados e a tabela do pedido. */}
      <section className="modal od-ficha" role="dialog" aria-modal="true" aria-label={`Ficha de ${order.customerName}`}>
        <img className="od-ficha-leaf top" src={leaves} alt="" aria-hidden="true" />
        <img className="od-ficha-leaf bottom" src={leaves} alt="" aria-hidden="true" />
        <button className="icon-button od-ficha-close" aria-label="Fechar" onClick={() => setFichaOpen(false)}><X size={20} /></button>
        <header className="od-ficha-title"><span>Ficha de</span><em>atendimento</em></header>
        <div className="od-ficha-fields">
          <p><b>Nome:</b><span>{order.customerName}</span></p>
          <p><b>Telefone:</b><span><a href={`tel:${phoneDigits}`}>{displayPhone(order.customerPhone)}</a>
            <a className="od-ficha-wa" href={`https://wa.me/55${phoneDigits}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a></span></p>
          <p><b>Endereço:</b><span>{order.address} • {order.municipalityName}/{order.municipalityUf}{order.postalCode ? ` • CEP ${order.postalCode}` : ''}
            <a className="od-ficha-map" target="_blank" rel="noopener noreferrer" href={mapUrl}><MapPin size={14} /> mapa</a></span></p>
          {order.internalNote && <p><b>Observação:</b><span>{order.internalNote}</span></p>}
          <p><b>Poltrona:</b><span>{chairName(order.chairCode, order.branchName)} • {branchLabel(order.branchName)}</span></p>
          <p><b>Situação:</b><span><i className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order)}</i>
            <small>pedido feito em {dateTimeLabel(order.createdAt)}</small></span></p>
        </div>
        <table className="od-ficha-table">
          <thead><tr><th>Data</th><th>Procedimento</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>{dateLabel(order.start)} a {dateLabel(order.end)}</td><td>Aluguel da poltrona</td>
              <td>{isRealOrder(order) ? currency(order.rentalCents) : '—'}</td></tr>
            <tr><td>{weekdayDateLabel(order.deliveryDate ?? order.start)}{order.deliveryTime ? ` ${timeLabel(order.deliveryTime)}` : ''}</td>
              <td>Entrega e instalação</td><td>{order.freightCents ? currency(order.freightCents) : 'Frete grátis'}</td></tr>
            <tr><td>{weekdayDateLabel(order.pickupDate ?? order.end)}{order.pickupTime ? ` ${timeLabel(order.pickupTime)}` : ''}</td>
              <td>Retirada da poltrona</td><td>—</td></tr>
            <tr><td /><td>Entregador: {courier?.name ?? 'ainda não atribuído'}</td><td /></tr>
          </tbody>
          {isRealOrder(order) && <tfoot><tr><td /><td>Total{balanceCents(order) > 0 ? ` (falta ${currency(balanceCents(order))})` : ''}</td>
            <td>{currency(order.totalCents)}</td></tr></tfoot>}
        </table>
        <footer className="od-ficha-foot">@poslevepoltronas</footer>
      </section>
    </div>}

    {error && <div className="form-error" role="alert">{error}</div>}
    {noticesOf(order).map(notice => <div key={notice.text} className={`od-notice ${notice.tone}`}>
      {notice.tone === 'danger' ? <AlertCircle size={18} /> : <Info size={18} />}<p>{notice.text}</p></div>)}

    {step >= 0 && <ol className="od-steps" aria-label={`Etapa ${displayStep + 1} de ${displayRows.length}`}>
      {displayRows.map((row, index) => {
        const done = index < displayStep || (index === displayStep && order.status === 'COMPLETED')
        const current = index === displayStep && !done
        return <li key={row.key} className={done ? 'done' : current ? 'current' : ''} aria-current={current ? 'step' : undefined}>
          <span className="od-step-dot">{done ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
          <span className="od-step-text"><strong>{row.label}</strong>
            <small>{done ? 'Concluída' : current ? 'Etapa atual' : 'Próxima'}</small></span>
        </li>
      })}
    </ol>}
    {/* No computador: a jornada inteira numa linha ligada (substitui as etapas acima). */}
    {step >= 0 && <OrderJourney order={order} couriers={couriers} onOpenMedia={setMediaPhase} renderActions={stepActions}
      advance={nextStatus && !contractOnly ? { label: 'Concluir etapa', blocked: missingEvidence, busy, run: advance } : null}
      renderSide={key => ['DEPARTURE', 'DELIVERY_PENDING', 'PICKUP_PENDING'].includes(key)
        ? <img className="oj-window-art" src="/entregador.webp" alt="Entregador da Pós Leve colocando a poltrona embalada na caminhonete" /> : null} />}
    {/* Sem pagamento confirmado não há pedido: só as etapas do atendimento, com o que aconteceu de fato. */}
    {step < 0 && <AttendanceSteps order={order} />}

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

        {/* Etapas da entrega e da retirada (igual ao app): dia e horário, antecipados ou posteriores, e as fotos e vídeos.
            Na etapa atual as fotos aparecem; nas que já passaram, ficam num botão que abre a janela com elas. */}
        {step >= 0 && !contractOnly && ([['DEPARTURE', 1], ['DELIVERY', 2], ['PICKUP', 4]] as const).map(([phase, index]) => {
          const passed = displayStep > index || order.status === 'COMPLETED'
          const current = displayStep === index && !passed
          const departureCard = phase === 'DEPARTURE'
          const media = phase === 'DELIVERY' || phase === 'PICKUP' ? phase : null
          const scheduleKind = departureCard ? 'delivery' : phase === 'PICKUP' ? 'pickup' : null
          const canEdit = canChangeSchedule && !!scheduleKind && !passed
          const hasContent = current || (departureCard && !passed)
          if (!passed && !current && !canEdit) return null
          const title = departureCard ? 'SAINDO PARA ENTREGA' : phase === 'DELIVERY' ? 'AGUARDANDO ENTREGA' : 'AGUARDANDO RETIRADA'
          const opened = hasContent && openPhase === phase
          const toggle = () => setOpenPhase(value => value === phase ? null : phase)
          return <section key={phase} className={`panel od-card od-evidence${current ? ' now' : ''}${current && !opened ? ' pulsing' : ''}${hasContent ? ' clickable' : ''}`}
            onClick={event => { if (hasContent && !(event.target as HTMLElement).closest('button, a, input, select, textarea, video, .od-evidence-body')) toggle() }}>
            <div className="od-step-head">
              <span className="eyebrow">ETAPA • {title}</span>
              <span className="od-step-actions">
                {canEdit && scheduleKind && <EarlySchedule order={order} kind={scheduleKind} busy={busy} current={current} onSave={saveSchedule} />}
                {passed && media && <button type="button" className="od-media-button" onClick={() => setMediaPhase(media)}>
                  <Images size={15} /> Ver fotos e vídeos</button>}
              </span>
            </div>
            {opened && <div className="od-evidence-body">
              {departureCard && <div className="od-notice" role="note">
                <span className="od-notice-icon"><Megaphone size={16} /></span>
                <div><strong>Comunicado ao cliente</strong>
                  <p>{departure ? `✓ Avisado pelo WhatsApp que a poltrona saiu para entrega em ${dateTimeLabel(departure.at)}.`
                    : 'Avise pelo WhatsApp que a poltrona está a caminho. O cliente recebe o vídeo de como a poltrona funciona.'}</p>
                  {!departure && <button type="button" className="button primary" disabled={busy} onClick={notifyDeparture}>
                    <Megaphone size={16} /> Saindo para entrega</button>}</div>
              </div>}
              {current && phase === 'PICKUP' && pickupNotice('pickup-card')}
              {current && media && <OrderEvidencePanel key={`${order.id}:${order.status}:${media}`} credentials={credentials} orderId={order.id}
                status={order.status} couriers={couriers} phase={media} />}
            </div>}
            {/* Setinha no canto inferior direito; clicar no card também abre e fecha (igual ao app). */}
            {hasContent && <button type="button" className={`od-corner-chevron${current ? ' now' : ''}`}
              aria-label={opened ? 'Fechar etapa' : 'Abrir etapa'} onClick={toggle}>
              {opened ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>}
          </section>
        })}
        {mediaPhase && <MediaCarousel credentials={credentials} orderId={order.id} phase={mediaPhase} couriers={couriers}
          customer={order.customerName} onClose={() => setMediaPhase(null)} />}
        {/* No computador: entrega e retirada contadas numa frase, com os dias e o local em destaque. */}
        <section className="od-logistics-statement" aria-label="Entrega e retirada">
          <small><Truck size={15} /> Entrega e retirada</small>
          <p>A poltrona chega <mark>{weekdayDateLabel(order.deliveryDate ?? order.start)}</mark>
            {order.deliveryTime ? <> <mark>{timeLabel(order.deliveryTime)}</mark></> : ' (sem horário combinado)'}
            {' '}em <mark>{order.municipalityName}/{order.municipalityUf}</mark> e volta <mark className="back">{weekdayDateLabel(order.pickupDate ?? order.end)}</mark>
            {order.pickupTime ? <> <mark className="back">{timeLabel(order.pickupTime)}</mark></> : ' (sem horário combinado)'}.</p>
          {stockDiffers && <em className="od-logistics-stock"><CalendarClock size={14} /> Estoque bloqueado de {dateLabel(order.stockStart!)} a {dateLabel(order.stockEnd!)}.</em>}
          <div className="od-logistics-where">
            <span><MapPin size={15} /> {order.address}{order.postalCode ? ` • CEP ${order.postalCode}` : ''}</span>
            <a target="_blank" rel="noopener noreferrer" href={mapUrl}><MapPin size={15} /> Abrir mapa</a>
          </div>
        </section>
        <section className="panel od-card od-logistics-card" aria-labelledby="od-logistics-title">
          <div className="od-card-head"><h2 id="od-logistics-title"><Truck size={18} /> Entrega e retirada</h2></div>
          <div className="od-schedule">
            <div className="od-schedule-item delivery">
              <small>Entrega</small>
              <strong>{weekdayDateLabel(order.deliveryDate ?? order.start)}</strong>
              <span>{order.deliveryTime ? timeLabel(order.deliveryTime) : 'Sem horário combinado'}</span>
            </div>
            <ArrowRight size={18} className="od-schedule-arrow" aria-hidden="true" />
            <div className="od-schedule-item pickup">
              <small>Retirada</small>
              <strong>{weekdayDateLabel(order.pickupDate ?? order.end)}</strong>
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

        </section>


        {!contractOnly && order.source !== 'MANUAL' && <OrderNoteCard credentials={credentials} order={order} busy={busy} perform={perform} />}
        {!contractOnly && issuesCard(' od-issues-main')}
        {/* No computador o histórico completo fica aqui, largo e agrupado por dia (substitui a linha do tempo lateral). */}
        <OrderHistoryFull order={order} couriers={couriers} />
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
          <LeadOriginChip credentials={credentials} phone={order.customerPhone} />
        </section>

        <section className="panel od-card" aria-labelledby="od-rental-title">
          <h2 id="od-rental-title" className="od-side-title">Aluguel</h2>
          <dl className="od-facts">
            <div><dt>Período cobrado</dt><dd>{dateLabel(order.start)} a {dateLabel(order.end)}</dd></div>
            <div><dt>Poltrona</dt><dd>{chairName(order.chairCode, order.branchName)}</dd></div>
            {isRealOrder(order) && !contractOnly && ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING'].includes(order.status) && <div className="od-chair-swap-row">
              <ChairSwap key={order.chairId} credentials={credentials} order={order} busy={busy} perform={perform} /></div>}
            <div><dt>Filial</dt><dd>{branchLabel(order.branchName)}</dd></div>
          </dl>
          <dl className="od-facts od-money">
            {isRealOrder(order) && <div><dt>Aluguel</dt><dd>{currency(order.rentalCents)}</dd></div>}
            <div><dt>Frete</dt><dd>{order.freightCents ? currency(order.freightCents) : 'Grátis'}</dd></div>
            {isRealOrder(order) && <div className="od-total"><dt>Total</dt><dd>{currency(order.totalCents)}
              {/* Ao lado do preço, a situação atual do cliente. */}
              <span className={`order-status od-price-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order)}</span></dd></div>}
          </dl>
          {order.status === 'PENDING_PAYMENT' && order.paymentSandbox && !order.paymentMock && <div className="od-sandbox admin-only">
            <button className="button primary" disabled={busy} onClick={() => void payTestPix()}>Pagar no Asaas</button>
            <button className="button secondary" disabled={busy} onClick={() => void checkPix()}>Consultar recebimento no Asaas</button>
            {pixNote && <p className="order-muted" role="status">{pixNote}</p>}
          </div>}
          {order.source === 'MANUAL' && !['CANCELLED', 'COMPLETED'].includes(order.status) && <button type="button"
            className="button secondary od-cancel-manual admin-only" disabled={busy} onClick={cancelManual}>
            <Ban size={15} /> Cancelar pedido</button>}
        </section>
        {order.source === 'MANUAL' && <ManualPaymentsCard credentials={credentials} order={order} busy={busy} perform={perform} />}
        {order.source === 'MANUAL' && <SaleDetailsCard key={order.id} credentials={credentials} order={order} />}
        {order.source === 'MANUAL' && <ContractFileCard credentials={credentials} order={order} />}
        {/* No pedido manual a observação fica logo abaixo do contrato assinado. */}
        {order.source === 'MANUAL' && <OrderNoteCard credentials={credentials} order={order} busy={busy} perform={perform} />}

        {!contractOnly && issuesCard(' od-issues-side')}
        {!contractOnly && <section className="panel od-card od-courier-card" aria-labelledby="od-courier-title">
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

        <section className="panel od-card od-history-side" aria-labelledby="od-history-title">
          {/* Só os acontecimentos mais recentes; a linha do tempo inteira, do início ao fim, aparece em "Ver tudo" (igual ao app). */}
          <div className="od-step-head">
            <h2 id="od-history-title" className="od-side-title">Linha do tempo</h2>
            {order.history.length > 3 && <button type="button" className="od-media-button" onClick={() => setTimelineAll(value => !value)}>
              {timelineAll ? 'Mostrar menos' : `Ver tudo (${order.history.length})`}</button>}
          </div>
          {timelineAll && <div className="od-tl-legend">{(['order', 'payment', 'delivery', 'problem', 'done'] as const).map(key =>
            <span key={key} className={`od-tl-chip kind-${key}`}>{eventKinds[key].emoji} {eventKinds[key].label}</span>)}</div>}
          <ol className="od-timeline">
            {[...order.history].reverse().slice(0, timelineAll ? undefined : 3).map((event, index) => {
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

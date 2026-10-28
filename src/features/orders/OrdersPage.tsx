import { useState } from 'react'
import { AlertCircle, ArrowRight, ClipboardList, RefreshCw, Search, X } from 'lucide-react'
import { type Courier, type Order, type OrderSource, type OrderStatus } from '../../api'
import { EmptyState } from '../../components/common'
import { getMessage } from '../../utils/errors'
import { formatPhone } from '../../utils/phone'
import { OrderEvidencePanel } from './OrderEvidencePanel'

type Props = {
  credentials: string
  orders: Order[]
  couriers: Courier[]
  status: OrderStatus | 'ALL'
  source: OrderSource | 'ALL'
  onStatusChange: (status: OrderStatus | 'ALL') => void
  onSourceChange: (source: OrderSource | 'ALL') => void
  onRefresh: () => Promise<void>
  onChangeStatus: (id: string, status: OrderStatus, note: string) => Promise<Order>
  onExpandStock: (id: string, stockStart: string, stockEnd: string, note: string) => Promise<Order>
  onAssignCourier: (id: string, courierId: string | null) => Promise<Order>
  onOpenIssue: (id: string, title: string, description: string) => Promise<Order>
  onResolveIssue: (id: string, issueId: string, resolution: string) => Promise<Order>
}

const labels: Record<OrderStatus, string> = {
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
const statusFlow: OrderStatus[] = [
  'PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING', 'COMPLETED',
]

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`))
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function freightLabel(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function eventLabel(action: string) {
  if (action.startsWith('STATUS_')) return labels[action.slice(7) as OrderStatus] ?? action
  if (action === 'CREATED') return 'Pedido criado'
  if (action === 'STOCK_EXPANDED') return 'Intervalo de estoque ampliado'
  if (action === 'EXPIRED') return 'Prazo encerrado'
  if (action === 'CANCELLED') return 'Pedido cancelado'
  if (action === 'COURIER_ASSIGNED') return 'Entregador alterado'
  if (action === 'ISSUE_OPENED') return 'Problema registrado'
  if (action === 'ISSUE_RESOLVED') return 'Problema resolvido'
  return action
}

export function OrdersPage({ credentials, orders, couriers, status, source, onStatusChange, onSourceChange,
  onRefresh, onChangeStatus, onExpandStock,
  onAssignCourier, onOpenIssue, onResolveIssue }: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const [stockStart, setStockStart] = useState('')
  const [stockEnd, setStockEnd] = useState('')
  const [stockNote, setStockNote] = useState('')
  const selected = orders.find(order => order.id === selectedId) ?? null
  const currentStep = selected ? statusFlow.indexOf(selected.status) : -1
  const followingStatus = currentStep >= 0 ? statusFlow[currentStep + 1] : undefined
  const canExpand = selected?.source === 'CHECKOUT' && selected.stockStart && selected.stockEnd
    && !['EXPIRED', 'CANCELLED', 'COMPLETED', 'PAYMENT_REVIEW'].includes(selected.status)
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const term = normalize(search.trim())
  const visible = orders.filter(order => (status === 'ALL' || order.status === status)
    && (source === 'ALL' || order.source === source)
    && normalize(`${order.customerName} ${order.customerPhone} ${order.chairCode} ${order.municipalityName} ${order.branchName}`)
      .includes(term))
  const sourceOrders = orders.filter(order => source === 'ALL' || order.source === source)
  const openIssues = sourceOrders.reduce((total, order) => total + order.issues.filter(issue => issue.status === 'OPEN').length, 0)

  async function perform(operation: () => Promise<Order>, after?: () => void) {
    setBusy(true)
    setError('')
    try {
      await operation()
      after?.()
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (!busy) {
      setSelectedId(null)
      setError('')
      setStatusNote('')
      setIssueTitle('')
      setIssueDescription('')
      setResolutions({})
    }
  }

  async function refresh() {
    setRefreshing(true)
    setError('')
    try {
      await onRefresh()
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setRefreshing(false)
    }
  }

  return <>
    <div className="page-heading with-action">
      <div><span className="eyebrow">OPERAÇÃO • PEDIDOS</span><h1>Gestão de pedidos</h1>
        <p>Acompanhe pedidos pendentes, entregas e problemas de cada aluguel.</p></div>
      <div className="order-heading-actions">
        <button className="button secondary" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw size={16} /> {refreshing ? 'Atualizando...' : 'Atualizar lista'}</button>
      </div>
    </div>
    {error && !selected && <div className="form-error order-page-error" role="alert">{error}</div>}
    <div className="order-summary">
      <div className="panel"><small>Aguardando contrato</small><strong>{sourceOrders.filter(order => order.status === 'PENDING_CONTRACT').length}</strong></div>
      <div className="panel"><small>Aguardando PIX</small><strong>{sourceOrders.filter(order => order.status === 'PENDING_PAYMENT').length}</strong></div>
      <div className="panel"><small>PIX em análise</small><strong>{sourceOrders.filter(order => order.status === 'PAYMENT_REVIEW').length}</strong></div>
      <div className="panel"><small>Pagamento confirmado</small><strong>{sourceOrders.filter(order => order.status === 'PAYMENT_CONFIRMED').length}</strong></div>
      <div className="panel"><small>Em operação</small><strong>{sourceOrders.filter(order =>
        ['DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING'].includes(order.status)).length}</strong></div>
      <div className="panel"><small>Problemas em aberto</small><strong>{openIssues}</strong></div>
    </div>
    <section className="panel table-panel">
      <div className="table-toolbar order-toolbar">
        <div className="search-field"><Search size={18} /><input aria-label="Buscar pedido"
          placeholder="Cliente, poltrona ou município" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="select-wrap"><select aria-label="Filtrar origem" value={source}
          onChange={event => onSourceChange(event.target.value as OrderSource | 'ALL')}>
          <option value="ALL">Todas as origens</option>
          <option value="CHECKOUT">Pedidos reais</option>
          <option value="MANUAL_PREVIEW">Demonstrações</option>
        </select></div>
        <div className="select-wrap"><select aria-label="Filtrar status" value={status}
          onChange={event => onStatusChange(event.target.value as OrderStatus | 'ALL')}>
          <option value="ALL">Todos os status</option>
          {Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></div>
      </div>
      {orders.length === 0 && source === 'ALL' && status === 'ALL' && !term
        ? <EmptyState icon={ClipboardList} title="Nenhum pedido registrado"
        text="Os pedidos do site aparecerão aqui após a reserva e o aceite do contrato." />
        : visible.length === 0 ? <EmptyState icon={Search} title="Nenhum pedido encontrado"
          text="Ajuste a busca ou o filtro de status." />
        : <div className="table-scroll"><table className="orders-table"><thead><tr>
          <th>CLIENTE</th><th>PERÍODO</th><th>POLTRONA</th><th>STATUS</th><th>PROBLEMAS</th><th><span className="sr-only">Ação</span></th>
        </tr></thead><tbody>{visible.map(order => <tr key={order.id}>
          <td><div className="courier-identity"><strong>{order.customerName}</strong>
            <small>{order.municipalityName} • {order.branchName}</small>
            {order.source === 'MANUAL_PREVIEW' && <small className="order-preview-label">Demonstração</small>}</div></td>
          <td>{dateLabel(order.start)} a {dateLabel(order.end)}</td>
          <td>{order.chairCode}</td>
          <td><span className={`order-status status-${order.status.toLowerCase()}`}>{labels[order.status]}</span></td>
          <td>{order.issues.filter(issue => issue.status === 'OPEN').length || '—'}</td>
          <td><button className="table-action" onClick={() => { setError(''); setStatusNote(''); setIssueTitle('');
            setIssueDescription(''); setResolutions({}); setStockStart(order.stockStart ?? '');
            setStockEnd(order.stockEnd ?? ''); setStockNote(''); setSelectedId(order.id) }}>
            Ver pedido <ArrowRight size={15} /></button></td>
        </tr>)}</tbody></table></div>}
    </section>

    {selected && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <section className="modal order-detail" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
        <div className="modal-head"><div><span className="eyebrow">PEDIDO • {selected.chairCode}</span>
          <h2 id="order-detail-title">{selected.customerName}</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={close} disabled={busy}><X size={20} /></button></div>
        <div className="order-detail-body">
          <div className="order-detail-top"><span className={`order-status status-${selected.status.toLowerCase()}`}>{labels[selected.status]}</span>
            <small>Entrada em {timeLabel(selected.createdAt)}</small></div>
          {currentStep >= 0 && <ol className="order-progress" aria-label="Etapas do pedido">
            {statusFlow.map((status, index) => <li key={status}
              className={index === currentStep ? 'current' : index < currentStep ? 'done' : ''}
              aria-current={index === currentStep ? 'step' : undefined}>
              <span className="order-progress-number">{index + 1}</span>
              <span>{labels[status]}</span>
            </li>)}
          </ol>}
          {selected.status === 'PENDING_CONTRACT' && <div className="order-preview-note">
            Pedido ainda sem pagamento confirmado. Válido até {selected.expiresAt ? timeLabel(selected.expiresAt) : 'o prazo da reserva'};
            ao expirar, os dias bloqueados são liberados automaticamente.
          </div>}
          {selected.status === 'PENDING_PAYMENT' && <div className="order-preview-note">
            Aguardando confirmação do PIX pelo Inter. Reserva válida até {selected.expiresAt ? timeLabel(selected.expiresAt) : 'o prazo informado'}.
          </div>}
          {selected.status === 'PAYMENT_REVIEW' && <div className="order-preview-note">
            Confira a ocorrência e o recebimento no Inter antes de orientar o cliente. A poltrona foi liberada; este pedido não está confirmado. Não há devolução automática.
          </div>}
          {selected.source === 'MANUAL_PREVIEW' && <div className="order-preview-note">
            Pedido de demonstração. O pagamento é apenas simulado; ele não reserva a poltrona nem altera a disponibilidade do site.
          </div>}
          <div className="order-facts">
            <div><small>Contato</small><strong>{formatPhone(selected.customerPhone)}</strong></div>
            <div><small>Período cobrado</small><strong>{dateLabel(selected.start)} a {dateLabel(selected.end)}</strong></div>
            {selected.stockStart && selected.stockEnd && <div><small>Estoque bloqueado</small>
              <strong>{dateLabel(selected.stockStart)} a {dateLabel(selected.stockEnd)}</strong></div>}
            <div><small>Local de entrega</small><strong>{selected.address}<br />{selected.municipalityName}/{selected.municipalityUf} • CEP {selected.postalCode}</strong></div>
            <div><small>Poltrona e filial</small><strong>{selected.chairCode} • {selected.branchName}</strong></div>
            <div><small>Frete registrado</small><strong>{freightLabel(selected.freightCents)}</strong></div>
            {selected.source === 'CHECKOUT' && <div><small>Total previsto</small><strong>{freightLabel(selected.totalCents)}</strong></div>}
          </div>
          {canExpand && <div className="order-section">
            <h3>Entrega antecipada ou retirada posterior</h3>
            <p className="order-muted">Os dias contratados e o preço não mudam. Dias extras só serão confirmados se a poltrona estiver livre.</p>
            <div className="order-form-grid">
              <label className="order-field">Primeiro dia de estoque
                <input type="date" value={stockStart} max={selected.stockStart ?? undefined}
                  onChange={event => setStockStart(event.target.value)} /></label>
              <label className="order-field">Último dia de estoque
                <input type="date" value={stockEnd} min={selected.stockEnd ?? undefined}
                  onChange={event => setStockEnd(event.target.value)} /></label>
            </div>
            <label className="order-field">Observação <span className="optional">(opcional)</span>
              <input value={stockNote} maxLength={300} onChange={event => setStockNote(event.target.value)}
                placeholder="Ex.: entrega combinada um dia antes" /></label>
            <div className="order-actions"><button className="button secondary" disabled={busy || !stockStart || !stockEnd
              || (stockStart === selected.stockStart && stockEnd === selected.stockEnd)}
              onClick={() => void perform(() => onExpandStock(selected.id, stockStart, stockEnd, stockNote),
                () => setStockNote(''))}>Confirmar intervalo logístico</button></div>
          </div>}
          <label className="order-field">Entregador
            <select value={selected.courierId ?? ''} disabled={busy || currentStep < 0 || selected.status === 'COMPLETED'}
              onChange={event => void perform(() => onAssignCourier(selected.id, event.target.value || null))}>
              <option value="">Ainda não atribuído</option>
              {couriers.filter(courier => courier.active || courier.id === selected.courierId).map(courier =>
                <option key={courier.id} value={courier.id}>{courier.name}{courier.active ? '' : ' (inativo)'}</option>)}
            </select>
          </label>
          <OrderEvidencePanel key={selected.id} credentials={credentials} orderId={selected.id}
            status={selected.status} couriers={couriers} />
          {followingStatus && <div className="order-section">
            <h3>Andamento</h3>
            <label className="order-field">Observação <span className="optional">(opcional)</span>
              <input value={statusNote} onChange={event => setStatusNote(event.target.value)} maxLength={300}
                placeholder="Ex.: entrega reagendada com o cliente" /></label>
            <div className="order-actions">
              <button className="button primary" disabled={busy}
                onClick={() => void perform(() => onChangeStatus(selected.id, followingStatus, statusNote),
                  () => setStatusNote(''))}>Avançar para {labels[followingStatus].toLowerCase()}</button>
            </div>
          </div>}
          <div className="order-section"><h3>Problemas</h3>
            {selected.issues.length === 0 && <p className="order-muted">Nenhum problema registrado.</p>}
            {selected.issues.map(issue => <div className="order-issue" key={issue.id}>
              <div><strong>{issue.title}</strong><span className={`order-status ${issue.status === 'OPEN' ? 'status-issue_open' : 'status-completed'}`}>
                {issue.status === 'OPEN' ? 'Em aberto' : 'Resolvido'}</span></div>
              <p>{issue.description}</p><small>Aberto por {issue.openedBy} em {timeLabel(issue.openedAt)}</small>
              {issue.status === 'RESOLVED' ? <p><strong>Resolução:</strong> {issue.resolution}</p>
                : <form onSubmit={event => { event.preventDefault(); void perform(() =>
                  onResolveIssue(selected.id, issue.id, resolutions[issue.id] ?? ''), () =>
                  setResolutions(current => ({ ...current, [issue.id]: '' }))) }}>
                  <input aria-label={`Resolução de ${issue.title}`} required maxLength={1000}
                    placeholder="Descreva como foi resolvido" value={resolutions[issue.id] ?? ''}
                    onChange={event => setResolutions(current => ({ ...current, [issue.id]: event.target.value }))} />
                  <button className="button secondary" disabled={busy}>Resolver</button>
                </form>}
            </div>)}
            <form className="order-issue-form" onSubmit={event => { event.preventDefault(); void perform(() =>
              onOpenIssue(selected.id, issueTitle, issueDescription), () => { setIssueTitle(''); setIssueDescription('') }) }}>
              <input required maxLength={100} placeholder="Título do problema" aria-label="Título do problema"
                value={issueTitle} onChange={event => setIssueTitle(event.target.value)} />
              <textarea required maxLength={1000} placeholder="Descreva o ocorrido" aria-label="Descrição do problema"
                value={issueDescription} onChange={event => setIssueDescription(event.target.value)} />
              <button className="button secondary" disabled={busy}><AlertCircle size={16} /> Registrar problema</button>
            </form>
          </div>
          <div className="order-section"><h3>Histórico</h3>
            <div className="order-history">{[...selected.history].reverse().map((event, index) =>
              <div key={`${event.at}-${index}`}><strong>{eventLabel(event.action)}</strong>
                <small>{timeLabel(event.at)} • {event.actor}</small>{event.note && <p>{event.note}</p>}</div>)}</div>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
      </section>
    </div>}
  </>
}


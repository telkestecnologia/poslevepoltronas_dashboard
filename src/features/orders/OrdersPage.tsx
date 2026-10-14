import { useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, ClipboardList, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import type { Branch, ChairOption, Courier, Order, OrderSource, OrderStatus, PreviewOrderInput } from '../../api'
import { EmptyState } from '../../components/common'
import { getMessage } from '../../utils/errors'
import { formatPhone } from '../../utils/phone'

type Props = {
  orders: Order[]
  couriers: Courier[]
  branches: Branch[]
  options: ChairOption[]
  status: OrderStatus | 'ALL'
  source: OrderSource | 'ALL'
  onStatusChange: (status: OrderStatus | 'ALL') => void
  onSourceChange: (source: OrderSource | 'ALL') => void
  onRefresh: () => Promise<void>
  onCreatePreview: (data: PreviewOrderInput) => Promise<Order>
  onDeletePreview: (id: string) => Promise<void>
  onChangeStatus: (id: string, status: OrderStatus, note: string) => Promise<Order>
  onAssignCourier: (id: string, courierId: string | null) => Promise<Order>
  onOpenIssue: (id: string, title: string, description: string) => Promise<Order>
  onResolveIssue: (id: string, issueId: string, resolution: string) => Promise<Order>
}

const labels: Record<OrderStatus, string> = {
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
  if (action === 'COURIER_ASSIGNED') return 'Entregador alterado'
  if (action === 'ISSUE_OPENED') return 'Problema registrado'
  if (action === 'ISSUE_RESOLVED') return 'Problema resolvido'
  return action
}

export function OrdersPage({ orders, couriers, branches, options, status, source, onStatusChange, onSourceChange,
  onRefresh, onCreatePreview, onDeletePreview, onChangeStatus,
  onAssignCourier, onOpenIssue, onResolveIssue }: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const selected = orders.find(order => order.id === selectedId) ?? null
  const currentStep = selected ? statusFlow.indexOf(selected.status) : -1
  const followingStatus = statusFlow[currentStep + 1]
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
      setCreating(false)
      setSelectedId(null)
      setError('')
      setStatusNote('')
      setIssueTitle('')
      setIssueDescription('')
      setResolutions({})
    }
  }

  async function removePreview(id: string) {
    if (!window.confirm('Remover este pedido de demonstração?')) return
    setBusy(true)
    setError('')
    try {
      await onDeletePreview(id)
      closeAfterDelete()
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  function closeAfterDelete() {
    setSelectedId(null)
    setStatusNote('')
    setIssueTitle('')
    setIssueDescription('')
    setResolutions({})
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
        <p>Acompanhe as entradas do checkout, a entrega e os problemas de cada aluguel.</p></div>
      <div className="order-heading-actions">
        <button className="button secondary" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw size={16} /> {refreshing ? 'Atualizando...' : 'Atualizar lista'}</button>
        <button className="button primary" onClick={() => { setError(''); setCreating(true) }}>
          <Plus size={16} /> Pedido de demonstração</button>
      </div>
    </div>
    {error && !selected && <div className="form-error order-page-error" role="alert">{error}</div>}
    <div className="order-summary">
      <div className="panel"><small>Pagamento confirmado</small><strong>{sourceOrders.filter(order => order.status === 'PAYMENT_CONFIRMED').length}</strong></div>
      <div className="panel"><small>Em andamento</small><strong>{sourceOrders.filter(order => order.status !== 'PAYMENT_CONFIRMED' && order.status !== 'COMPLETED').length}</strong></div>
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
        text="Crie um pedido de demonstração para visualizar a tela. Pedidos reais aparecerão quando o checkout for integrado."
        action={{ label: 'Criar demonstração', onClick: () => setCreating(true) }} />
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
            setIssueDescription(''); setResolutions({}); setSelectedId(order.id) }}>
            Ver pedido <ArrowRight size={15} /></button></td>
        </tr>)}</tbody></table></div>}
    </section>

    {creating && <CreatePreviewModal branches={branches} options={options} busy={busy} error={error}
      onClose={close} onSave={data => void perform(() => onCreatePreview(data), () => setCreating(false))} />}

    {selected && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <section className="modal order-detail" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
        <div className="modal-head"><div><span className="eyebrow">PEDIDO • {selected.chairCode}</span>
          <h2 id="order-detail-title">{selected.customerName}</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={close} disabled={busy}><X size={20} /></button></div>
        <div className="order-detail-body">
          <div className="order-detail-top"><span className={`order-status status-${selected.status.toLowerCase()}`}>{labels[selected.status]}</span>
            <small>Entrada em {timeLabel(selected.createdAt)}</small></div>
          <ol className="order-progress" aria-label="Etapas do pedido">
            {statusFlow.map((status, index) => <li key={status}
              className={index === currentStep ? 'current' : index < currentStep ? 'done' : ''}
              aria-current={index === currentStep ? 'step' : undefined}>
              <span className="order-progress-number">{index + 1}</span>
              <span>{labels[status]}</span>
            </li>)}
          </ol>
          {selected.source === 'MANUAL_PREVIEW' && <div className="order-preview-note">
            Pedido de demonstração. O pagamento é apenas simulado; ele não reserva a poltrona nem altera a disponibilidade do site.
          </div>}
          <div className="order-facts">
            <div><small>Contato</small><strong>{formatPhone(selected.customerPhone)}</strong></div>
            <div><small>Período</small><strong>{dateLabel(selected.start)} a {dateLabel(selected.end)}</strong></div>
            <div><small>Local de entrega</small><strong>{selected.address}<br />{selected.municipalityName}/{selected.municipalityUf} • CEP {selected.postalCode}</strong></div>
            <div><small>Poltrona e filial</small><strong>{selected.chairCode} • {selected.branchName}</strong></div>
            <div><small>Frete registrado</small><strong>{freightLabel(selected.freightCents)}</strong></div>
          </div>
          <label className="order-field">Entregador
            <select value={selected.courierId ?? ''} disabled={busy || selected.status === 'COMPLETED'}
              onChange={event => void perform(() => onAssignCourier(selected.id, event.target.value || null))}>
              <option value="">Ainda não atribuído</option>
              {couriers.filter(courier => courier.active || courier.id === selected.courierId).map(courier =>
                <option key={courier.id} value={courier.id}>{courier.name}{courier.active ? '' : ' (inativo)'}</option>)}
            </select>
          </label>
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
          {selected.source === 'MANUAL_PREVIEW' && <button className="button secondary order-delete" disabled={busy}
            onClick={() => void removePreview(selected.id)}><Trash2 size={15} /> Remover demonstração</button>}
        </div>
      </section>
    </div>}
  </>
}

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function CreatePreviewModal({ branches, options, busy, error, onClose, onSave }: {
  branches: Branch[]
  options: ChairOption[]
  busy: boolean
  error: string
  onClose: () => void
  onSave: (data: PreviewOrderInput) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [branchId, setBranchId] = useState('')
  const [municipalityCode, setMunicipalityCode] = useState('')
  const [chairId, setChairId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [localError, setLocalError] = useState('')
  const branch = branches.find(item => item.id === branchId)
  const activeBranches = branches.filter(item => item.active)
  const chairs = options.filter(item => item.branchId === branchId && item.status === 'ACTIVE')

  function submit(event: FormEvent) {
    event.preventDefault()
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      setLocalError('Informe um telefone com DDD.')
      return
    }
    if (postalCode.replace(/\D/g, '').length !== 8 || !municipalityCode || !chairId || !start || !end || end < start) {
      setLocalError('Confira o CEP, o município, a poltrona e o período.')
      return
    }
    setLocalError('')
    onSave({ customerName: name.trim(), customerPhone: phoneDigits,
      postalCode: postalCode.replace(/\D/g, ''), address: address.trim(),
      municipalityCode, chairId, start, end })
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal order-create" role="dialog" aria-modal="true" aria-labelledby="order-create-title">
      <div className="modal-head"><div><span className="eyebrow">PEDIDOS • DEMONSTRAÇÃO</span>
        <h2 id="order-create-title">Novo pedido de teste</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X size={20} /></button></div>
      <form className="modal-form" onSubmit={submit}>
        <p className="order-preview-note">Este cadastro serve para visualizar a gestão de pedidos. O pagamento é simulado e não há reserva de estoque.</p>
        <div className="order-form-grid">
          <label>Cliente<input required autoFocus maxLength={100} value={name}
            onChange={event => setName(event.target.value)} placeholder="Nome completo" /></label>
          <label>Celular com DDD<input required type="tel" inputMode="numeric" maxLength={15} value={phone}
            onChange={event => setPhone(formatPhone(event.target.value))} placeholder="(85) 99999-9999" /></label>
          <label>CEP<input required inputMode="numeric" maxLength={9} value={postalCode}
            onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 8)
              setPostalCode(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits) }}
            placeholder="00000-000" /></label>
          <label>Filial<select required value={branchId} onChange={event => {
            setBranchId(event.target.value); setMunicipalityCode(''); setChairId('') }}>
            <option value="">Selecione</option>
            {activeBranches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Município<select required value={municipalityCode} disabled={!branch} onChange={event => setMunicipalityCode(event.target.value)}>
            <option value="">Selecione</option>
            {branch?.municipalities.map(item => <option key={item.code} value={item.code}>{item.name}/{item.uf}</option>)}
          </select></label>
          <label>Poltrona<select required value={chairId} disabled={!branchId} onChange={event => setChairId(event.target.value)}>
            <option value="">Selecione</option>
            {chairs.map(item => <option key={item.id} value={item.id}>{item.code} • {item.model}</option>)}
          </select></label>
          <label>Início<input required type="date" min={todayLocal()} value={start} onChange={event => {
            setStart(event.target.value); if (end && end < event.target.value) setEnd('') }} /></label>
          <label>Fim<input required type="date" min={start || todayLocal()} value={end}
            onChange={event => setEnd(event.target.value)} /></label>
        </div>
        <label>Endereço completo<input required maxLength={300} value={address}
          onChange={event => setAddress(event.target.value)} placeholder="Rua, número, bairro e complemento" /></label>
        {activeBranches.length === 0 && <small className="field-help">Cadastre uma filial ativa e uma poltrona antes de criar a demonstração.</small>}
        {branchId && chairs.length === 0 && <small className="field-help">Esta filial não tem poltronas ativas.</small>}
        {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={busy || activeBranches.length === 0}>
            {busy ? 'Salvando...' : 'Criar demonstração'} <ArrowRight size={17} /></button></div>
      </form>
    </section>
  </div>
}


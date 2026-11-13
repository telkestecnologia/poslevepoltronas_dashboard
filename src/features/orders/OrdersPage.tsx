import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search, X, PenLine, Clock, SearchCheck, Truck, Armchair, Undo2, BadgeCheck, XCircle, TriangleAlert, type LucideIcon } from 'lucide-react'
import './orders.css'
import { api, type Branch, type Order, type OrderPage, type OrderQuery, type OrderStatus } from '../../api'
import { EmptyState } from '../../components/common'
import { dateLabel, orderStatusLabel, usePolling } from '../../data/orders'
import { replaceQuery } from '../../router'
import { branchLabel, onlyOfficialBranches, chairName } from '../../utils/branches'
import './orders-v2.css'
import { getMessage } from '../../utils/errors'

// Os mesmos cartões do app. Clicar em um filtra a lista (no servidor); clicar de novo limpa.
type Summary = { key: string; label: string; statuses?: OrderStatus[]; issues?: boolean; tone: string; icon: LucideIcon }
const summaries: Summary[] = [
  { key: 'contrato', label: 'Aguardando contrato', statuses: ['PENDING_CONTRACT'], tone: 'waiting', icon: PenLine },
  { key: 'pix', label: 'Aguardando pagamento', statuses: ['PENDING_PAYMENT'], tone: 'waiting', icon: Clock },
  { key: 'analise', label: 'Pagamento em análise', statuses: ['PAYMENT_REVIEW'], tone: 'danger', icon: SearchCheck },
  { key: 'entregar', label: 'Entregar', statuses: ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING'], tone: 'action', icon: Truck },
  { key: 'em-uso', label: 'Em uso', statuses: ['IN_USE'], tone: 'moving', icon: Armchair },
  { key: 'retirar', label: 'Retirar', statuses: ['PICKUP_PENDING'], tone: 'action', icon: Undo2 },
  { key: 'concluidos', label: 'Concluídos', statuses: ['COMPLETED'], tone: 'done', icon: BadgeCheck },
  { key: 'encerrados', label: 'Cancelados ou expirados', statuses: ['EXPIRED', 'CANCELLED'], tone: 'closed', icon: XCircle },
  { key: 'problemas', label: 'Problemas em aberto', issues: true, tone: 'danger', icon: TriangleAlert },
]

const PAGE_SIZE = 20
type Loaded = { key: string; page: number; items: Order[]; total: number; counts: OrderPage['counts']; openIssues: number }

const openIssuesOf = (order: Order) => order.issues.filter(issue => issue.status === 'OPEN').length

type Props = { credentials: string; params: URLSearchParams; onOpenOrder: (id: string) => void }

export function OrdersPage({ credentials, params, onOpenOrder }: Props) {
  // Filtros ficam na URL: ao voltar do pedido, a lista aparece igual.
  const summaryKey = params.get('resumo')
  const branchId = params.get('filial') ?? 'ALL'
  const cityCode = params.get('cidade') ?? 'ALL'
  const term = params.get('busca') ?? ''
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1 || 0)

  const [search, setSearch] = useState(term)
  const [branches, setBranches] = useState<Branch[]>([])
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const request = useRef(0)

  // Busca no servidor quando a pessoa para de digitar.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== term) replaceQuery({ busca: search.trim() || undefined, pagina: undefined })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, term])

  useEffect(() => {
    let active = true
    api.branches(credentials).then(list => { if (active) setBranches(list.filter(branch => branch.active)) }).catch(() => {})
    return () => { active = false }
  }, [credentials])

  const official = onlyOfficialBranches(branches, branch => branch.name)
  const branchOptions = official.length ? official : branches
  const selectedBranch = branchOptions.find(branch => branch.id === branchId)
  const cityOptions = [...(selectedBranch?.municipalities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const active = summaries.find(item => item.key === summaryKey)

  const key = JSON.stringify({
    search: term || undefined,
    branchId: branchId === 'ALL' ? undefined : branchId,
    municipalityCode: cityCode === 'ALL' ? undefined : cityCode,
    statuses: active?.statuses, openIssues: active?.issues,
  } satisfies OrderQuery)

  const load = useCallback(async () => {
    const id = ++request.current
    try {
      const result = await api.orderPage(credentials, JSON.parse(key) as OrderQuery, page, PAGE_SIZE)
      if (id !== request.current) return
      // A página pode deixar de existir quando pedidos saem do filtro.
      if (result.items.length === 0 && page > 0) {
        replaceQuery({ pagina: undefined })
        return
      }
      setData({ key, page, items: result.items, total: result.total, counts: result.counts, openIssues: result.openIssues })
      setError('')
    } catch (cause) {
      if (id === request.current) setError(getMessage(cause))
    }
  }, [credentials, key, page])

  usePolling(load, 30_000)

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function setFilter(values: Record<string, string | undefined>) {
    replaceQuery({ ...values, pagina: undefined })
  }

  const current = data && data.key === key && data.page === page ? data : null
  const stale = !current && data !== null
  const shown = current ?? data
  const total = shown?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const countOf = (item: Summary) => item.issues ? shown?.openIssues ?? 0
    : item.statuses!.reduce((sum, value) => sum + (shown?.counts[value] ?? 0), 0)
  const unfiltered = !term && branchId === 'ALL' && !active

  return <>
    <div className="page-heading with-action">
      <div><span className="eyebrow">OPERAÇÃO • PEDIDOS</span><h1>Gestão de pedidos</h1></div>
      <div className="order-heading-actions">
        <button className="button secondary" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw size={16} /> {refreshing ? 'Atualizando...' : 'Atualizar lista'}</button>
      </div>
    </div>
    {error && <div className="form-error order-page-error" role="alert">{error}</div>}

    <div className="order-summary" role="group" aria-label="Resumo dos pedidos">
      {summaries.map(item => {
        const selected = item.key === summaryKey
        const value = countOf(item)
        return <button type="button" key={item.key} aria-pressed={selected}
          className={`panel order-summary-card tone-${item.tone}${selected ? ' selected' : ''}${value === 0 ? ' zero' : ''}`}
          onClick={() => setFilter({ resumo: selected ? undefined : item.key })}>
          <span className="order-summary-top"><span className="order-summary-icon"><item.icon size={16} /></span>
            <strong>{shown ? value : '—'}</strong></span>
          <small>{item.label}</small>
        </button>
      })}
    </div>

    <section className="panel table-panel">
      <div className="table-toolbar order-toolbar">
        <div className="search-field"><Search size={18} /><input aria-label="Buscar pedido"
          placeholder="Cliente, telefone, poltrona ou município" value={search} onChange={event => setSearch(event.target.value)} />
          {search && <button type="button" className="icon-button order-search-clear" aria-label="Limpar busca"
            onClick={() => setSearch('')}><X size={15} /></button>}</div>
        <div className="select-wrap"><select aria-label="Filtrar filial" value={branchId}
          onChange={event => setFilter({ filial: event.target.value === 'ALL' ? undefined : event.target.value, cidade: undefined })}>
          <option value="ALL">Filiais atendidas</option>
          {branchOptions.map(branch => <option value={branch.id} key={branch.id}>{branchLabel(branch.name)}</option>)}
        </select></div>
        <div className="select-wrap"><select aria-label="Filtrar cidade" value={cityCode} disabled={!selectedBranch}
          onChange={event => setFilter({ cidade: event.target.value === 'ALL' ? undefined : event.target.value })}>
          <option value="ALL">{selectedBranch ? 'Todas as cidades da filial' : 'Escolha a filial para ver as cidades'}</option>
          {cityOptions.map(city => <option value={city.code} key={city.code}>{city.name}</option>)}
        </select></div>
        {active && <button type="button" className="order-filter-chip" onClick={() => setFilter({ resumo: undefined })}
          aria-label={`Limpar filtro ${active.label}`}>{active.label} ✕</button>}
      </div>

      {!shown ? <div className="empty-state" role="status"><p>{error ? 'Não foi possível carregar os pedidos.' : 'Carregando pedidos...'}</p></div>
        : shown.items.length === 0 ? (unfiltered
          ? <EmptyState icon={ClipboardList} title="Nenhum pedido registrado"
            text="Os pedidos do site aparecerão aqui após a reserva e o aceite do contrato." />
          : <EmptyState icon={Search} title="Nenhum pedido encontrado" text="Ajuste a busca, o resumo, a filial ou a cidade." />)
          : <div className={`table-scroll${stale ? ' is-stale' : ''}`} aria-busy={stale}><table className={`orders-table${active ? ` tinted tone-${active.tone}` : ''}`}><thead><tr>
            <th>CLIENTE</th><th>PERÍODO</th><th>POLTRONA</th><th>STATUS</th><th>PROBLEMAS</th><th><span className="sr-only">Ação</span></th>
          </tr></thead><tbody>{shown.items.map(order => {
            const issues = openIssuesOf(order)
            return <tr key={order.id} className="order-row" onClick={() => onOpenOrder(order.id)}>
              <td><div className="order-client"><span className={`order-avatar status-${order.status.toLowerCase()}`}>{order.customerName.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                <div className="courier-identity"><strong>{order.customerName}</strong>
                <small>{order.municipalityName} • {branchLabel(order.branchName)}</small></div></div></td>
              <td>{dateLabel(order.start)} a {dateLabel(order.end)}</td>
              <td>{chairName(order.chairCode, order.branchName)}</td>
              <td><span className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order)}</span></td>
              <td>{issues ? <span className="order-status status-issue_open">{issues} em aberto</span> : '—'}</td>
              <td><button className="table-action" onClick={event => { event.stopPropagation(); onOpenOrder(order.id) }}>
                Abrir pedido <ArrowRight size={15} /></button></td>
            </tr>
          })}</tbody></table></div>}

      {shown && total > 0 && <div className="order-pagination">
        <span>{total} {total === 1 ? 'pedido' : 'pedidos'}{active ? ` em “${active.label}”` : ''}</span>
        {pages > 1 && <div className="order-pagination-nav">
          <button type="button" className="icon-button" aria-label="Página anterior" disabled={page === 0}
            onClick={() => replaceQuery({ pagina: page > 1 ? String(page) : undefined })}><ChevronLeft size={18} /></button>
          <span>Página {page + 1} de {pages}</span>
          <button type="button" className="icon-button" aria-label="Próxima página" disabled={page + 1 >= pages}
            onClick={() => replaceQuery({ pagina: String(page + 2) })}><ChevronRight size={18} /></button>
        </div>}
      </div>}
    </section>
  </>
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { api, REAL_SOURCES, type Branch, type Chair, type ManualBlock, type Order, type OrderStatus } from '../../api'
import { fetchAllOrders, usePolling } from '../../data/orders'
import { branchLabel, chairName } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import './chair-occupancy.css'

// Pedidos que seguram a poltrona (mesma regra do Cadastro Manual) e os concluídos, para os dias que já passaram.
const HOLDING: OrderStatus[] = ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING', 'COMPLETED']
const WITH_CLIENT: OrderStatus[] = ['IN_USE', 'PICKUP_PENDING']
// Pedidos ainda em andamento (de hoje em diante), sem limite de data: dizem até quando a poltrona livre continua livre.
const ACTIVE: OrderStatus[] = ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING', 'AWAITING_NEW_DATE']
// Quantos dias antes do mês olhar para saber desde quando a poltrona está livre.
const LOOKBACK_DAYS = 120
const weekdayInitials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

type Busy = { start: string; end: string; label: string; orderId?: string }
/** Trecho da linha: dias seguidos no mesmo estado (livre, o mesmo aluguel, o mesmo bloqueio ou manutenção). */
/** period: o período inteiro do aluguel ou do bloqueio, mesmo quando passa do mês na tela (ex.: 25/11 a 15/12). */
type Segment = { from: number; length: number; free: boolean; label: string; orderId?: string; period?: string }
/** agendaBranchId: filial escolhida no topo da Agenda. admin: o administrador também escolhe a filial no próprio gráfico. */
type Props = { credentials: string; branches: Branch[]; agendaBranchId: string; admin: boolean; today: string; onOpenOrder: (id: string) => void }

/** Dias em que cada poltrona está ocupada: do estoque bloqueado (ou do aluguel) até a retirada, e os bloqueios manuais. */
export function busyByChair(orders: Order[], blocks: ManualBlock[], today: string) {
  const busy = new Map<string, Busy[]>()
  const add = (chairId: string, item: Busy) => busy.set(chairId, [...busy.get(chairId) ?? [], item])
  for (const order of orders) {
    // Aguardando a nova data: a poltrona fica ocupada pelo bloqueio da remarcação, não pelo período pago antes.
    if (order.status === 'AWAITING_NEW_DATE') {
      const hold = order.rescheduleHold
      if (hold) add(hold.chairId, { start: hold.start, end: hold.end, label: `Bloqueada p/ remarcação • ${order.customerName}`, orderId: order.id })
      continue
    }
    if (!order.chairId) continue
    const planned = order.stockEnd ?? order.end
    let end = order.pickupDate && order.pickupDate > planned ? order.pickupDate : planned
    // Retirada atrasada: a poltrona continua com a cliente até hoje.
    if (WITH_CLIENT.includes(order.status) && end < today) end = today
    add(order.chairId, { start: order.stockStart ?? order.start, end, label: `Alugada • ${order.customerName}`, orderId: order.id })
  }
  for (const block of blocks) add(block.chairId, { start: block.start, end: block.end, label: `Bloqueada • ${block.reason}` })
  return busy
}

/** Junta os dias seguidos no mesmo estado num trecho só da linha. */
function segmentsOf(days: string[], busy: Busy[], maintenance: boolean): Segment[] {
  const segments: Segment[] = []
  let last: Busy | null | undefined
  days.forEach((day, index) => {
    const found = maintenance ? null : busy.find(item => item.start <= day && day <= item.end) ?? null
    const previous = segments[segments.length - 1]
    if (previous && found === last) { previous.length += 1; return }
    last = found
    segments.push(maintenance ? { from: index, length: 1, free: false, label: 'Em manutenção' }
      : found ? { from: index, length: 1, free: false, label: found.label, orderId: found.orderId,
        period: found.start === found.end ? dayLabel(found.start) : `${dayLabel(found.start)} a ${dayLabel(found.end)}` }
      : { from: index, length: 1, free: true, label: 'Livre' })
  })
  // Trecho livre: o período inteiro, mesmo passando do mês (do dia depois do aluguel anterior ao dia antes do próximo).
  for (const segment of segments) {
    if (!segment.free) continue
    const first = days[segment.from]
    const lastDay = days[segment.from + segment.length - 1]
    const before = busy.filter(item => item.end < first).map(item => item.end).sort().pop()
    const after = busy.filter(item => item.start > lastDay).map(item => item.start).sort()[0]
    const start = before ? shiftDay(before, 1) : null
    const end = after ? shiftDay(after, -1) : null
    segment.period = start && end ? (start === end ? dayLabel(start) : `${dayLabel(start)} a ${dayLabel(end)}`)
      : start ? `a partir de ${dayLabel(start)}` : end ? `até ${dayLabel(end)}` : 'sem aluguel marcado'
  }
  return segments
}

function monthDays(month: string) {
  const [year, value] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}

function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7)
}

function shiftDay(iso: string, offset: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function dayLabel(iso: string) {
  return `${iso.slice(8)}/${iso.slice(5, 7)}`
}

/** Linha do tempo das poltronas no mês: verde = livre, vermelho = ocupada (alugada, bloqueada ou em manutenção). */
export function ChairOccupancy({ credentials, branches, agendaBranchId, admin, today, onOpenOrder }: Props) {
  // Filial do gráfico: segue o filtro do topo da Agenda até o administrador escolher outra aqui (trocar o do topo volta a
  // seguir). O parceiro só recebe do servidor as filiais dele.
  const [picked, setPicked] = useState<{ from: string; id: string } | null>(null)
  const branchId = admin && picked && picked.from === agendaBranchId ? picked.id : agendaBranchId
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [data, setData] = useState<{ key: string; days: string[]; chairs: Chair[]; orders: Order[]; blocks: ManualBlock[] } | null>(null)
  const [error, setError] = useState('')
  const request = useRef(0)
  const days = useMemo(() => monthDays(month), [month])
  const from = days[0]
  const to = days[days.length - 1]
  const key = JSON.stringify({ branchId, from, to })

  const load = useCallback(async () => {
    const id = ++request.current
    const branch = branchId === 'ALL' ? undefined : branchId
    try {
      const chairs: Chair[] = []
      for (let page = 0; page < 20; page += 1) {
        const result = await api.chairs(credentials, { page, size: 100, search: '', status: 'ALL', branchId })
        chairs.push(...result.items)
        if (result.items.length < 100 || chairs.length >= result.total) break
      }
      const [inRange, withClient, blocks] = await Promise.all([
        // O mês e alguns meses antes (para saber desde quando a poltrona livre está livre).
        fetchAllOrders(credentials, { source: REAL_SOURCES, statuses: HOLDING, branchId: branch, from: shiftDay(from, -LOOKBACK_DAYS), to }),
        // Pedidos em andamento de qualquer data: retiradas atrasadas e os próximos aluguéis depois do mês.
        fetchAllOrders(credentials, { source: REAL_SOURCES, statuses: ACTIVE, branchId: branch }),
        api.blocks(credentials),
      ])
      if (id !== request.current) return
      const orders = new Map([...inRange, ...withClient].map(order => [order.id, order]))
      setData({ key, days, chairs, orders: [...orders.values()], blocks })
      setError('')
    } catch (cause) {
      if (id === request.current) setError(getMessage(cause))
    }
  }, [credentials, branchId, from, to, key, days])

  usePolling(load, 30_000)

  // Trocando o mês (ou a filial), o gráfico anterior continua na tela, apagado, até o novo chegar: o cartão não
  // muda de tamanho e a página não pula para cima.
  const current = data
  const stale = !!data && data.key !== key
  const shownDays = current?.days ?? days
  const groups = useMemo(() => {
    if (!current) return []
    const busy = busyByChair(current.orders, current.blocks, today)
    return branches.filter(branch => branchId === 'ALL' || branch.id === branchId).map(branch => ({
      branch,
      rows: current.chairs.filter(chair => chair.branchId === branch.id && chair.status !== 'INACTIVE')
        .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
        .map(chair => ({ chair, name: chairName(chair.code, branch.name), segments: segmentsOf(current.days, busy.get(chair.id) ?? [], chair.status === 'MAINTENANCE') })),
    })).filter(group => group.rows.length > 0)
  }, [current, branches, branchId, today])

  const rows = groups.flatMap(group => group.rows)
  const freeOn = shownDays.map((_, index) => rows.filter(row => row.segments.some(segment => segment.free
    && segment.from <= index && index < segment.from + segment.length)).length)
  const todayIndex = shownDays.indexOf(today)
  // Marca de hoje: no meio da coluna do dia, em porcentagem da linha.
  const todayLeft = todayIndex >= 0 ? `${((todayIndex + 0.5) / shownDays.length) * 100}%` : null

  // Na tela pequena a linha rola para o lado: abre já perto de hoje.
  const scroller = useRef<HTMLDivElement>(null)
  const loaded = !!current
  useEffect(() => {
    const box = scroller.current
    if (!box || todayIndex < 0 || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft = Math.max(0, (box.scrollWidth * (todayIndex - 3)) / shownDays.length)
  }, [loaded, todayIndex, shownDays.length, current?.key])

  return <section className="panel occupancy" aria-label="Poltronas livres e ocupadas por dia">
    <div className="occupancy-heading">
      <div><span className="eyebrow">OCUPAÇÃO DAS POLTRONAS</span>
        <h2>Poltronas livres e ocupadas por dia</h2>
        <p>{todayIndex >= 0 && rows.length ? `Hoje: ${freeOn[todayIndex]} de ${rows.length} livres` : `${rows.length} poltronas`}{stale ? ' • carregando...' : ''}</p></div>
      <div className="occupancy-controls">
      {admin && <label className="order-pill occupancy-branch-pill"><span className="order-pill-icon"><Building2 size={15} /></span>
        <select aria-label="Filial do gráfico" value={branchId} onChange={event => setPicked({ from: agendaBranchId, id: event.target.value })}>
          <option value="ALL">Todas as filiais</option>
          {branches.map(item => <option key={item.id} value={item.id}>{branchLabel(item.name)}</option>)}
        </select></label>}
      <div className="occupancy-month" role="group" aria-label="Mês do gráfico">
        <button type="button" aria-label="Mês anterior" onClick={() => setMonth(value => shiftMonth(value, -1))}><ChevronLeft size={18} /></button>
        <strong>{monthFormatter.format(new Date(`${month}-01T12:00:00Z`))}</strong>
        <button type="button" aria-label="Próximo mês" onClick={() => setMonth(value => shiftMonth(value, 1))}><ChevronRight size={18} /></button>
        {month !== today.slice(0, 7) && <button type="button" className="occupancy-today" onClick={() => setMonth(today.slice(0, 7))}>Este mês</button>}
      </div>
      </div>
    </div>
    <div className="occupancy-legend"><span><i className="free" /> Livre</span><span><i className="busy" /> Ocupada</span></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!current ? (error ? null : <p className="occupancy-empty">Carregando poltronas...</p>)
      : rows.length === 0 ? <p className="occupancy-empty">Nenhuma poltrona nesta filial.</p>
      : <div className={`occupancy-chart${stale ? ' is-stale' : ''}`} aria-busy={stale} style={{ ['--days' as string]: shownDays.length }}>
        {/* Nomes fixos à esquerda; dias e linhas rolam juntos para o lado na tela pequena. */}
        <div className="occupancy-names">
          <span className="occupancy-axis-spacer" />
          {groups.map(group => <div key={group.branch.id}>
            {branchId === 'ALL' && <span className="occupancy-branch">{branchLabel(group.branch.name)}</span>}
            {group.rows.map(row => <span key={row.chair.id} className="occupancy-name">{row.name.replace('Poltrona ', '')}</span>)}
          </div>)}
          <span className="occupancy-name muted">Livres</span>
        </div>
        <div className="occupancy-scroll" ref={scroller}>
          <div className="occupancy-track">
            {todayLeft && <span className="occupancy-now" style={{ left: todayLeft }} aria-hidden="true" />}
            <div className="occupancy-axis">
              {shownDays.map(day => <span key={day} className={day === today ? 'today' : undefined}>
                <small>{weekdayInitials[new Date(`${day}T12:00:00Z`).getUTCDay()]}</small>{day.slice(8)}</span>)}
            </div>
            {groups.map(group => <div key={group.branch.id}>
              {branchId === 'ALL' && <span className="occupancy-branch-spacer" />}
              {group.rows.map(row => <div key={row.chair.id} className="occupancy-row">
                <div className="occupancy-line">
                  {row.segments.map(segment => {
                    const text = `${row.name} • ${segment.period ?? `${dayLabel(shownDays[segment.from])}${segment.length > 1 ? ` a ${dayLabel(shownDays[segment.from + segment.length - 1])}` : ''}`}: ${segment.label}`
                    const style = { width: `${(segment.length / shownDays.length) * 100}%` }
                    const className = `occupancy-segment ${segment.free ? 'free' : 'busy'}`
                    const orderId = segment.orderId
                    return orderId
                      ? <button type="button" key={segment.from} className={className} style={style} title={`${text} (clique para abrir o pedido)`}
                        aria-label={text} onClick={() => onOpenOrder(orderId)} />
                      : <span key={segment.from} className={className} style={style} title={text} aria-label={text} role="img" />
                  })}
                </div>
              </div>)}
            </div>)}
            <div className="occupancy-axis occupancy-free">
              {freeOn.map((count, index) => <span key={shownDays[index]}>{count}</span>)}
            </div>
          </div>
        </div>
      </div>}
    <p className="occupancy-note">Passe o mouse na linha para ver quem está com a poltrona; clique no vermelho para abrir o pedido. Vermelho também
      para bloqueio e manutenção. Pedidos sem pagamento confirmado não ocupam a poltrona.</p>
  </section>
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, REAL_SOURCES, type Branch, type Chair, type ManualBlock, type Order, type OrderStatus } from '../../api'
import { fetchAllOrders, usePolling } from '../../data/orders'
import { branchLabel, chairName } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import './chair-occupancy.css'

// Pedidos que seguram a poltrona (mesma regra do Cadastro Manual) e os concluídos, para os dias que já passaram.
const HOLDING: OrderStatus[] = ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING', 'COMPLETED']
const WITH_CLIENT: OrderStatus[] = ['IN_USE', 'PICKUP_PENDING']
const weekdayInitials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

type Busy = { start: string; end: string; label: string; orderId?: string }
type Cell = { busy: Busy | null; maintenance: boolean }
type Props = { credentials: string; branches: Branch[]; branchId: string; days: string[]; today: string; onOpenOrder: (id: string) => void }

/** Dias em que cada poltrona está ocupada: do estoque bloqueado (ou do aluguel) até a retirada, e os bloqueios manuais. */
export function busyByChair(orders: Order[], blocks: ManualBlock[], today: string) {
  const busy = new Map<string, Busy[]>()
  const add = (chairId: string, item: Busy) => busy.set(chairId, [...busy.get(chairId) ?? [], item])
  for (const order of orders) {
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

function dayLabel(iso: string) {
  return `${iso.slice(8)}/${iso.slice(5, 7)}`
}

/** Grade das poltronas por dia: verde = livre, vermelho = ocupada (alugada, bloqueada ou em manutenção). */
export function ChairOccupancy({ credentials, branches, branchId, days, today, onOpenOrder }: Props) {
  const [data, setData] = useState<{ key: string; chairs: Chair[]; orders: Order[]; blocks: ManualBlock[] } | null>(null)
  const [error, setError] = useState('')
  const request = useRef(0)
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
        fetchAllOrders(credentials, { source: REAL_SOURCES, statuses: HOLDING, branchId: branch, from, to }),
        // Retiradas atrasadas de antes do período também ocupam a poltrona hoje.
        fetchAllOrders(credentials, { source: REAL_SOURCES, statuses: WITH_CLIENT, branchId: branch }),
        api.blocks(credentials),
      ])
      if (id !== request.current) return
      const orders = new Map([...inRange, ...withClient].map(order => [order.id, order]))
      setData({ key, chairs, orders: [...orders.values()], blocks })
      setError('')
    } catch (cause) {
      if (id === request.current) setError(getMessage(cause))
    }
  }, [credentials, branchId, from, to, key])

  usePolling(load, 30_000)

  const current = data?.key === key ? data : null
  const groups = useMemo(() => {
    if (!current) return []
    const busy = busyByChair(current.orders, current.blocks, today)
    return branches.filter(branch => branchId === 'ALL' || branch.id === branchId).map(branch => ({
      branch,
      rows: current.chairs.filter(chair => chair.branchId === branch.id && chair.status !== 'INACTIVE')
        .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
        .map(chair => ({
          chair,
          cells: days.map((day): Cell => ({
            busy: (busy.get(chair.id) ?? []).find(item => item.start <= day && day <= item.end) ?? null,
            maintenance: chair.status === 'MAINTENANCE',
          })),
        })),
    })).filter(group => group.rows.length > 0)
  }, [current, branches, branchId, days, today])

  // Mês na tela pequena: a grade já abre rolada até hoje (a coluna das poltronas fica fixa à esquerda).
  const scroller = useRef<HTMLDivElement>(null)
  const loaded = !!current
  useEffect(() => {
    const box = scroller.current
    const column = box?.querySelector<HTMLElement>('thead th.today')
    const names = box?.querySelector<HTMLElement>('thead th.occupancy-chair')
    if (box && column && names) box.scrollLeft = Math.max(0, column.offsetLeft - names.offsetWidth - 2 * column.offsetWidth)
  }, [loaded, from, to])

  const rows = groups.flatMap(group => group.rows)
  const freeOn = days.map((_, index) => rows.filter(row => !row.cells[index].busy && !row.cells[index].maintenance).length)
  const todayIndex = days.indexOf(today)

  return <section className="panel occupancy" aria-label="Poltronas livres e ocupadas por dia">
    <div className="occupancy-heading">
      <div><span className="eyebrow">OCUPAÇÃO DAS POLTRONAS</span>
        <h2>Poltronas livres e ocupadas por dia</h2>
        <p>{dayLabel(from)} a {dayLabel(to)}{todayIndex >= 0 && rows.length ? ` • hoje: ${freeOn[todayIndex]} de ${rows.length} livres` : ''}</p></div>
      <div className="occupancy-legend"><span><i className="free" /> Livre</span><span><i className="busy" /> Ocupada</span></div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!current ? (error ? null : <p className="occupancy-empty">Carregando poltronas...</p>)
      : rows.length === 0 ? <p className="occupancy-empty">Nenhuma poltrona nesta filial.</p>
      : <div className="occupancy-scroll" ref={scroller}>
        <table className="occupancy-table">
          <thead><tr>
            <th scope="col" className="occupancy-chair">Poltrona</th>
            {days.map(day => <th scope="col" key={day} className={day === today ? 'today' : undefined}>
              <small>{weekdayInitials[new Date(`${day}T12:00:00Z`).getUTCDay()]}</small>{day.slice(8)}</th>)}
          </tr></thead>
          <tbody>
            {groups.map(group => [
              branchId === 'ALL' && <tr key={`b-${group.branch.id}`} className="occupancy-branch">
                <th scope="colgroup" colSpan={days.length + 1}>{branchLabel(group.branch.name)}</th></tr>,
              ...group.rows.map(row => {
                const name = chairName(row.chair.code, group.branch.name)
                return <tr key={row.chair.id}>
                  <th scope="row" className="occupancy-chair">{name.replace('Poltrona ', '')}</th>
                  {row.cells.map((cell, index) => {
                    const free = !cell.busy && !cell.maintenance
                    const text = `${name} • ${dayLabel(days[index])}: ${free ? 'Livre' : cell.busy?.label ?? 'Em manutenção'}`
                    const orderId = cell.busy?.orderId
                    return <td key={days[index]} className={days[index] === today ? 'today' : undefined}>
                      {orderId
                        ? <button type="button" className="occupancy-cell busy" title={`${text} (clique para abrir o pedido)`}
                          aria-label={text} onClick={() => onOpenOrder(orderId)} />
                        : <span className={`occupancy-cell ${free ? 'free' : 'busy'}`} title={text} aria-label={text} role="img" />}
                    </td>
                  })}
                </tr>
              }),
            ])}
          </tbody>
          <tfoot><tr>
            <th scope="row" className="occupancy-chair">Livres</th>
            {freeOn.map((count, index) => <td key={days[index]} className={days[index] === today ? 'today' : undefined}>{count}</td>)}
          </tr></tfoot>
        </table>
      </div>}
    <p className="occupancy-note">Passe o mouse num dia para ver quem está com a poltrona; clique no vermelho para abrir o pedido. Vermelho também
      para bloqueio e manutenção. Pedidos sem pagamento confirmado não ocupam a poltrona.</p>
  </section>
}

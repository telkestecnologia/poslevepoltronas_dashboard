import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import type { Branch, Courier, Order, OrderStatus } from '../../api'
import { getMessage } from '../../utils/errors'
import { formatPhone } from '../../utils/phone'

type Kind = 'delivery' | 'pickup'
type View = 'week' | 'month'
type AgendaItem = { key: string; kind: Kind; date: string; time: string | null; done: boolean; order: Order }
type Props = { orders: Order[]; couriers: Courier[]; branches: Branch[]; onRefresh: () => Promise<void> }

const operationalStatuses = new Set<OrderStatus>([
  'PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING', 'COMPLETED',
])
const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' })
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })

function todayInFortaleza() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
}

function dateFromIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function changeMonth(iso: string, offset: number) {
  const current = dateFromIso(iso)
  const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return isoDate(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(current.getUTCDate(), lastDay))
}

function changeWeek(iso: string, offset: number) {
  const next = dateFromIso(iso)
  next.setUTCDate(next.getUTCDate() + offset * 7)
  return next.toISOString().slice(0, 10)
}

function cityLabel(order: Order) {
  return `${order.municipalityName}/${order.municipalityUf}`
}

function itemStatus(item: AgendaItem, today: string) {
  if (item.done) return 'Concluída'
  if (item.date < today) return 'Data prevista passou'
  if (item.kind === 'delivery') return item.order.status === 'PAYMENT_CONFIRMED' ? 'A preparar' : 'Aguardando entrega'
  return item.order.status === 'PICKUP_PENDING' ? 'Aguardando retirada' : 'Prevista'
}

export function AgendaPage({ orders, couriers, branches, onRefresh }: Props) {
  const [selectedDate, setSelectedDate] = useState(todayInFortaleza)
  const [view, setView] = useState<View>('week')
  const [city, setCity] = useState('ALL')
  const [branch, setBranch] = useState('ALL')
  const [courier, setCourier] = useState('ALL')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const today = todayInFortaleza()

  const realOrders = useMemo(() => orders.filter(order => order.source === 'CHECKOUT'
    && operationalStatuses.has(order.status)), [orders])
  const sortedBranches = useMemo(() => [...branches].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [branches])
  const selectedBranch = branches.find(item => item.id === branch)
  const cities = useMemo(() => [...(selectedBranch?.municipalities ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [selectedBranch])
  const courierNames = useMemo(() => new Map(couriers.map(item => [item.id, item.name])), [couriers])

  const items = useMemo(() => realOrders
    .filter(order => (city === 'ALL' || order.municipalityCode === city)
      && (branch === 'ALL' || order.branchId === branch)
      && (courier === 'ALL' || (courier === 'UNASSIGNED' ? !order.courierId : order.courierId === courier)))
    .flatMap((order): AgendaItem[] => [
      {
        key: `${order.id}:delivery`, kind: 'delivery', date: order.start, time: order.deliveryTime,
        done: ['IN_USE', 'PICKUP_PENDING', 'COMPLETED'].includes(order.status), order,
      },
      {
        key: `${order.id}:pickup`, kind: 'pickup', date: order.end, time: order.pickupTime,
        done: order.status === 'COMPLETED', order,
      },
    ]), [realOrders, city, branch, courier])

  const [year, month] = selectedDate.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const selectedDay = dateFromIso(selectedDate)
  const weekStart = new Date(selectedDay)
  weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  const cells = view === 'week'
    ? Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setUTCDate(date.getUTCDate() + index)
      return date.toISOString().slice(0, 10)
    })
    : Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
      const day = index - firstWeekday + 1
      return day > 0 && day <= daysInMonth ? isoDate(year, month, day) : null
    })
  const counts = new Map<string, { deliveries: number; pickups: number }>()
  for (const item of items) {
    const count = counts.get(item.date) ?? { deliveries: 0, pickups: 0 }
    if (item.kind === 'delivery') count.deliveries += 1
    else count.pickups += 1
    counts.set(item.date, count)
  }

  const selectedItems = items.filter(item => item.date === selectedDate)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
      || cityLabel(a.order).localeCompare(cityLabel(b.order), 'pt-BR')
      || a.order.customerName.localeCompare(b.order.customerName, 'pt-BR'))
  const grouped = [...new Map(selectedItems.map(item => [item.order.municipalityCode, cityLabel(item.order)]))]
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
    .map(([code, label]) => ({ code, label, items: selectedItems.filter(item => item.order.municipalityCode === code) }))
  const deliveryCount = selectedItems.filter(item => item.kind === 'delivery').length
  const pickupCount = selectedItems.length - deliveryCount
  const unassignedCount = selectedItems.filter(item => !item.done && !item.order.courierId).length

  async function refresh() {
    setRefreshing(true)
    setError('')
    try { await onRefresh() }
    catch (cause) { setError(getMessage(cause)) }
    finally { setRefreshing(false) }
  }

  return <>
    <div className="page-heading with-action">
      <div><span className="eyebrow">OPERAÇÃO • AGENDA</span><h1>Agenda de entregas e retiradas</h1>
        <p>Acompanhe os serviços previstos e veja quais acontecem na mesma cidade.</p></div>
      <button className="button secondary" disabled={refreshing} onClick={() => void refresh()}>
        <RefreshCw size={16} /> {refreshing ? 'Atualizando...' : 'Atualizar agenda'}</button>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <p className="agenda-explanation panel">As datas e os horários vêm dos pedidos. Dias extras de estoque bloqueado não alteram esta agenda. Pedidos sem pagamento confirmado e demonstrações não aparecem.</p>

    <div className="agenda-filters panel" role="group" aria-label="Filtros da agenda">
      <label>Filial
        <select value={branch} onChange={event => { setBranch(event.target.value); setCity('ALL') }}>
          <option value="ALL">Todas as filiais</option>
          {sortedBranches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Cidade da filial
        <select value={city} disabled={!selectedBranch} onChange={event => setCity(event.target.value)}>
          <option value="ALL">{selectedBranch ? 'Todas as cidades da filial' : 'Selecione uma filial'}</option>
          {cities.map(item => <option key={item.code} value={item.code}>{item.name}/{item.uf}</option>)}
        </select>
      </label>
      <label>Entregador
        <select value={courier} onChange={event => setCourier(event.target.value)}>
          <option value="ALL">Todos os entregadores</option>
          <option value="UNASSIGNED">Sem entregador</option>
          {couriers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>

    <div className="agenda-layout">
      <section className="agenda-calendar panel" aria-label="Calendário de serviços">
        <div className="agenda-calendar-heading">
          <div><span className="eyebrow">SERVIÇOS PREVISTOS</span>
            <h2>{view === 'week'
              ? `Semana de ${shortFormatter.format(weekStart)} a ${shortFormatter.format(weekEnd)}`
              : monthFormatter.format(monthStart)}</h2></div>
          <div className="agenda-calendar-nav">
            <button type="button" onClick={() => setSelectedDate(today)}>Hoje</button>
            <button type="button" aria-label={view === 'week' ? 'Semana anterior' : 'Mês anterior'}
              onClick={() => setSelectedDate(date => view === 'week' ? changeWeek(date, -1) : changeMonth(date, -1))}><ChevronLeft size={18} /></button>
            <button type="button" aria-label={view === 'week' ? 'Próxima semana' : 'Próximo mês'}
              onClick={() => setSelectedDate(date => view === 'week' ? changeWeek(date, 1) : changeMonth(date, 1))}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="agenda-view-switch" role="group" aria-label="Visualização da agenda">
          <button type="button" aria-pressed={view === 'week'} className={view === 'week' ? 'selected' : ''}
            onClick={() => setView('week')}>Semana</button>
          <button type="button" aria-pressed={view === 'month'} className={view === 'month' ? 'selected' : ''}
            onClick={() => setView('month')}>Mês</button>
        </div>
        <div className="agenda-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className="agenda-calendar-grid">
          {cells.map((date, index) => {
            if (!date) return <span className="agenda-calendar-blank" key={`blank-${index}`} />
            const count = counts.get(date)
            return <button key={date} type="button" className={`agenda-calendar-day${date === selectedDate ? ' selected' : ''}${date === today ? ' today' : ''}`}
              aria-label={`${dayFormatter.format(dateFromIso(date))}: ${count?.deliveries ?? 0} entregas e ${count?.pickups ?? 0} retiradas`}
              aria-pressed={date === selectedDate} aria-current={date === today ? 'date' : undefined}
              onClick={() => setSelectedDate(date)}>
              <span className="agenda-calendar-number">{view === 'week' ? `${date.slice(8)}/${date.slice(5, 7)}` : Number(date.slice(-2))}</span>
              <span className="agenda-calendar-counts" aria-hidden="true">
                {!!count?.deliveries && <span className="agenda-count delivery">E {count.deliveries}</span>}
                {!!count?.pickups && <span className="agenda-count pickup">R {count.pickups}</span>}
              </span>
            </button>
          })}
        </div>
        <div className="agenda-legend"><span><i className="delivery" /> Entrega</span><span><i className="pickup" /> Retirada</span></div>
      </section>

      <section className="agenda-day-panel panel" aria-label="Serviços do dia selecionado">
        <div className="agenda-day-heading">
          <span className="eyebrow">DIA SELECIONADO</span>
          <h2>{dayFormatter.format(dateFromIso(selectedDate))}</h2>
          <p>{selectedItems.length} {selectedItems.length === 1 ? 'serviço previsto' : 'serviços previstos'}
            {grouped.length > 0 ? ` em ${grouped.length} ${grouped.length === 1 ? 'cidade' : 'cidades'}` : ''}</p>
        </div>
        <div className="agenda-day-summary">
          <span><strong>{deliveryCount}</strong> {deliveryCount === 1 ? 'entrega' : 'entregas'}</span>
          <span><strong>{pickupCount}</strong> {pickupCount === 1 ? 'retirada' : 'retiradas'}</span>
          {unassignedCount > 0 && <span className="needs-courier"><strong>{unassignedCount}</strong> sem entregador</span>}
        </div>
        {grouped.length === 0 ? <div className="agenda-empty">Nenhum serviço previsto para este dia com os filtros atuais.</div>
          : grouped.map(group => <div className="agenda-city-group" key={group.code}>
            <div className="agenda-city-heading"><h3>{group.label}</h3><span>{group.items.length} {group.items.length === 1 ? 'serviço' : 'serviços'}</span></div>
            {group.items.map(item => <article className={`agenda-item ${item.kind}`} key={item.key}>
              <div className="agenda-item-top">
                <span className={`agenda-kind ${item.kind}`}>{item.kind === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                <strong>{item.time || 'Sem horário'}</strong>
                <span className={`agenda-item-status${!item.done && item.date < today ? ' past' : ''}`}>
                  {itemStatus(item, today)}</span>
              </div>
              <h4>{item.order.customerName}</h4>
              <p>{item.order.chairCode} • {item.order.branchName}</p>
              <p>{item.order.address}, {group.label}</p>
              <div className="agenda-item-footer">
                <span>{item.order.courierId ? courierNames.get(item.order.courierId) ?? 'Entregador não encontrado' : 'Sem entregador'}</span>
                <a href={`tel:${item.order.customerPhone.replace(/\D/g, '')}`}>{formatPhone(item.order.customerPhone)}</a>
              </div>
              {(item.order.stockStart && item.order.stockStart !== item.order.start)
                || (item.order.stockEnd && item.order.stockEnd !== item.order.end)
                ? <small className="agenda-stock-note">Estoque bloqueado de {shortFormatter.format(dateFromIso(item.order.stockStart ?? item.order.start))} a {shortFormatter.format(dateFromIso(item.order.stockEnd ?? item.order.end))}</small>
                : null}
            </article>)}
          </div>)}
      </section>
    </div>
  </>
}

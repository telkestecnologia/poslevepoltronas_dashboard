import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { api, ApiError, type LeadSourceSummary } from '../../api'
import { leadSourceLabel } from './leadOrigin'
import './leads.css'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const iso = (date: Date) => date.toISOString().slice(0, 10)

/** Cor fixa por fonte, para a mesma fonte ter sempre a mesma fatia. */
const COLORS: Record<string, string> = {
  INSTAGRAM: '#d6457a', FACEBOOK: '#3b6fd8', META_ADS: '#8a5bd6', GOOGLE: '#2f9e5b', GOOGLE_ADS: '#e0a93b',
  INDICACAO: '#1a9baa', MEDICO: '#c2563b', WHATSAPP: '#25a35a', SITE_DIRETO: '#5f7d86', OUTRO: '#9aa6ab', NAO_INFORMADO: '#cfd6d8',
}

type Metric = 'contacts' | 'orders'

type Part = { key: string; value: number; color: string; name: string }

/**
 * Fatias da pizza (rosca) em SVG. Passar o mouse numa fatia mostra um balão com a fonte e a quantidade real, e o
 * centro troca o total pelo número daquela fonte.
 */
function Donut({ parts, total, label, unit, active, onActive }: {
  parts: Part[]; total: number; label: string; unit: (count: number) => string
  active: string | null; onActive: (key: string | null) => void
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const starts = parts.map((_, index) => parts.slice(0, index).reduce((sum, part) => sum + (part.value / total) * circumference, 0))
  const shown = parts.find(part => part.key === active)
  return <div className="lead-pie-box" onMouseLeave={() => { onActive(null); setTip(null) }}>
    <svg className="lead-pie" viewBox="0 0 140 140" role="img" aria-label={`${total} ${label}`}
      onMouseMove={event => { const box = event.currentTarget.getBoundingClientRect(); setTip({ x: event.clientX - box.left, y: event.clientY - box.top }) }}>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef1f2" strokeWidth="22" />
      {parts.map((part, index) => {
        const length = (part.value / total) * circumference
        return <circle key={part.key} cx="70" cy="70" r={radius} fill="none" stroke={part.color}
          strokeWidth={active === part.key ? 28 : 22} opacity={active && active !== part.key ? 0.35 : 1}
          strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-starts[index]} transform="rotate(-90 70 70)"
          onMouseEnter={() => onActive(part.key)} style={{ cursor: 'pointer', transition: 'stroke-width .12s, opacity .12s' }} />
      })}
      <text x="70" y="66" textAnchor="middle" className="lead-pie-total">{shown ? shown.value : total}</text>
      <text x="70" y="84" textAnchor="middle" className="lead-pie-caption">{shown ? shown.name : label}</text>
    </svg>
    {shown && tip && <div className="lead-pie-tip" style={{ left: tip.x + 12, top: tip.y + 12 }} role="tooltip">
      <i style={{ background: shown.color }} /><b>{shown.name}</b>
      <span>{unit(shown.value)} • {Math.round((shown.value / total) * 100)}%</span>
    </div>}
  </div>
}

/** "De onde vêm os clientes": contatos que chegaram e aluguéis pagos no mês, por fonte, em pizza. */
export function LeadSourcesPanel({ credentials, className }: { credentials: string; className?: string }) {
  const today = new Date()
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<LeadSourceSummary | null>(null)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)
  const [metric, setMetric] = useState<Metric>('contacts')
  const [active, setActive] = useState<string | null>(null)

  const range = useMemo(() => {
    const first = new Date(Date.UTC(today.getFullYear(), today.getMonth() + offset, 1))
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
    return { first, from: iso(first), to: iso(last) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])

  useEffect(() => {
    let active = true
    api.leadSources(credentials, range.from, range.to).then(summary => { if (active) { setData(summary); setError('') } }, failure => {
      if (!active) return
      // Parceiro não vê a receita de todas as filiais: o quadro some.
      if (failure instanceof ApiError && failure.status === 403) setHidden(true)
      else setError('Não foi possível carregar a origem dos clientes.')
    })
    return () => { active = false }
  }, [credentials, range])

  if (hidden) return null
  const rows = data?.rows ?? []
  const totals = rows.reduce((sum, row) => ({ contacts: sum.contacts + row.contacts, orders: sum.orders + row.orders,
    revenue: sum.revenue + row.revenueCents }), { contacts: 0, orders: 0, revenue: 0 })
  const total = metric === 'contacts' ? totals.contacts : totals.orders
  const parts = [...rows].map(row => ({ key: row.source, name: leadSourceLabel(row.source), value: metric === 'contacts' ? row.contacts : row.orders,
    color: COLORS[row.source] ?? '#9aa6ab', row })).filter(part => part.value > 0).sort((a, b) => b.value - a.value)

  return <section className={`panel lead-sources${className ? ` ${className}` : ''}`} aria-labelledby="lead-sources-title">
    <header className="lead-sources-head">
      <h2 id="lead-sources-title"><Megaphone size={18} /> De onde vêm os clientes</h2>
      <div className="lead-sources-month">
        <button type="button" className="icon-button" aria-label="Mês anterior" onClick={() => setOffset(value => value - 1)}><ChevronLeft size={18} /></button>
        <span>{monthName.format(range.first).replace(/^./, letter => letter.toUpperCase())}</span>
        <button type="button" className="icon-button" aria-label="Próximo mês" disabled={offset >= 0} onClick={() => setOffset(value => value + 1)}><ChevronRight size={18} /></button>
      </div>
    </header>
    <div className="lead-metric" role="tablist" aria-label="Ver por">
      <button type="button" role="tab" aria-selected={metric === 'contacts'} className={metric === 'contacts' ? 'selected' : ''}
        onClick={() => { setMetric('contacts'); setActive(null) }}>Contatos ({totals.contacts})</button>
      <button type="button" role="tab" aria-selected={metric === 'orders'} className={metric === 'orders' ? 'selected' : ''}
        onClick={() => { setMetric('orders'); setActive(null) }}>Aluguéis pagos ({totals.orders})</button>
    </div>
    {error ? <p className="lead-sources-empty">{error}</p>
      : !data ? <p className="lead-sources-empty">Carregando...</p>
      : total === 0 ? <p className="lead-sources-empty">{metric === 'contacts' ? 'Nenhum contato com origem registrada neste mês.' : 'Nenhum aluguel pago neste mês.'}</p>
      : <div className="lead-pie-wrap">
        <Donut parts={parts} total={total} label={metric === 'contacts' ? 'contatos' : 'aluguéis'} active={active} onActive={setActive}
          unit={count => metric === 'contacts' ? `${count} ${count === 1 ? 'pessoa' : 'pessoas'}` : `${count} ${count === 1 ? 'aluguel' : 'aluguéis'}`} />
        <ul className="lead-pie-legend">{parts.map(part => <li key={part.key} className={active === part.key ? 'active' : ''}
          onMouseEnter={() => setActive(part.key)} onMouseLeave={() => setActive(null)}>
          <i style={{ background: part.color }} /><b>{part.name}</b>
          <span>{part.value}{metric === 'orders' && part.row.revenueCents ? ` • ${money.format(part.row.revenueCents / 100)}` : ''}</span>
          <em>{Math.round((part.value / total) * 100)}%</em>
        </li>)}</ul>
      </div>}
    <p className="lead-sources-note">Contatos: pessoas que chegaram pelo site ou pelo WhatsApp no mês. Aluguéis pagos: pagos no mês, pela origem de quem alugou{totals.revenue ? ` (${money.format(totals.revenue / 100)} no total)` : ''}.</p>
  </section>
}

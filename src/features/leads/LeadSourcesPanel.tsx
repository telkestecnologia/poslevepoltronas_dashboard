import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { api, ApiError, type LeadSourceSummary } from '../../api'
import { leadSourceLabel } from './leadOrigin'
import './leads.css'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const iso = (date: Date) => date.toISOString().slice(0, 10)

/** "De onde vêm os clientes": contatos que chegaram e aluguéis pagos no mês, por fonte. */
export function LeadSourcesPanel({ credentials }: { credentials: string }) {
  const today = new Date()
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<LeadSourceSummary | null>(null)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)

  const range = useMemo(() => {
    const first = new Date(Date.UTC(today.getFullYear(), today.getMonth() + offset, 1))
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
    return { first, from: iso(first), to: iso(last) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])

  useEffect(() => {
    let active = true
    setError('')
    api.leadSources(credentials, range.from, range.to).then(summary => { if (active) setData(summary) }, failure => {
      if (!active) return
      // Parceiro não vê a receita de todas as filiais: o quadro some.
      if (failure instanceof ApiError && failure.status === 403) setHidden(true)
      else setError('Não foi possível carregar a origem dos clientes.')
    })
    return () => { active = false }
  }, [credentials, range])

  if (hidden) return null
  const rows = data?.rows ?? []
  const maxContacts = Math.max(1, ...rows.map(row => row.contacts))
  const totals = rows.reduce((sum, row) => ({ contacts: sum.contacts + row.contacts, orders: sum.orders + row.orders,
    revenue: sum.revenue + row.revenueCents }), { contacts: 0, orders: 0, revenue: 0 })
  const sorted = [...rows].sort((a, b) => b.orders - a.orders || b.contacts - a.contacts)

  return <section className="panel lead-sources" aria-labelledby="lead-sources-title">
    <header className="lead-sources-head">
      <h2 id="lead-sources-title"><Megaphone size={18} /> De onde vêm os clientes</h2>
      <div className="lead-sources-month">
        <button type="button" className="icon-button" aria-label="Mês anterior" onClick={() => setOffset(value => value - 1)}><ChevronLeft size={18} /></button>
        <span>{monthName.format(range.first).replace(/^./, letter => letter.toUpperCase())}</span>
        <button type="button" className="icon-button" aria-label="Próximo mês" disabled={offset >= 0} onClick={() => setOffset(value => value + 1)}><ChevronRight size={18} /></button>
      </div>
    </header>
    {error ? <p className="lead-sources-empty">{error}</p>
      : !data ? <p className="lead-sources-empty">Carregando...</p>
      : sorted.length === 0 ? <p className="lead-sources-empty">Ainda não há contatos com origem registrada neste mês.</p>
      : <table className="lead-sources-table">
        <thead><tr><th>Fonte</th><th>Contatos</th><th>Aluguéis pagos</th><th>Valor</th></tr></thead>
        <tbody>{sorted.map(row => <tr key={row.source}>
          <td><span className="lead-sources-name">{leadSourceLabel(row.source)}</span>
            <span className="lead-sources-bar" aria-hidden="true"><i style={{ width: `${(row.contacts / maxContacts) * 100}%` }} /></span></td>
          <td>{row.contacts}</td><td>{row.orders}</td><td>{money.format(row.revenueCents / 100)}</td>
        </tr>)}</tbody>
        <tfoot><tr><td>Total</td><td>{totals.contacts}</td><td>{totals.orders}</td><td>{money.format(totals.revenue / 100)}</td></tr></tfoot>
      </table>}
    <p className="lead-sources-note">Contatos: pessoas que chegaram pelo site ou pelo WhatsApp no mês. Aluguéis pagos: pagos no mês, pela origem de quem alugou.</p>
  </section>
}

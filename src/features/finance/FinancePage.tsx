import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react'
import { api, type Branch, type FinancialReport } from '../../api'
import { getMessage } from '../../utils/errors'
import { RentalDatePicker } from '../overview/RentalDatePicker'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza',
})
const pageSize = 20

function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
}

function monthStart(monthsBack: number) {
  const [year, month] = today().split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 - monthsBack, 1)).toISOString().slice(0, 10)
}

function currency(cents: number) {
  return money.format(cents / 100)
}

export function FinancePage({ credentials }: { credentials: string }) {
  const [from, setFrom] = useState(() => monthStart(5))
  const [to, setTo] = useState(today)
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [branches, setBranches] = useState<Branch[]>([])
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void api.branches(credentials).then(data => {
      if (active) setBranches(data)
    }).catch(error => {
      if (active) setError(getMessage(error))
    })
    return () => { active = false }
  }, [credentials])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void api.finance(credentials, { from, to, branchId, page, size: pageSize })
      .then(data => { if (active) setReport(data) })
      .catch(error => { if (active) { setReport(null); setError(getMessage(error)) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [credentials, from, to, branchId, page, reloadKey])

  function selectPreset(months: number) {
    setFrom(monthStart(months - 1))
    setTo(today())
    setPage(0)
  }

  const maxChart = Math.max(1, ...(report?.monthly.map(bucket =>
    Math.max(bucket.inflowCents, bucket.outflowCents)) ?? []))
  const pages = report ? Math.max(1, Math.ceil(report.total / pageSize)) : 1

  return <>
    <div className="page-heading with-action finance-heading">
      <div>
        <span className="eyebrow">GESTÃO • FINANCEIRO</span>
        <h1>Financeiro</h1>
        <p>Acompanhe as entradas e saídas registradas no caixa por período e filial.</p>
      </div>
      <button type="button" className="button secondary" onClick={() => setReloadKey(key => key + 1)}
        disabled={loading}><RefreshCw size={16} /> Atualizar</button>
    </div>

    {report?.mode === 'DEMO' && <div className="finance-demo" role="note">
      <strong>Dados de demonstração</strong>
      <span>Os valores abaixo são fictícios e não representam dinheiro recebido pela empresa.</span>
    </div>}
    {report?.mode === 'EMPTY' && <div className="finance-info" role="status">
      Ainda não há movimentações financeiras recebidas pelo backend.
    </div>}

    <section className="panel finance-filters" aria-label="Filtros do financeiro">
      <div className="finance-presets" role="group" aria-label="Período rápido">
        {[{ months: 1, label: 'Este mês' }, { months: 3, label: '3 meses' },
          { months: 6, label: '6 meses' }].map(preset =>
          <button type="button" key={preset.months}
            className={from === monthStart(preset.months - 1) && to === today() ? 'selected' : ''}
            onClick={() => selectPreset(preset.months)}>{preset.label}</button>)}
      </div>
      <div className="finance-filter-fields">
        <RentalDatePicker date={from} onChange={value => { setFrom(value); setPage(0) }}
          label="De" maxDate={to} />
        <RentalDatePicker date={to} onChange={value => { setTo(value); setPage(0) }}
          label="Até" minDate={from} maxDate={today()} />
        <label className="finance-branch-filter">Filial
          <select value={branchId} onChange={event => { setBranchId(event.target.value); setPage(0) }}>
            <option value="">Todas as filiais</option>
            {branches.map(branch => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
          </select>
        </label>
      </div>
      {loading && <span className="finance-loading" role="status">Atualizando dados...</span>}
    </section>

    {error && <div className="form-error finance-error" role="alert">{error}</div>}
    {!report && loading && <div className="panel finance-initial-loading" role="status">Carregando financeiro...</div>}
    {report && <div className={loading ? 'finance-content is-loading' : 'finance-content'} aria-busy={loading}>
      <div className="finance-summary">
        <div className="panel finance-summary-card balance">
          <span>Saldo acumulado</span><strong>{currency(report.balanceCents)}</strong>
          <small>Entradas menos saídas registradas até agora</small>
        </div>
        <div className="panel finance-summary-card">
          <span>Entradas no período</span><strong>{currency(report.inflowCents)}</strong>
          <small>Valores recebidos</small>
        </div>
        <div className="panel finance-summary-card">
          <span>Saídas no período</span><strong>{currency(report.outflowCents)}</strong>
          <small>Despesas e devoluções</small>
        </div>
        <div className="panel finance-summary-card">
          <span>Resultado do período</span><strong>{currency(report.netCents)}</strong>
          <small>Entradas menos saídas</small>
        </div>
      </div>

      <div className="finance-visuals">
        <section className="panel finance-chart" aria-labelledby="finance-chart-title">
          <div className="finance-panel-heading">
            <div><span className="eyebrow">MOVIMENTAÇÃO</span><h2 id="finance-chart-title">Fluxo mensal</h2></div>
            <div className="finance-chart-legend"><span className="inflow">Entradas</span><span className="outflow">Saídas</span></div>
          </div>
          <div className="finance-chart-scroll">
            <div className="finance-chart-bars">
              {report.monthly.map(bucket => <div className="finance-chart-month" key={bucket.start}
                role="img" title={`Entradas: ${currency(bucket.inflowCents)} • Saídas: ${currency(bucket.outflowCents)}`}
                aria-label={`${monthName.format(new Date(`${bucket.start}T12:00:00Z`))}: entradas ${currency(bucket.inflowCents)}, saídas ${currency(bucket.outflowCents)}`}>
                <div className="finance-chart-plot">
                  <span className="finance-chart-bar inflow" style={{ height: `${bucket.inflowCents / maxChart * 100}%` }} />
                  <span className="finance-chart-bar outflow" style={{ height: `${bucket.outflowCents / maxChart * 100}%` }} />
                </div>
                <span>{monthName.format(new Date(`${bucket.start}T12:00:00Z`))}</span>
              </div>)}
            </div>
          </div>
        </section>
        <section className="panel finance-branches" aria-labelledby="finance-branches-title">
          <div className="finance-panel-heading"><div><span className="eyebrow">FILIAIS</span>
            <h2 id="finance-branches-title">Resultado por filial</h2></div></div>
          {report.branches.length === 0
            ? <div className="finance-branch-empty"><Wallet size={22} /> Sem movimentações no período.</div>
            : <div className="finance-branch-list">{report.branches.map(branch =>
              <div className="finance-branch-row" key={branch.branchId}>
                <strong>{branch.branchName}</strong>
                <span>Entradas {currency(branch.inflowCents)}</span>
                <span>Saídas {currency(branch.outflowCents)}</span>
                <b>{currency(branch.inflowCents - branch.outflowCents)}</b>
              </div>)}</div>}
        </section>
      </div>

      <section className="panel finance-statement" aria-labelledby="finance-statement-title">
        <div className="finance-panel-heading"><div><span className="eyebrow">EXTRATO</span>
          <h2 id="finance-statement-title">Movimentações</h2></div>
          <span className="finance-entry-count">{report.total.toLocaleString('pt-BR')} lançamentos</span>
        </div>
        {report.entries.length === 0
          ? <div className="finance-statement-empty">Nenhuma movimentação neste período.</div>
          : <div className="finance-table-scroll"><table className="finance-table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Filial</th><th>Meio</th><th>Valor</th></tr></thead>
            <tbody>{report.entries.map(entry => <tr key={entry.id}>
              <td>{dateTime.format(new Date(entry.occurredAt))}</td>
              <td><span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}>
                {entry.kind === 'INFLOW' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                <span className="finance-entry-description"><strong>{entry.description}</strong>
                  <small>{entry.category}{entry.reference ? ` • Ref. ${entry.reference}` : ''}</small></span></td>
              <td>{entry.branchName}</td><td>{entry.paymentMethod}</td>
              <td className={entry.kind === 'INFLOW' ? 'finance-positive' : 'finance-negative'}>
                {entry.kind === 'INFLOW' ? '+' : '−'} {currency(entry.amountCents)}</td>
            </tr>)}</tbody>
          </table></div>}
        {pages > 1 && <div className="finance-pagination">
          <span>Página {page + 1} de {pages}</span>
          <div><button type="button" className="button secondary" disabled={page === 0}
            onClick={() => setPage(value => value - 1)}>Anterior</button>
            <button type="button" className="button secondary" disabled={page + 1 >= pages}
              onClick={() => setPage(value => value + 1)}>Próxima</button></div>
        </div>}
      </section>
    </div>}
  </>
}

import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Download, RefreshCw, Search, Wallet, X } from 'lucide-react'
import { api, type Branch, type FinanceQuery, type FinancialEntry, type FinancialReport } from '../../api'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { RentalDatePicker } from '../overview/RentalDatePicker'
import { downloadFinanceReport } from './financeReport'
import './financeReport.css'

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

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// The backend has no text search and caps each page at 50 entries, so the statement search
// loads every entry of the chosen period and filters it here.
async function loadAllEntries(credentials: string, query: Omit<FinanceQuery, 'page' | 'size'>) {
  const size = 50
  const entries: FinancialEntry[] = []
  for (let page = 0; page < 100; page++) {
    const report = await api.finance(credentials, { ...query, page, size })
    entries.push(...report.entries)
    if (entries.length >= report.total || report.entries.length < size) break
  }
  return entries
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
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSaved, setReportSaved] = useState('')

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

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statementFrom, setStatementFrom] = useState(from)
  const [statementTo, setStatementTo] = useState(to)
  const [statementPage, setStatementPage] = useState(0)
  const [allEntries, setAllEntries] = useState<FinancialEntry[] | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)

  // The statement dates follow the period filter until the user narrows them.
  useEffect(() => {
    setStatementFrom(from)
    setStatementTo(to)
  }, [from, to])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setStatementPage(0) }, [debouncedSearch, statementFrom, statementTo, branchId])

  const statementFiltered = debouncedSearch !== '' || statementFrom !== from || statementTo !== to

  useEffect(() => {
    if (!statementFiltered) { setAllEntries(null); return }
    let active = true
    setStatementLoading(true)
    void loadAllEntries(credentials, { from: statementFrom, to: statementTo, branchId })
      .then(entries => { if (active) setAllEntries(entries) })
      .catch(error => { if (active) { setAllEntries([]); setError(getMessage(error)) } })
      .finally(() => { if (active) setStatementLoading(false) })
    return () => { active = false }
  }, [credentials, statementFiltered, statementFrom, statementTo, branchId, reloadKey])

  const term = normalize(debouncedSearch)
  const matches = allEntries?.filter(entry => term === '' || normalize([
    entry.description, entry.category, entry.reference, entry.paymentMethod, branchLabel(entry.branchName),
  ].join(' ')).includes(term)) ?? []

  function selectPreset(months: number) {
    setFrom(monthStart(months - 1))
    setTo(today())
    setPage(0)
  }

  const maxChart = Math.max(1, ...(report?.monthly.map(bucket =>
    Math.max(bucket.inflowCents, bucket.outflowCents)) ?? []))
  const statementTotal = statementFiltered ? matches.length : report?.total ?? 0
  const pages = Math.max(1, Math.ceil(statementTotal / pageSize))
  const currentPage = statementFiltered ? statementPage : page
  const setCurrentPage = statementFiltered ? setStatementPage : setPage
  const visibleEntries = statementFiltered
    ? matches.slice(statementPage * pageSize, (statementPage + 1) * pageSize)
    : report?.entries ?? []
  const visibleBranchResults = onlyOfficialBranches(report?.branches ?? [], branch => branch.branchName)
  const maxBranchFlow = Math.max(1, ...visibleBranchResults.map(branch => branch.inflowCents + branch.outflowCents))

  // Relatório geral (o mesmo do app): todos os lançamentos do período e da filial escolhidos.
  async function generateReport() {
    if (!report) return
    setReportBusy(true)
    setReportError('')
    setReportSaved('')
    try {
      const entries = await loadAllEntries(credentials, { from, to, branchId })
      const branch = branches.find(item => item.id === branchId)
      const name = await downloadFinanceReport({ report, entries, from, to, branch: branch ? branchLabel(branch.name) : 'Todas as filiais' })
      setReportSaved(`Relatório baixado: ${name}. Ele está na pasta de downloads do navegador.`)
    } catch (failure) {
      setReportError(`Não foi possível baixar o relatório. ${getMessage(failure)}`)
    } finally {
      setReportBusy(false)
    }
  }

  return <>
    <div className="page-heading with-action finance-heading">
      <div>
        <span className="eyebrow">GESTÃO • FINANCEIRO</span>
        <h1>Financeiro</h1>
        <p>Acompanhe as entradas e saídas registradas no caixa por período e filial.</p>
      </div>
      <div className="finance-actions">
        <button type="button" className="button secondary" onClick={() => void generateReport()}
          disabled={!report || reportBusy}><Download size={16} /> {reportBusy ? 'Baixando...' : 'Baixar relatório em PDF'}</button>
        <button type="button" className="button secondary" onClick={() => setReloadKey(key => key + 1)}
          disabled={loading}><RefreshCw size={16} /> Atualizar</button>
      </div>
    </div>
    {reportError && <div className="form-error" role="alert">{reportError}</div>}
    {reportSaved && <div className="finance-info" role="status">{reportSaved}</div>}

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
            {onlyOfficialBranches(branches, branch => branch.name).map(branch =>
              <option value={branch.id} key={branch.id}>{branchLabel(branch.name)}</option>)}
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
              {report.monthly.map((bucket, index) => <div className="finance-chart-month" key={bucket.start}
                role="img" tabIndex={0} style={{ '--i': index } as React.CSSProperties}
                aria-label={`${monthName.format(new Date(`${bucket.start}T12:00:00Z`))}: entradas ${currency(bucket.inflowCents)}, saídas ${currency(bucket.outflowCents)}`}>
                <div className="finance-chart-plot">
                  <span className="finance-chart-bar inflow" style={{ height: `${bucket.inflowCents / maxChart * 100}%` }} />
                  <span className="finance-chart-bar outflow" style={{ height: `${bucket.outflowCents / maxChart * 100}%` }} />
                  <span className="finance-chart-tooltip" aria-hidden="true">
                    <small>{monthName.format(new Date(`${bucket.start}T12:00:00Z`))}</small>
                    <span>Entradas <strong>{currency(bucket.inflowCents)}</strong></span>
                    <span>Saídas <strong>{currency(bucket.outflowCents)}</strong></span>
                  </span>
                </div>
                <span>{monthName.format(new Date(`${bucket.start}T12:00:00Z`))}</span>
              </div>)}
            </div>
          </div>
        </section>
        <section className="panel finance-branches" aria-labelledby="finance-branches-title">
          <div className="finance-panel-heading"><div><span className="eyebrow">FILIAIS</span>
            <h2 id="finance-branches-title">Resultado por filial</h2></div></div>
          {visibleBranchResults.length === 0
            ? <div className="finance-branch-empty"><Wallet size={22} /> Sem movimentações no período.</div>
            : <div className="finance-branch-list">{visibleBranchResults.map(branch =>
              <div className="finance-branch-row" key={branch.branchId}>
                <strong>{branchLabel(branch.branchName)}</strong>
                <span>Entradas {currency(branch.inflowCents)}</span>
                <span>Saídas {currency(branch.outflowCents)}</span>
                <b>{currency(branch.inflowCents - branch.outflowCents)}</b>
                <div className="finance-branch-meter" aria-hidden="true">
                  <i className="inflow" style={{ width: `${branch.inflowCents / maxBranchFlow * 100}%` }} />
                  <i className="outflow" style={{ width: `${branch.outflowCents / maxBranchFlow * 100}%` }} />
                </div>
              </div>)}</div>}
        </section>
      </div>

      <section className="panel finance-statement" aria-labelledby="finance-statement-title">
        <div className="finance-panel-heading"><div><span className="eyebrow">EXTRATO</span>
          <h2 id="finance-statement-title">Movimentações</h2></div>
          <span className="finance-entry-count">{statementTotal.toLocaleString('pt-BR')} lançamentos</span>
        </div>
        <div className="finance-statement-tools" role="search" aria-label="Buscar movimentações">
          <label className="finance-search">
            <span className="sr-only">Buscar por nome</span>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nome" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}>
              <X size={14} /></button>}
          </label>
          <RentalDatePicker date={statementFrom} onChange={setStatementFrom}
            label="De" maxDate={statementTo} />
          <RentalDatePicker date={statementTo} onChange={setStatementTo}
            label="Até" minDate={statementFrom} maxDate={today()} />
        </div>
        {statementLoading && <span className="finance-loading" role="status">Buscando movimentações...</span>}
        {visibleEntries.length === 0
          ? <div className="finance-statement-empty">{statementLoading ? 'Carregando...'
            : debouncedSearch ? `Nenhuma movimentação encontrada para "${debouncedSearch}".`
              : 'Nenhuma movimentação neste período.'}</div>
          : <><div className="finance-table-scroll"><table className="finance-table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Filial</th><th>Meio</th><th>Valor</th></tr></thead>
            <tbody>{visibleEntries.map(entry => <tr key={entry.id}>
              <td>{dateTime.format(new Date(entry.occurredAt))}</td>
              <td><span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}>
                {entry.kind === 'INFLOW' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                <span className="finance-entry-description"><strong>{entry.description}</strong>
                  <small>{entry.category}{entry.reference ? ` • Ref. ${entry.reference}` : ''}</small></span></td>
              <td>{branchLabel(entry.branchName)}</td><td>{entry.paymentMethod}</td>
              <td className={entry.kind === 'INFLOW' ? 'finance-positive' : 'finance-negative'}>
                {entry.kind === 'INFLOW' ? '+' : '−'} {currency(entry.amountCents)}</td>
            </tr>)}</tbody>
          </table></div>
          <ul className="finance-entry-list">{visibleEntries.map(entry => <li key={entry.id}>
            <details>
              <summary>
                <span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}>
                  {entry.kind === 'INFLOW' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                <span className="finance-entry-description"><strong>{entry.description}</strong>
                  <small>{dateTime.format(new Date(entry.occurredAt))}</small></span>
                <b className={entry.kind === 'INFLOW' ? 'finance-positive' : 'finance-negative'}>
                  {entry.kind === 'INFLOW' ? '+' : '−'} {currency(entry.amountCents)}</b>
                <ChevronDown size={16} className="finance-entry-chevron" aria-hidden="true" />
              </summary>
              <dl>
                <div><dt>Filial</dt><dd>{branchLabel(entry.branchName)}</dd></div>
                <div><dt>Meio</dt><dd>{entry.paymentMethod}</dd></div>
                <div><dt>Categoria</dt><dd>{entry.category}</dd></div>
                {entry.reference && <div><dt>Referência</dt><dd>{entry.reference}</dd></div>}
              </dl>
            </details>
          </li>)}</ul></>}
        {pages > 1 && <div className="finance-pagination">
          <span>Página {currentPage + 1} de {pages}</span>
          <div><button type="button" className="button secondary" disabled={currentPage === 0}
            onClick={() => setCurrentPage(value => value - 1)}>Anterior</button>
            <button type="button" className="button secondary" disabled={currentPage + 1 >= pages}
              onClick={() => setCurrentPage(value => value + 1)}>Próxima</button></div>
        </div>}
      </section>
    </div>}
  </>
}

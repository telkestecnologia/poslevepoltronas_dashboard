import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw, Search, Wallet, X } from 'lucide-react'
import { api, type Branch, type FinanceQuery, type FinancialEntry, type FinancialReport } from '../../api'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { RentalDatePicker } from '../overview/RentalDatePicker'
import { downloadFinanceReport } from './financeReport'
import './financeReport.css'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const dateLabel = (iso: string) => shortDay.format(new Date(`${iso}T12:00:00Z`))
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
  const [allReport, setAllReport] = useState<FinancialReport | null>(null)
  const [monthIndex, setMonthIndex] = useState<number | null>(null)
  const [kindFilter, setKindFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL')
  const [filterOpen, setFilterOpen] = useState(false)
  const [draft, setDraft] = useState({ from: '', to: '', branchId: '' })
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
    // Saldo acumulado e resultado por filial: sempre de todas as filiais, mesmo com uma filial escolhida (igual ao app).
    void api.finance(credentials, { from, to, branchId: '', page: 0, size: 1 })
      .then(data => { if (active) setAllReport(data) }).catch(() => {})
    return () => { active = false }
  }, [credentials, from, to, branchId, page, reloadKey])

  useEffect(() => { setMonthIndex(null) }, [from, to, branchId])

  // Resultado por filial (igual ao app): lançamentos de todas as filiais no mês mostrado nas setas.
  const monthList = report?.monthly ?? []
  const shownMonthStart = monthList.length ? monthList[Math.min(monthIndex ?? monthList.length - 1, monthList.length - 1)].start : null
  const monthKey = shownMonthStart ? `${shownMonthStart}|${reloadKey}` : ''
  const [monthLoaded, setMonthLoaded] = useState<{ key: string; entries: FinancialEntry[] } | null>(null)
  useEffect(() => {
    if (!shownMonthStart) return
    let active = true
    const [year, month] = shownMonthStart.split('-').map(Number)
    const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    void loadAllEntries(credentials, { from: shownMonthStart, to: last < today() ? last : today(), branchId: '' })
      .then(entries => { if (active) setMonthLoaded({ key: monthKey, entries }) })
      .catch(() => { if (active) setMonthLoaded({ key: monthKey, entries: [] }) })
    return () => { active = false }
  }, [credentials, monthKey, shownMonthStart])
  const monthEntries = monthLoaded?.key === monthKey ? monthLoaded.entries : null

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

  useEffect(() => { setStatementPage(0) }, [debouncedSearch, statementFrom, statementTo, branchId, kindFilter])

  const statementFiltered = debouncedSearch !== '' || statementFrom !== from || statementTo !== to || kindFilter !== 'ALL'

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
  const matches = allEntries?.filter(entry => kindFilter === 'ALL' || (kindFilter === 'INFLOW') === (entry.kind === 'INFLOW'))
    .filter(entry => term === '' || normalize([
    entry.description, entry.category, entry.reference, entry.paymentMethod, branchLabel(entry.branchName),
  ].join(' ')).includes(term)) ?? []


  const statementTotal = statementFiltered ? matches.length : report?.total ?? 0
  const pages = Math.max(1, Math.ceil(statementTotal / pageSize))
  const currentPage = statementFiltered ? statementPage : page
  const setCurrentPage = statementFiltered ? setStatementPage : setPage
  const visibleEntries = statementFiltered
    ? matches.slice(statementPage * pageSize, (statementPage + 1) * pageSize)
    : report?.entries ?? []
  const selectedBranch = branches.find(item => item.id === branchId)
  const selectedBranchLabel = selectedBranch ? branchLabel(selectedBranch.name) : 'Todas as filiais'
  const months = report?.monthly ?? []
  const shownIndex = months.length === 0 ? -1 : Math.min(monthIndex ?? months.length - 1, months.length - 1)
  const shownMonth = shownIndex >= 0 ? months[shownIndex] : undefined

  function openFilter() {
    setDraft({ from, to, branchId })
    setFilterOpen(true)
  }

  function applyFilter() {
    setFrom(draft.from)
    setTo(draft.to)
    setBranchId(draft.branchId)
    setPage(0)
    setFilterOpen(false)
  }

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

    {report?.mode === 'EMPTY' && <div className="finance-info" role="status">
      Ainda não há movimentações financeiras recebidas pelo backend.
    </div>}

    {filterOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFilterOpen(false) }}>
      <section className="modal finance-filter-modal" role="dialog" aria-modal="true" aria-label="Período e filial">
        <div className="modal-head"><div><span className="eyebrow">FINANCEIRO</span><h2>Período e filial</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={() => setFilterOpen(false)}><X size={20} /></button></div>
        <div className="finance-presets" role="group" aria-label="Período rápido">
          {[{ months: 1, label: 'Este mês' }, { months: 3, label: '3 meses' }, { months: 6, label: '6 meses' }].map(preset =>
            <button type="button" key={preset.months}
              className={draft.from === monthStart(preset.months - 1) && draft.to === today() ? 'selected' : ''}
              onClick={() => setDraft(current => ({ ...current, from: monthStart(preset.months - 1), to: today() }))}>{preset.label}</button>)}
        </div>
        <div className="finance-filter-fields">
          <RentalDatePicker date={draft.from} onChange={value => setDraft(current => ({ ...current, from: value }))} label="De" maxDate={draft.to} />
          <RentalDatePicker date={draft.to} onChange={value => setDraft(current => ({ ...current, to: value }))} label="Até" minDate={draft.from} maxDate={today()} />
          <label className="finance-branch-filter">Filial
            <select value={draft.branchId} onChange={event => setDraft(current => ({ ...current, branchId: event.target.value }))}>
              <option value="">Todas as filiais</option>
              {onlyOfficialBranches(branches, branch => branch.name).map(branch =>
                <option value={branch.id} key={branch.id}>{branchLabel(branch.name)}</option>)}
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={() => setFilterOpen(false)}>Cancelar</button>
          <button type="button" className="button primary" onClick={applyFilter}>Aplicar</button>
        </div>
      </section>
    </div>}

    {error && <div className="form-error finance-error" role="alert">{error}</div>}
    {!report && loading && <div className="panel finance-initial-loading" role="status">Carregando financeiro...</div>}
    {report && <div className={loading ? 'finance-content is-loading' : 'finance-content'} aria-busy={loading}>
      <div className="finance-summary">
        <div className="panel finance-summary-card balance">
          <span>Saldo acumulado</span><strong>{currency((allReport ?? report).balanceCents)}</strong>
          <small>Total de todas as filiais</small>
          <button type="button" className="finance-filter-button" onClick={openFilter}>
            📅 {dateLabel(from)} a {dateLabel(to)} • {selectedBranchLabel} <ChevronDown size={14} /></button>
          {loading && <span className="finance-loading" role="status">Atualizando dados...</span>}
        </div>
      </div>

      <div className="finance-visuals">
        <section className="panel finance-chart" aria-labelledby="finance-chart-title">
          <div className="finance-panel-heading">
            <div><span className="eyebrow">MOVIMENTAÇÃO</span><h2 id="finance-chart-title">Mês a mês</h2></div>
          </div>
          {!shownMonth ? <div className="finance-branch-empty"><Wallet size={22} /> Sem movimentação no período.</div> : <div className="finance-month">
            <div className="finance-month-nav">
              <button type="button" aria-label="Mês anterior" disabled={shownIndex <= 0} onClick={() => setMonthIndex(shownIndex - 1)}><ChevronLeft size={20} /></button>
              <div><strong>{monthName.format(new Date(`${shownMonth.start}T12:00:00Z`))}</strong><label className="finance-month-branch"><span className="sr-only">Trocar filial</span>
                <select value={branchId} onChange={event => { setBranchId(event.target.value); setPage(0) }}>
                  <option value="">Todas as filiais</option>
                  {onlyOfficialBranches(branches, branch => branch.name).map(branch =>
                    <option value={branch.id} key={branch.id}>{branchLabel(branch.name)}</option>)}
                </select></label></div>
              <button type="button" aria-label="Próximo mês" disabled={shownIndex >= months.length - 1} onClick={() => setMonthIndex(shownIndex + 1)}><ChevronRight size={20} /></button>
            </div>
            {/* Um card só (igual ao app): o mês das setas, com Entradas e Saídas que filtram o extrato e o que sobrou. */}
            <div className="finance-month-figures">
              <button type="button" className={`inflow${kindFilter === 'INFLOW' ? ' selected' : ''}`} aria-pressed={kindFilter === 'INFLOW'}
                onClick={() => setKindFilter(current => current === 'INFLOW' ? 'ALL' : 'INFLOW')}><span>⬆ Entradas</span><strong>{currency(shownMonth.inflowCents)}</strong></button>
              <button type="button" className={`outflow${kindFilter === 'OUTFLOW' ? ' selected' : ''}`} aria-pressed={kindFilter === 'OUTFLOW'}
                onClick={() => setKindFilter(current => current === 'OUTFLOW' ? 'ALL' : 'OUTFLOW')}><span>⬇ Saídas</span><strong>{currency(shownMonth.outflowCents)}</strong></button>
              <div className="net"><span>{shownMonth.inflowCents - shownMonth.outflowCents >= 0 ? 'Sobrou' : 'Faltou'}</span>
                <strong className={shownMonth.inflowCents - shownMonth.outflowCents >= 0 ? '' : 'finance-negative'}>{currency(Math.abs(shownMonth.inflowCents - shownMonth.outflowCents))}</strong></div>
            </div>
          </div>}
        </section>
        <section className="panel finance-branches" aria-labelledby="finance-branches-title">
          <div className="finance-panel-heading"><div><span className="eyebrow">FILIAIS</span>
            <h2 id="finance-branches-title">Resultado por filial{shownMonth ? ` • ${monthName.format(new Date(`${shownMonth.start}T12:00:00Z`))}` : ''}</h2></div></div>
          {monthEntries === null ? <div className="finance-branch-empty">Carregando o mês...</div>
            : <div className="finance-branch-days">{onlyOfficialBranches(branches, branch => branch.name).map(branch => {
              const list = monthEntries.filter(entry => entry.branchId === branch.id)
              const inflow = list.filter(entry => entry.kind === 'INFLOW').reduce((sum, entry) => sum + entry.amountCents, 0)
              const outflow = list.filter(entry => entry.kind !== 'INFLOW').reduce((sum, entry) => sum + entry.amountCents, 0)
              const days = [...new Set(list.map(entry => entry.occurredAt.slice(0, 10)))].sort().reverse()
              return <div key={branch.id} className={`finance-branch-card region-${regionOf(branch.name)}`}>
                <div className="finance-branch-head"><i aria-hidden="true" /><strong>{branchLabel(branch.name)}</strong>
                  <b className={inflow - outflow < 0 ? 'finance-negative' : ''}>{currency(inflow - outflow)}</b></div>
                <small>⬆ {currency(inflow)} • ⬇ {currency(outflow)}</small>
                {days.length === 0 ? <em>Sem movimentação neste mês.</em> : days.map(day => {
                  const ofDay = list.filter(entry => entry.occurredAt.startsWith(day))
                  const dayIn = ofDay.filter(entry => entry.kind === 'INFLOW').reduce((sum, entry) => sum + entry.amountCents, 0)
                  const dayOut = ofDay.filter(entry => entry.kind !== 'INFLOW').reduce((sum, entry) => sum + entry.amountCents, 0)
                  return <div key={day} className="finance-day"><span>{day.slice(8, 10)}/{day.slice(5, 7)}</span>
                    {dayIn > 0 && <span className="in">⬆ {currency(dayIn)}</span>}
                    {dayOut > 0 && <span className="out">⬇ {currency(dayOut)}</span>}</div>
                })}
              </div>
            })}</div>}
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
            <tbody>{visibleEntries.map(entry => <tr key={entry.id} className={`finance-row ${entry.kind === 'INFLOW' ? 'inflow' : 'outflow'}`}>
              <td>{dateTime.format(new Date(entry.occurredAt))}</td>
              <td><span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}>
                {entry.kind === 'INFLOW' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</span>
                <span className="finance-entry-description"><em className="finance-kind-tag">{entry.kind === 'INFLOW' ? '💰 Entrada' : '💸 Saída'}</em><strong>{entry.description}</strong>
                  <small>{entry.category}{entry.reference ? ` • Ref. ${entry.reference}` : ''}</small></span></td>
              <td>{branchLabel(entry.branchName)}</td><td>{entry.paymentMethod}</td>
              <td className={entry.kind === 'INFLOW' ? 'finance-positive' : 'finance-negative'}>
                {entry.kind === 'INFLOW' ? '+' : '−'} {currency(entry.amountCents)}</td>
            </tr>)}</tbody>
          </table></div>
          <ul className="finance-entry-list">{visibleEntries.map(entry => <li key={entry.id} className={`finance-row ${entry.kind === 'INFLOW' ? 'inflow' : 'outflow'}`}>
            <details>
              <summary>
                <span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}>
                  {entry.kind === 'INFLOW' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</span>
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

function regionOf(name: string) {
  const text = normalize(name)
  if (/serra|ibiapaba/.test(text)) return 'serra'
  if (/sobral/.test(text)) return 'sobral'
  return 'fortaleza'
}

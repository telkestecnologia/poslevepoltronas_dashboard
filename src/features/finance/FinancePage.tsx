import { useEffect, useState } from 'react'
import { Banknote, CalendarCog, Check, Copy, CreditCard, FileText, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, Wallet, X } from 'lucide-react'
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
      <section className="modal finance-filter-modal" role="dialog" aria-modal="true" aria-label="Período">
        <div className="modal-head"><div><span className="eyebrow">FINANCEIRO</span><h2>Período</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={() => setFilterOpen(false)}><X size={20} /></button></div>
        <div className="finance-filter-fields">
          <RentalDatePicker date={draft.from} onChange={value => setDraft(current => ({ ...current, from: value }))} label="De" maxDate={draft.to} />
          <RentalDatePicker date={draft.to} onChange={value => setDraft(current => ({ ...current, to: value }))} label="Até" minDate={draft.from} maxDate={today()} />
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={() => setFilterOpen(false)}>Cancelar</button>
          <button type="button" className="button primary" onClick={applyFilter}>Buscar</button>
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
          {loading && <span className="finance-loading" role="status">Atualizando dados...</span>}
        </div>
      </div>

      <div className="finance-visuals">
        <section className="panel finance-chart" aria-labelledby="finance-chart-title">
          <div className="finance-panel-heading">
            <div className="finance-today-title"><h2 id="finance-chart-title">Hoje <small className="finance-today">{dateLabel(today())}</small></h2>
            {/* Ícone de editar as datas (De e Até): abre o modal com o calendário (igual ao app). */}
            <button type="button" className="finance-date-icon" onClick={openFilter} title={`Mudar as datas (${dateLabel(from)} a ${dateLabel(to)})`}
              aria-label={`Mudar as datas (${dateLabel(from)} a ${dateLabel(to)})`}><CalendarCog size={19} /></button>
            <button type="button" className="finance-date-icon pdf" onClick={() => void generateReport()} disabled={!report || reportBusy}
              title="Baixar relatório em PDF" aria-label="Baixar relatório em PDF"><FileText size={19} /></button></div>
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
              <div className="net"><span>Resultado</span>
                <strong className={shownMonth.inflowCents - shownMonth.outflowCents >= 0 ? '' : 'finance-negative'}>{currency(shownMonth.inflowCents - shownMonth.outflowCents)}</strong></div>
            </div>
          </div>}
        </section>
        <section className="panel finance-branches" aria-labelledby="finance-branches-title">
          <div className="finance-panel-heading"><div><span className="eyebrow">FILIAIS</span>
            <h2 id="finance-branches-title">Resultado por filial</h2></div></div>
          {/* Simples (igual ao app): as três filiais lado a lado, com o mês (3 letras) e o valor do mês das setas. */}
          <div className="finance-branch-tiles">{onlyOfficialBranches(branches, branch => branch.name).map(branch => {
            const net = (monthEntries ?? []).filter(entry => entry.branchId === branch.id)
              .reduce((sum, entry) => sum + (entry.kind === 'INFLOW' ? entry.amountCents : -entry.amountCents), 0)
            return <div key={branch.id} className={`finance-branch-tile region-${regionOf(branch.name)}`}>
              <strong>{shortBranch(branch.name)}</strong>
              <small>{shownMonthStart ? monthAbbr(shownMonthStart) : '—'}</small>
              <b className={net < 0 ? 'finance-negative' : ''}>{monthEntries === null ? '…' : currency(net)}</b>
            </div>
          })}</div>
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
              <td><span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}><MethodIcon method={entry.paymentMethod} /></span>
                <span className="finance-entry-description"><strong>{entryTitle(entry.description)}</strong>
                  {entry.reference && <small className="finance-ref">Ref. {entry.reference} <CopyButton text={entry.reference} /></small>}</span></td>
              <td>{branchLabel(entry.branchName)}</td><td>{methodLabel(entry.paymentMethod)}</td>
              <td className={entry.kind === 'INFLOW' ? 'finance-positive' : 'finance-negative'}>
                {entry.kind === 'INFLOW' ? '+' : '−'} {currency(entry.amountCents)}</td>
            </tr>)}</tbody>
          </table></div>
          <ul className="finance-entry-list">{visibleEntries.map(entry => <li key={entry.id} className={`finance-row ${entry.kind === 'INFLOW' ? 'inflow' : 'outflow'}`}>
            <details>
              <summary>
                <span className={`finance-entry-icon ${entry.kind.toLowerCase()}`}><MethodIcon method={entry.paymentMethod} /></span>
                <span className="finance-entry-description"><strong>{entryTitle(entry.description)}</strong>
                  <small>{dateTime.format(new Date(entry.occurredAt))}</small></span>
                <b className={entry.kind === 'INFLOW' ? 'finance-positive' : 'finance-negative'}>
                  {entry.kind === 'INFLOW' ? '+' : '−'} {currency(entry.amountCents)}</b>
                <ChevronDown size={16} className="finance-entry-chevron" aria-hidden="true" />
              </summary>
              <dl>
                <div><dt>Filial</dt><dd>{branchLabel(entry.branchName)}</dd></div>
                <div><dt>Meio</dt><dd>{methodLabel(entry.paymentMethod)}</dd></div>
                <div><dt>Categoria</dt><dd>{categoryLabel(entry.category)}</dd></div>
                {entry.reference && <div><dt>Referência</dt><dd>{entry.reference} <CopyButton text={entry.reference} /></dd></div>}
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

const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const monthAbbr = (iso: string) => monthNames[Number(iso.slice(5, 7)) - 1] ?? ''

function shortBranch(name: string) {
  const text = normalize(name)
  if (/serra|ibiapaba/.test(text)) return 'Ibiapaba'
  if (/sobral/.test(text)) return 'Sobral'
  if (/fortaleza/.test(text)) return 'Fortaleza'
  return branchLabel(name)
}

/** "Recebimento PIX do pedido abc123" → "Recebimento PIX": o código fica na referência (igual ao app). */
function entryTitle(description: string) {
  return description.replace(/\s+(do|de|ao) pedido\s+\S+$/i, '').trim() || description
}

function methodLabel(method: string) {
  const text = normalize(method)
  if (text.includes('pix')) return 'Pix'
  if (text.includes('cart')) return 'Cartão'
  return method
}

function categoryLabel(category: string) {
  const words = category.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Ícone do meio de pagamento: Pix (logo), cartão ou dinheiro. */
function MethodIcon({ method }: { method: string }) {
  const text = normalize(method)
  if (text.includes('pix')) return <svg width="15" height="15" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M242.4 292.5c5.4-5.4 14.7-5.4 20.1 0l77.5 77.5c14.3 14.3 33.3 22.1 53.5 22.1h15.2l-97.8 97.8c-30.6 30.5-80.2 30.5-110.8 0l-98.2-98.2h9.4c20.2 0 39.2-7.9 53.5-22.1l77.6-77.1zm20.1-73.6c-6.4 5.5-14.6 5.6-20.1 0l-77.6-77.1c-14.3-15.2-33.3-22.2-53.5-22.2h-9.4l98.1-98.12c30.7-30.65 80.3-30.65 110.9 0l97.8 97.82h-15.2c-20.2 0-39.2 7.9-53.5 22.2l-77.5 77.4zm-149.9-73.9c13.9 0 26.7 5.6 37.5 15.5l77.6 77.6c7.2 6.3 16.7 10.8 26.2 10.8 10.4 0 19.9-4.5 27.1-10.8l77.5-77.5c9.9-9.8 23.5-15.5 37.5-15.5h38l58.7 58.7c30.5 30.6 30.5 80.2 0 110.8L434 371.5h-38c-14 0-27.6-5.7-37.5-16.5l-77.5-77.5c-14-14-38.4-14-52.4.1l-77.6 77.4c-10.8 10.8-23.6 16.5-37.5 16.5H80.78l-58.29-58.6c-30.65-30.6-30.65-80.2 0-110.8L80.78 145h31.82z"/></svg>
  if (text.includes('cart')) return <CreditCard size={16} />
  return <Banknote size={16} />
}

/** Copia a referência (código do pedido) e mostra "Copiado" por 2 segundos. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return <button type="button" className="finance-copy" onClick={event => {
    event.preventDefault()
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) })
  }}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}</button>
}

import { useEffect, useState, type ReactNode } from 'react'
import { Armchair, CreditCard, MapPin, TrendingUp } from 'lucide-react'
import { api, type FinancialReport, type RentalOverview } from '../../api'
import { onlyOfficialBranches } from '../../utils/branches'
import './overview-charts.css'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
/** Mês com o ano (ex.: nov/2026), para nenhuma data aparecer sem ano. */
const monthName = { format: (date: Date) => `${monthShort.format(date).replace('.', '')}/${date.getUTCFullYear()}` }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
function monthsAgo(count: number) {
  const [year, month] = today().split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 - count, 1)).toISOString().slice(0, 10)
}
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Cores fixas por filial (as mesmas do Financeiro), para reconhecer cada uma em todos os gráficos. */
function branchTone(name: string) {
  const text = normalize(name)
  if (/serra|ibiapaba/.test(text)) return { name: 'Ibiapaba', color: '#3f9a62', soft: '#e5f4ea' }
  if (/sobral/.test(text)) return { name: 'Sobral', color: '#e87461', soft: '#fdebe6' }
  if (/fortaleza/.test(text)) return { name: 'Fortaleza', color: '#1a9baa', soft: '#e3f4f2' }
  return { name, color: '#8a6cc9', soft: '#efe9fa' }
}

type Methods = { pix: number; card: number; other: number }

/**
 * Gráficos da Visão geral (só no computador): entradas e saídas dos últimos 6 meses, ocupação das poltronas hoje,
 * quanto cada filial recebeu e como os clientes pagam. Cada gráfico diz em uma frase o que mostra.
 */
export function OverviewCharts({ credentials, rentals }: { credentials: string; rentals: RentalOverview }) {
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [methods, setMethods] = useState<Methods | null>(null)

  useEffect(() => {
    let active = true
    const from = monthsAgo(5)
    api.finance(credentials, { from, to: today(), branchId: '', page: 0, size: 1 })
      .then(data => { if (active) setReport(data) }).catch(() => {})
    // Meios de pagamento do mês: soma os recebimentos (até 500 lançamentos).
    void (async () => {
      const totals: Methods = { pix: 0, card: 0, other: 0 }
      try {
        for (let page = 0; page < 10; page++) {
          const data = await api.finance(credentials, { from: monthsAgo(0), to: today(), branchId: '', page, size: 50 })
          for (const entry of data.entries) {
            if (entry.kind !== 'INFLOW') continue
            const method = normalize(entry.paymentMethod)
            if (method.includes('pix')) totals.pix += entry.amountCents
            else if (method.includes('cart')) totals.card += entry.amountCents
            else totals.other += entry.amountCents
          }
          if (data.entries.length < 50) break
        }
        if (active) setMethods(totals)
      } catch {
        if (active) setMethods(totals)
      }
    })()
    return () => { active = false }
  }, [credentials])

  return <section className="overview-charts" aria-label="Gráficos da operação">
    <MonthlyChart report={report} />
    <OccupancyChart rentals={rentals} />
    <BranchRevenue report={report} rentals={rentals} />
    <PaymentMix methods={methods} />
  </section>
}

function ChartHead({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return <header className="oc-head"><span className="oc-icon">{icon}</span>
    <div><h2>{title}</h2><p>{hint}</p></div></header>
}

/** Barras lado a lado: verde = entrou, coral = saiu; em cima, o resultado do mês. */
function MonthlyChart({ report }: { report: FinancialReport | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const months = report?.monthly ?? []
  const max = Math.max(1, ...months.flatMap(month => [month.inflowCents, month.outflowCents]))
  const last = months.at(-1)
  const previous = months.at(-2)
  const change = last && previous && previous.inflowCents > 0
    ? Math.round(((last.inflowCents - previous.inflowCents) / previous.inflowCents) * 100) : null
  return <article className="panel oc-card oc-monthly">
    <ChartHead icon={<TrendingUp size={18} />} title="Entradas e saídas nos últimos 6 meses"
      hint="Cada mês tem duas barras: o que entrou (verde) e o que saiu (coral). Passe o mouse para ver os valores." />
    <div className="oc-kpis">
      <div><span>Entrou este mês</span><strong className="in">{money.format((last?.inflowCents ?? 0) / 100)}</strong>
        {change !== null && <em className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs mês passado</em>}</div>
      <div><span>Saiu este mês</span><strong className="out">{money.format((last?.outflowCents ?? 0) / 100)}</strong></div>
      <div><span>Sobrou este mês</span><strong>{money.format(((last?.inflowCents ?? 0) - (last?.outflowCents ?? 0)) / 100)}</strong></div>
    </div>
    {months.length === 0 ? <div className="oc-skeleton" /> : <div className="oc-bars">
      {months.map((month, index) => {
        const net = month.inflowCents - month.outflowCents
        return <div key={month.start} className={`oc-month${hover === index ? ' hover' : ''}${index === months.length - 1 ? ' current' : ''}`}
          onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
          <div className="oc-tip" role="tooltip">
            <b>{monthName.format(new Date(`${month.start}T00:00:00Z`)).replace('.', '')}</b>
            <span className="in">Entrou {money.format(month.inflowCents / 100)}</span>
            <span className="out">Saiu {money.format(month.outflowCents / 100)}</span>
            <span>Sobrou {money.format(net / 100)}</span>
          </div>
          <div className="oc-plot">
            <i className="in" style={{ height: `${(month.inflowCents / max) * 100}%`, animationDelay: `${index * 70}ms` }} />
            <i className="out" style={{ height: `${(month.outflowCents / max) * 100}%`, animationDelay: `${index * 70 + 40}ms` }} />
          </div>
          <small>{monthName.format(new Date(`${month.start}T00:00:00Z`)).replace('.', '')}</small>
        </div>
      })}
    </div>}
    <div className="oc-legend"><span><i className="in" />Entradas</span><span><i className="out" />Saídas</span></div>
  </article>
}

/** Rosca com o total alugado hoje e uma barra por filial. */
function OccupancyChart({ rentals }: { rentals: RentalOverview }) {
  const branches = onlyOfficialBranches(rentals.rentedChairsByBranch, branch => branch.branchName)
  const rented = branches.reduce((sum, branch) => sum + branch.rentedChairs, 0)
  const total = branches.reduce((sum, branch) => sum + branch.totalChairs, 0)
  const percent = total ? Math.round((rented / total) * 100) : 0
  const radius = 52
  const circumference = 2 * Math.PI * radius
  return <article className="panel oc-card oc-occupancy">
    <ChartHead icon={<Armchair size={18} />} title="Poltronas alugadas hoje"
      hint="A rosca mostra quanto da frota está com clientes; as barras, cada filial." />
    <div className="oc-occupancy-body">
      <div className="oc-donut">
        <svg viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r={radius} className="track" />
          <circle cx="64" cy="64" r={radius} className="value" strokeDasharray={circumference}
            style={{ ['--oc-offset' as string]: circumference * (1 - percent / 100), strokeDashoffset: circumference * (1 - percent / 100) }} />
        </svg>
        <div><strong>{percent}%</strong><span>{rented} de {total}</span></div>
      </div>
      <ul className="oc-branch-bars">
        {branches.map(branch => {
          const tone = branchTone(branch.branchName)
          const share = branch.totalChairs ? branch.rentedChairs / branch.totalChairs : 0
          return <li key={branch.branchId}>
            <div><b style={{ color: tone.color }}>{tone.name}</b><span>{branch.rentedChairs} de {branch.totalChairs} • {Math.round(share * 100)}%</span></div>
            <div className="oc-track" style={{ background: tone.soft }}><i style={{ width: `${share * 100}%`, background: tone.color }} /></div>
          </li>
        })}
      </ul>
    </div>
  </article>
}

/** Quanto cada filial recebeu no período, em barras deitadas com a fatia de cada uma. */
function BranchRevenue({ report, rentals }: { report: FinancialReport | null; rentals: RentalOverview }) {
  // Todas as filiais aparecem, mesmo as que ainda não receberam nada no período (com R$ 0).
  const received = new Map((report?.branches ?? []).map(branch => [branch.branchId, branch]))
  const all = rentals.rentedChairsByBranch.map(branch => received.get(branch.branchId)
    ?? { branchId: branch.branchId, branchName: branch.branchName, inflowCents: 0, outflowCents: 0 })
  for (const branch of report?.branches ?? []) if (!all.some(item => item.branchId === branch.branchId)) all.push(branch)
  const branches = onlyOfficialBranches(all, branch => branch.branchName)
  const total = branches.reduce((sum, branch) => sum + branch.inflowCents, 0)
  const max = Math.max(1, ...branches.map(branch => branch.inflowCents))
  return <article className="panel oc-card oc-branches">
    <ChartHead icon={<MapPin size={18} />} title="Quanto cada filial recebeu"
      hint="Soma dos recebimentos dos últimos 6 meses. A porcentagem é a fatia de cada filial no total." />
    {report === null ? <div className="oc-skeleton small" /> : <ul className="oc-branch-bars">
      {branches.map(branch => {
        const tone = branchTone(branch.branchName)
        return <li key={branch.branchId}>
          <div><b style={{ color: tone.color }}>{tone.name}</b>
            <span>{money.format(branch.inflowCents / 100)} • {total ? Math.round((branch.inflowCents / total) * 100) : 0}%</span></div>
          <div className="oc-track" style={{ background: tone.soft }}><i style={{ width: `${(branch.inflowCents / max) * 100}%`, background: tone.color }} /></div>
        </li>
      })}
      {branches.length === 0 && <li className="oc-empty">Ainda sem recebimentos no período.</li>}
    </ul>}
  </article>
}

/** Pix x cartão no mês: uma barra dividida, com o valor e a fatia de cada meio. */
function PaymentMix({ methods }: { methods: Methods | null }) {
  const total = methods ? methods.pix + methods.card + methods.other : 0
  const parts = methods ? [
    { key: 'pix', label: 'Pix', value: methods.pix, color: '#1a9baa' },
    { key: 'card', label: 'Cartão', value: methods.card, color: '#e0a93b' },
    { key: 'other', label: 'Outros', value: methods.other, color: '#8a6cc9' },
  ].filter(part => part.value > 0) : []
  return <article className="panel oc-card oc-methods">
    <ChartHead icon={<CreditCard size={18} />} title="Como os clientes pagam"
      hint="Recebimentos deste mês divididos por meio de pagamento." />
    {methods === null ? <div className="oc-skeleton small" /> : total === 0 ? <p className="oc-empty">Nenhum recebimento este mês ainda.</p> : <>
      <div className="oc-stack">{parts.map(part => <i key={part.key} style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
        title={`${part.label}: ${money.format(part.value / 100)}`} />)}</div>
      <ul className="oc-method-list">{parts.map(part => <li key={part.key}>
        <i style={{ background: part.color }} /><b>{part.label}</b>
        <span>{money.format(part.value / 100)}</span><em>{Math.round((part.value / total) * 100)}%</em>
      </li>)}</ul>
    </>}
  </article>
}

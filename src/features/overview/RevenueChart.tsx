import { CalendarCheck, TrendingUp, Trophy, Wallet } from 'lucide-react'
import type { RevenueOverview, RevenuePeriod } from '../../api'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'

type Props = {
  data: RevenueOverview
  period: RevenuePeriod
  onPeriodChange: (period: RevenuePeriod) => void
  loading: boolean
  error: string
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const wholeCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
})
const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
})
const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const TICK_COUNT = 4

function bucketLabel(start: string, period: RevenuePeriod) {
  return period === 'WEEK'
    ? `${start.slice(8, 10)}/${start.slice(5, 7)}`
    : `${months[Number(start.slice(5, 7)) - 1]}/${start.slice(2, 4)}`
}

// Arredonda o topo do eixo para que as quatro divisões caiam em valores fáceis de ler.
function axisMaximum(cents: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(cents, 100)))
  const step = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10].find(factor => factor * magnitude >= cents) ?? 10
  return step * magnitude
}

// Curva suave que nunca passa dos valores reais: sem picos falsos nem faturamento negativo.
function smoothPath(points: { x: number; y: number }[]) {
  const slopes = points.slice(1).map((point, index) =>
    (point.y - points[index].y) / (point.x - points[index].x))
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === points.length - 1) return slopes[index - 1]
    const before = slopes[index - 1]
    const after = slopes[index]
    return before * after <= 0 ? 0 : 2 * before * after / (before + after)
  })
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x} ${point.y}`
    const previous = points[index - 1]
    const third = (point.x - previous.x) / 3
    return `${path} C${previous.x + third} ${previous.y + tangents[index - 1] * third} ${point.x - third} ${point.y - tangents[index] * third} ${point.x} ${point.y}`
  }, '')
}

export function RevenueChart({ data, period, onPeriodChange, loading, error }: Props) {
  const totals = data.buckets.map(bucket => bucket.totalPaidCents)
  const highest = Math.max(0, ...totals)
  const maximum = axisMaximum(highest)
  const paid = totals.filter(total => total > 0)
  const sum = paid.reduce((total, value) => total + value, 0)
  const animatedSum = useAnimatedNumber(sum)
  const best = data.buckets.find(bucket => bucket.totalPaidCents === highest && highest > 0)
  const latestPaid = [...data.buckets].reverse().find(bucket => bucket.totalPaidCents > 0)
  const unit = data.period === 'WEEK' ? 'semana' : 'mês'
  const points = data.buckets.map((bucket, index) => ({
    x: (index + 0.5) / data.buckets.length * 100,
    y: 100 - bucket.totalPaidCents / maximum * 100,
  }))
  const line = points.length > 1 ? smoothPath(points) : ''
  const area = line && `${line} L${points[points.length - 1].x} 100 L${points[0].x} 100 Z`

  return (
    <section className="panel overview-revenue" aria-labelledby="overview-revenue-title" aria-busy={loading}>
      <div className="overview-revenue-header">
        <div>
          <span className="eyebrow">FATURAMENTO</span>
          <h2 id="overview-revenue-title">Faturamento por {unit}</h2>
          <p>Totais pagos nos pedidos do checkout nos últimos 12 períodos.</p>
        </div>
        <div className="overview-revenue-period-selector" role="group" aria-label="Agrupar faturamento por">
          <button type="button" aria-pressed={period === 'WEEK'}
            onClick={() => onPeriodChange('WEEK')}>Semana</button>
          <button type="button" aria-pressed={period === 'MONTH'}
            onClick={() => onPeriodChange('MONTH')}>Mês</button>
        </div>
      </div>

      {error && <p className="overview-rentals-feedback error" role="alert">{error}</p>}
      {loading && <span className="sr-only" role="status">Atualizando faturamento...</span>}
      {!data.hasData ? (
        <div className={`overview-rentals-empty overview-revenue-empty${loading ? ' is-loading' : ''}`}>
          <Wallet size={24} />
          <p>Ainda não há valores pagos registrados neste período. O gráfico aparecerá quando os pedidos tiverem total pago e data do pagamento.</p>
        </div>
      ) : (
        <>
          <dl className="overview-revenue-stats">
            <div>
              <span className="row-icon"><Wallet size={18} /></span>
              <dt>Total nos 12 períodos</dt>
              <dd>{currency.format(animatedSum / 100)}</dd>
            </div>
            <div>
              <span className="row-icon"><Trophy size={18} /></span>
              <dt>Melhor {unit}</dt>
              <dd>{best ? bucketLabel(best.start, data.period) : '—'}
                {best && <small>{currency.format(best.totalPaidCents / 100)}</small>}</dd>
            </div>
            <div>
              <span className="row-icon"><TrendingUp size={18} /></span>
              <dt>Média com faturamento</dt>
              <dd>{currency.format(paid.length ? sum / paid.length / 100 : 0)}</dd>
            </div>
            <div>
              <span className="row-icon"><CalendarCheck size={18} /></span>
              <dt>Períodos com faturamento</dt>
              <dd>{paid.length}<small>de {data.buckets.length}</small></dd>
            </div>
          </dl>
          <div className={`overview-revenue-scroll${loading ? ' is-loading' : ''}`}>
            <div className="overview-revenue-chart">
              <div className="overview-revenue-grid" aria-hidden="true">
                {Array.from({ length: TICK_COUNT + 1 }, (_, tick) => (
                  <span key={tick} style={{ bottom: `${tick / TICK_COUNT * 100}%` }}>
                    {compactCurrency.format(maximum * tick / TICK_COUNT / 100)}
                  </span>
                ))}
              </div>
              <div className="overview-revenue-plot-area" key={data.period}>
                <svg className="overview-revenue-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="overview-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#1a9baa" stopOpacity="0.32" />
                      <stop offset="1" stopColor="#1a9baa" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={area} fill="url(#overview-revenue-fill)" />
                  <path className="overview-revenue-line" d={line} />
                </svg>
                <div className="overview-revenue-columns">
                  {data.buckets.map((bucket, index) => {
                    const label = bucketLabel(bucket.start, data.period)
                    const amount = bucket.totalPaidCents / 100
                    const fullValue = currency.format(amount)
                    const labeled = bucket === best || bucket === latestPaid
                    const className = ['overview-revenue-column',
                      bucket === best && 'best', amount === 0 && 'empty'].filter(Boolean).join(' ')
                    return (
                      <div className={className} key={bucket.start} role="img" tabIndex={0}
                        aria-label={`${label}: ${fullValue}`}
                        style={{ '--i': index, '--height': `${bucket.totalPaidCents / maximum * 100}%` } as React.CSSProperties}>
                        <span className="overview-revenue-crosshair" />
                        <span className="overview-revenue-dot" />
                        {labeled && <span className="overview-revenue-value">{wholeCurrency.format(amount)}</span>}
                        <span className="overview-revenue-tooltip" aria-hidden="true">
                          <small>{label}</small><strong>{fullValue}</strong>
                        </span>
                        <span className="overview-revenue-label">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

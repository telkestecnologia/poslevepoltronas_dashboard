import { Wallet } from 'lucide-react'
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

// Arredonda o topo do eixo para que as linhas de grade caiam em valores fáceis de ler.
function axisMaximum(cents: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(cents, 100)))
  const step = [1, 2, 4, 6, 8, 10].find(factor => factor * magnitude >= cents) ?? 10
  return step * magnitude
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
            <div><dt>Total nos 12 períodos</dt><dd>{currency.format(animatedSum / 100)}</dd></div>
            <div><dt>Melhor {unit}</dt>
              <dd>{best ? bucketLabel(best.start, data.period) : '—'}
                {best && <small>{currency.format(best.totalPaidCents / 100)}</small>}</dd></div>
            <div><dt>Média com faturamento</dt><dd>{currency.format(paid.length ? sum / paid.length / 100 : 0)}</dd></div>
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
              <div className="overview-revenue-columns" key={data.period}>
                {data.buckets.map((bucket, index) => {
                  const amount = bucket.totalPaidCents / 100
                  const label = bucketLabel(bucket.start, data.period)
                  const fullValue = currency.format(amount)
                  const height = bucket.totalPaidCents / maximum * 100
                  const labeled = bucket === best || bucket === latestPaid
                  return (
                    <div className={`overview-revenue-column${bucket === best ? ' best' : ''}`} key={bucket.start}
                      role="img" tabIndex={0} aria-label={`${label}: ${fullValue}`}
                      style={{ '--i': index, '--height': `${height}%` } as React.CSSProperties}>
                      <div className="overview-revenue-plot">
                        <span className="overview-revenue-bar" />
                        {labeled && <span className="overview-revenue-value">{compactCurrency.format(amount)}</span>}
                        <span className="overview-revenue-tooltip" aria-hidden="true">
                          <small>{label}</small><strong>{fullValue}</strong>
                        </span>
                      </div>
                      <span className="overview-revenue-label">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

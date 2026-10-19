import { Wallet } from 'lucide-react'
import type { RevenueOverview, RevenuePeriod } from '../../api'

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

function bucketLabel(start: string, period: RevenuePeriod) {
  return period === 'WEEK'
    ? `${start.slice(8, 10)}/${start.slice(5, 7)}`
    : `${months[Number(start.slice(5, 7)) - 1]}/${start.slice(2, 4)}`
}

export function RevenueChart({ data, period, onPeriodChange, loading, error }: Props) {
  const maximum = Math.max(1, ...data.buckets.map(bucket => bucket.totalPaidCents))

  return (
    <section className="panel overview-revenue" aria-labelledby="overview-revenue-title" aria-busy={loading}>
      <div className="overview-revenue-header">
        <div>
          <span className="eyebrow">FATURAMENTO</span>
          <h2 id="overview-revenue-title">Faturamento por {data.period === 'WEEK' ? 'semana' : 'mês'}</h2>
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
        <div className={`overview-revenue-scroll${loading ? ' is-loading' : ''}`}>
          <div className="overview-revenue-columns">
            {data.buckets.map(bucket => {
              const amount = bucket.totalPaidCents / 100
              const label = bucketLabel(bucket.start, data.period)
              const fullValue = currency.format(amount)
              return (
                <div className="overview-revenue-column" key={bucket.start} role="img"
                  aria-label={`${label}: ${fullValue}`} title={`${label}: ${fullValue}`}>
                  <span className="overview-revenue-value">{compactCurrency.format(amount)}</span>
                  <div className="overview-revenue-plot">
                    <span className="overview-revenue-bar"
                      style={{ height: `${bucket.totalPaidCents / maximum * 100}%` }} />
                  </div>
                  <span className="overview-revenue-label">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

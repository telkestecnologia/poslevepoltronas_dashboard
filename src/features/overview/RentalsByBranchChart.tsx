import { Armchair, MapPin } from 'lucide-react'
import type { RentalOverview } from '../../api'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { RentalDatePicker } from './RentalDatePicker'

type Props = {
  data: RentalOverview['rentedChairsByBranch']
  date: string
  onDateChange: (date: string) => void
  loading: boolean
  error: string
}

// Acima disso os ícones ficam pequenos demais para contar, e o cartão usa uma barra.
const MAX_CHAIR_ICONS = 24

function chairs(count: number) {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'poltrona' : 'poltronas'}`
}

function occupancy(rented: number, total: number) {
  return total > 0 ? Math.min(100, rented / total * 100) : 0
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
}

export function RentalsByBranchChart({ data, date, onDateChange, loading, error }: Props) {
  const branches = onlyOfficialBranches(data, branch => branch.branchName)
  const rented = branches.reduce((sum, branch) => sum + branch.rentedChairs, 0)
  const total = branches.reduce((sum, branch) => sum + branch.totalChairs, 0)
  const free = Math.max(0, total - rented)
  const rate = occupancy(rented, total)
  const animatedRate = useAnimatedNumber(rate)

  return (
    <section className="panel overview-rentals" aria-labelledby="overview-rentals-title" aria-busy={loading}>
      <div className="overview-rentals-header">
        <div>
          <span className="eyebrow">ALUGUÉIS POR DATA</span>
          <h2 id="overview-rentals-title">Poltronas alugadas por filial</h2>
          <p>Poltronas alugadas no dia escolhido, incluindo pedidos já concluídos.</p>
        </div>
        <div className="overview-rentals-controls">
          <RentalDatePicker date={date} onChange={onDateChange} />
        </div>
      </div>

      {loading && <p className="overview-rentals-feedback" role="status">Atualizando gráfico...</p>}
      {error && <p className="overview-rentals-feedback error" role="alert">{error}</p>}

      {branches.length === 0 ? (
        <div className="overview-rentals-empty">
          <Armchair size={24} />
          <p>Cadastre uma filial para acompanhar os aluguéis neste gráfico.</p>
        </div>
      ) : (
        <div className={`overview-rentals-body${loading ? ' is-loading' : ''}`}>
          <div className="overview-rentals-summary">
            <div className="overview-rentals-donut" role="img"
              aria-label={`Ocupação geral de ${Math.round(rate)}%: ${chairs(rented)} de ${total.toLocaleString('pt-BR')}`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="overview-rentals-donut-track" cx="60" cy="60" r="50" />
                {animatedRate >= 0.5 && <circle className="overview-rentals-donut-value" cx="60" cy="60" r="50"
                  pathLength={100} strokeDasharray={`${animatedRate} 100`} />}
              </svg>
              <div>
                <strong>{Math.round(animatedRate)}%</strong>
                <span>de ocupação</span>
              </div>
            </div>
            <ul className="overview-rentals-legend">
              <li><i className="rented" /> Alugadas <strong>{rented.toLocaleString('pt-BR')}</strong></li>
              <li><i className="free" /> Livres <strong>{free.toLocaleString('pt-BR')}</strong></li>
            </ul>
            <p className="overview-rentals-reading">
              {rented === 0
                ? `Em ${dateLabel(date)}, nenhuma das ${chairs(total)} do estoque está alugada.`
                : `Em ${dateLabel(date)}, ${chairs(rented)} de ${total.toLocaleString('pt-BR')} ${rented === 1 ? 'está alugada' : 'estão alugadas'}.`}
            </p>
          </div>

          <div className="overview-rentals-branches">
            {branches.map((branch, index) => {
              const branchRate = occupancy(branch.rentedChairs, branch.totalChairs)
              const branchFree = Math.max(0, branch.totalChairs - branch.rentedChairs)
              const name = branchLabel(branch.branchName)
              return (
                <article className="overview-rentals-branch" key={branch.branchId}
                  style={{ '--i': index } as React.CSSProperties}>
                  <header>
                    <span className="row-icon"><MapPin size={17} /></span>
                    <h3>{name}</h3>
                    <strong>{Math.round(branchRate)}%</strong>
                  </header>
                  {branch.totalChairs <= MAX_CHAIR_ICONS ? (
                    <div className="overview-rentals-chairs" role="img"
                      aria-label={`${name}: ${chairs(branch.rentedChairs)} de ${branch.totalChairs.toLocaleString('pt-BR')}`}>
                      {Array.from({ length: branch.totalChairs }, (_, chair) => (
                        <Armchair key={chair} size={20} strokeWidth={1.9}
                          className={chair < branch.rentedChairs ? 'rented' : ''}
                          style={{ '--chair': chair } as React.CSSProperties} />
                      ))}
                    </div>
                  ) : (
                    <div className="overview-rentals-meter" role="img"
                      aria-label={`${name}: ${chairs(branch.rentedChairs)} de ${branch.totalChairs.toLocaleString('pt-BR')}`}>
                      <span style={{ width: `${branchRate}%` }} />
                    </div>
                  )}
                  <p>
                    <b>{branch.rentedChairs.toLocaleString('pt-BR')}</b> {branch.rentedChairs === 1 ? 'alugada' : 'alugadas'}
                    <span aria-hidden="true"> • </span>
                    <b>{branchFree.toLocaleString('pt-BR')}</b> {branchFree === 1 ? 'livre' : 'livres'}
                    <span aria-hidden="true"> • </span>
                    Estoque atual: {branch.totalChairs.toLocaleString('pt-BR')}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

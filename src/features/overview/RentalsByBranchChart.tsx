import { Armchair } from 'lucide-react'
import type { RentalOverview } from '../../api'
import { RentalDatePicker } from './RentalDatePicker'

type Props = {
  data: RentalOverview['rentedChairsByBranch']
  date: string
  onDateChange: (date: string) => void
  loading: boolean
  error: string
}

export function RentalsByBranchChart({ data, date, onDateChange, loading, error }: Props) {
  const rented = data.reduce((sum, branch) => sum + branch.rentedChairs, 0)
  const scale = Math.max(1, ...data.map(branch => branch.rentedChairs))

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
          <div className="overview-rentals-total">
            <strong>{rented.toLocaleString('pt-BR')}</strong>
            <span>{rented === 1 ? 'poltrona alugada' : 'poltronas alugadas'}</span>
          </div>
        </div>
      </div>

      {loading && <p className="overview-rentals-feedback" role="status">Atualizando gráfico...</p>}
      {error && <p className="overview-rentals-feedback error" role="alert">{error}</p>}

      {data.length === 0 ? (
        <div className="overview-rentals-empty">
          <Armchair size={24} />
          <p>Cadastre uma filial para acompanhar os aluguéis neste gráfico.</p>
        </div>
      ) : (
        <>
          {rented === 0 && <p className="overview-rentals-feedback">Nenhuma poltrona alugada na data selecionada.</p>}
          <div className={`overview-rentals-rows${loading ? ' is-loading' : ''}`}>
            {data.map(branch => (
              <div className="overview-rentals-row" key={branch.branchId}>
                <span className="overview-rentals-name" title={branch.branchName}>{branch.branchName}</span>
                <div className="overview-rentals-plot" role="img"
                  aria-label={`${branch.branchName}: ${branch.rentedChairs} ${branch.rentedChairs === 1 ? 'poltrona alugada' : 'poltronas alugadas'}; estoque atual: ${branch.totalChairs}`}>
                  <div className="overview-rentals-bar"
                    style={{ width: `${branch.rentedChairs / scale * 100}%` }} />
                </div>
                <div className="overview-rentals-count">
                  <strong>{branch.rentedChairs.toLocaleString('pt-BR')} <span>{branch.rentedChairs === 1 ? 'alugada' : 'alugadas'}</span></strong>
                  <span className="overview-rentals-stock">Estoque atual: {branch.totalChairs.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

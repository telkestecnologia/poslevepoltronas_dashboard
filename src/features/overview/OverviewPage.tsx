import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import type { RentalOverview, RevenueOverview } from '../../api'
import { onlyOfficialBranches } from '../../utils/branches'
import './attention.css'

type Props = {
  rentals: RentalOverview
  revenue: RevenueOverview
  onRefresh: () => void
  /** "Precisa da sua atenção", logo abaixo dos números. */
  children?: ReactNode
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Visão geral enxuta, igual à do app: dois números do dia e o que precisa de atenção. O detalhe fica em Financeiro e Poltronas. */
export function OverviewPage({ rentals, revenue, onRefresh, children }: Props) {
  const branches = onlyOfficialBranches(rentals.rentedChairsByBranch, branch => branch.branchName)
  const rented = branches.reduce((sum, branch) => sum + branch.rentedChairs, 0)
  const total = branches.reduce((sum, branch) => sum + branch.totalChairs, 0)
  const current = revenue.buckets.at(-1)
  return (
    <>
      <div className="page-heading with-action overview-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO • PÓS LEVE</span>
          <h1>Visão geral</h1>
        </div>
        <button className="button secondary" type="button" onClick={onRefresh}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="overview-stats">
        <div className="panel overview-stat">
          <span>Poltronas alugadas</span><strong>{rented} de {total}</strong><small>hoje</small>
        </div>
        <div className="panel overview-stat">
          <span>Recebido este mês</span><strong>{money.format((current?.totalPaidCents ?? 0) / 100)}</strong><small>até agora</small>
        </div>
      </div>

      {children}
    </>
  )
}

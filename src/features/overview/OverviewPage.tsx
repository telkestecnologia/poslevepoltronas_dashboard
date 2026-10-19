import { RefreshCw } from 'lucide-react'
import type { RentalOverview, RevenueOverview, RevenuePeriod } from '../../api'
import { RentalsByBranchChart } from './RentalsByBranchChart'
import { RevenueChart } from './RevenueChart'

type Props = {
  rentals: RentalOverview
  rentalDate: string
  onRentalDateChange: (date: string) => void
  rentalLoading: boolean
  rentalError: string
  revenue: RevenueOverview
  revenuePeriod: RevenuePeriod
  onRevenuePeriodChange: (period: RevenuePeriod) => void
  revenueLoading: boolean
  revenueError: string
  onRefresh: () => void
}

export function OverviewPage({ rentals, rentalDate, onRentalDateChange, rentalLoading, rentalError,
  revenue, revenuePeriod, onRevenuePeriodChange, revenueLoading, revenueError, onRefresh }: Props) {
  return (
    <>
      <div className="page-heading with-action overview-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO • PÓS LEVE</span>
          <h1>Visão geral</h1>
          <p>Acompanhe os aluguéis e o faturamento por período.</p>
        </div>
        <button className="button secondary" type="button" onClick={onRefresh}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <RentalsByBranchChart data={rentals.rentedChairsByBranch}
        date={rentalDate} onDateChange={onRentalDateChange}
        loading={rentalLoading} error={rentalError} />

      <RevenueChart data={revenue} period={revenuePeriod}
        onPeriodChange={onRevenuePeriodChange}
        loading={revenueLoading} error={revenueError} />
    </>
  )
}

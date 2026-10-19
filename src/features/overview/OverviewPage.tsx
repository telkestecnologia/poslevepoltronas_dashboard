import {
  Armchair,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  PackageCheck,
  PauseCircle,
  RefreshCw,
  Truck,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { ChairStatus, OrderStatus, Overview } from '../../api'
import { RentalsByBranchChart } from './RentalsByBranchChart'

type Props = {
  overview: Overview
  rentalDate: string
  onRentalDateChange: (date: string) => void
  rentalLoading: boolean
  rentalError: string
  onRefresh: () => void
  onGoChairs: (status: ChairStatus | 'ALL') => void
  onGoOrders: (status: OrderStatus) => void
}

type Metric<Status> = {
  label: string
  value: number
  detail: string
  icon: LucideIcon
  tone: string
  status: Status
}

function MetricCard<Status>({ metric, onClick }: { metric: Metric<Status>; onClick: () => void }) {
  const Icon = metric.icon
  return (
    <button type="button" className={`panel overview-card ${metric.tone}`} onClick={onClick}>
      <span className="overview-card-icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="overview-card-label">{metric.label}</span>
      <strong>{metric.value.toLocaleString('pt-BR')}</strong>
      <span className="overview-card-detail">{metric.detail}</span>
      <ArrowUpRight className="overview-card-arrow" size={18} aria-hidden="true" />
    </button>
  )
}

export function OverviewPage({ overview, rentalDate, onRentalDateChange, rentalLoading, rentalError,
  onRefresh, onGoChairs, onGoOrders }: Props) {
  const activePercent =
    overview.totalChairs === 0
      ? 0
      : Math.round((overview.activeChairs / overview.totalChairs) * 100)
  const chairs: Metric<ChairStatus | 'ALL'>[] = [
    {
      label: 'Total de poltronas',
      value: overview.totalChairs,
      detail: 'No estoque cadastrado',
      icon: Armchair,
      tone: 'teal',
      status: 'ALL',
    },
    {
      label: 'Ativas',
      value: overview.activeChairs,
      detail: `${activePercent}% do estoque`,
      icon: CheckCircle2,
      tone: 'green',
      status: 'ACTIVE',
    },
    {
      label: 'Em manutenção',
      value: overview.maintenanceChairs,
      detail: 'Precisam de revisão',
      icon: Wrench,
      tone: 'amber',
      status: 'MAINTENANCE',
    },
    {
      label: 'Inativas',
      value: overview.inactiveChairs,
      detail: 'Fora de operação',
      icon: PauseCircle,
      tone: 'slate',
      status: 'INACTIVE',
    },
  ]
  const orders: Metric<OrderStatus>[] = [
    {
      label: 'Pagamento confirmado',
      value: overview.paymentConfirmedOrders,
      detail: 'Aguardando próxima etapa',
      icon: CreditCard,
      tone: 'blue',
      status: 'PAYMENT_CONFIRMED',
    },
    {
      label: 'Entregas pendentes',
      value: overview.pendingDeliveries,
      detail: 'Aguardando entrega',
      icon: Truck,
      tone: 'amber',
      status: 'DELIVERY_PENDING',
    },
    {
      label: 'Em uso',
      value: overview.chairsInUse,
      detail: 'Poltronas com clientes',
      icon: Clock3,
      tone: 'teal',
      status: 'IN_USE',
    },
    {
      label: 'Retiradas pendentes',
      value: overview.pendingPickups,
      detail: 'Aguardando retirada',
      icon: PackageCheck,
      tone: 'blue',
      status: 'PICKUP_PENDING',
    },
  ]
  const completed: Metric<OrderStatus> = {
    label: 'Pedidos concluídos',
    value: overview.completedOrders,
    detail: 'Pedidos reais finalizados',
    icon: ClipboardCheck,
    tone: 'green',
    status: 'COMPLETED',
  }

  return (
    <>
      <div className="page-heading with-action overview-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO • PÓS LEVE</span>
          <h1>Visão geral</h1>
          <p>Um panorama rápido do estoque, dos pedidos e das vendas.</p>
        </div>
        <button className="button secondary" type="button" onClick={onRefresh}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <RentalsByBranchChart data={overview.rentedChairsByBranch}
        date={rentalDate} onDateChange={onRentalDateChange}
        loading={rentalLoading} error={rentalError} />

      <section className="overview-section" aria-labelledby="overview-chairs-title">
        <div className="overview-section-head">
          <div>
            <h2 id="overview-chairs-title">Poltronas</h2>
            <p>Condição atual do estoque.</p>
          </div>
        </div>
        <div className="overview-grid">
          {chairs.map((metric) => (
            <MetricCard key={metric.label} metric={metric} onClick={() => onGoChairs(metric.status)} />
          ))}
        </div>
      </section>

      <section className="overview-section" aria-labelledby="overview-orders-title">
        <div className="overview-section-head">
          <div>
            <h2 id="overview-orders-title">Pedidos em andamento</h2>
            <p>Somente pedidos reais; demonstrações não entram nestes números.</p>
          </div>
        </div>
        <div className="overview-grid">
          {orders.map((metric) => (
            <MetricCard key={metric.label} metric={metric} onClick={() => onGoOrders(metric.status)} />
          ))}
        </div>
      </section>

      <section className="overview-section" aria-labelledby="overview-finance-title">
        <div className="overview-section-head">
          <div>
            <h2 id="overview-finance-title">Financeiro</h2>
            <p>Acompanhamento das vendas.</p>
          </div>
        </div>
        <div className="overview-grid overview-finance-grid">
          <MetricCard
            metric={completed}
            onClick={() => onGoOrders(completed.status)}
          />
          <div className="panel overview-card overview-finance-card slate">
            <span className="overview-card-icon">
              <Wallet size={22} strokeWidth={1.8} />
            </span>
            <span className="overview-card-label">Receita de vendas</span>
            <strong>—</strong>
            <span className="overview-card-detail">Sem total pago registrado nos pedidos</span>
          </div>
        </div>
      </section>
    </>
  )
}

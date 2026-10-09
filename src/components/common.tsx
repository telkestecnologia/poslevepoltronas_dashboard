import { Armchair, Plus } from 'lucide-react'
import type { ChairStatus } from '../api'

const statusLabels: Record<ChairStatus, string> = {
  ACTIVE: 'Ativa',
  MAINTENANCE: 'Em manutenção',
  INACTIVE: 'Inativa',
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand${compact ? ' brand-compact' : ''}`}>
      <img src="/logo-pos-leve-icon.webp" alt="" />
      <strong>Pós Leve</strong>
    </div>
  )
}

export function StatusBadge({ status }: { status: ChairStatus }) {
  return (
    <span className={`status-badge ${status.toLowerCase()}`}>
      <i />
      {statusLabels[status]}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Armchair
  title: string
  text: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={26} strokeWidth={1.7} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={action.onClick}>
          <Plus size={17} /> {action.label}
        </button>
      )}
    </div>
  )
}

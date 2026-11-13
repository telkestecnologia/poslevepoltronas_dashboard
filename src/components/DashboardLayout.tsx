import { useState, type ReactNode } from 'react'
import {
  Check,
  ChevronRight,
  Home,
  LogOut,
  MapPin,
  MessagesSquare,
  ClipboardList,
  Sparkles,
  Menu,
  Users,
  Wallet,
  BadgeDollarSign,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import './nav-count.css'
import type { Staff } from '../api'
import type { Page } from '../types'
import { Brand } from './common'

const navigation = [
  { page: 'overview', label: 'Visão geral', icon: Home },
  { page: 'finance', label: 'Financeiro', icon: Wallet },
  { page: 'branches', label: 'Filiais', icon: MapPin },
  { page: 'agenda', label: 'Pedidos', icon: ClipboardList },
  { page: 'conversations', label: 'Atendimento', icon: MessagesSquare },
  { page: 'ai', label: 'O que a Isa sabe', icon: Sparkles },
  { page: 'payments', label: 'Pagamentos e preços', icon: BadgeDollarSign },
  { page: 'profile', label: 'Perfil e equipe', icon: Users },
] as const

type Props = {
  staff: Staff
  page: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  notice: string
  onDismissNotice: () => void
  /** Nível extra no caminho do topo, ex.: o acompanhamento de um pedido. */
  crumb?: string
  /** Menus com novidade desde a última visita (círculo vermelho). */
  badges?: ReadonlySet<Page>
  /** Números em vermelho: conversas para responder e poltronas para entregar. */
  counts?: Partial<Record<Page, number>>
  children: ReactNode
}

export function DashboardLayout({
  staff,
  page,
  onNavigate,
  onLogout,
  notice,
  onDismissNotice,
  crumb,
  badges,
  counts,
  children,
}: Props) {
  const hasNews = !!badges && badges.size > 0
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const currentPage = navigation.find((item) => item.page === page)

  function navigate(nextPage: Page) {
    onNavigate(nextPage)
    setMobileOpen(false)
  }

  return (
    <div className="dashboard-shell">
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="dashboard-sidebar"
        className={`sidebar${mobileOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="sidebar-collapse icon-button"
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-controls="dashboard-sidebar"
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button
            className="mobile-close icon-button"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-section-label">MENU PRINCIPAL</div>
        <nav className="main-nav" aria-label="Menu principal">
          {navigation.map((item) => (
            <button
              key={item.page}
              className={`nav-item${page === item.page ? ' selected' : ''}`}
              aria-label={counts?.[item.page] ? `${item.label} (${counts[item.page]})` : badges?.has(item.page) ? `${item.label} (novidades)` : item.label}
              aria-current={page === item.page ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => navigate(item.page)}
            >
              <item.icon size={20} strokeWidth={1.9} />
              <span>{item.label}</span>
              {counts?.[item.page] ? <i className="nav-count" aria-hidden="true">{counts[item.page]! > 99 ? '99+' : counts[item.page]}</i>
                : badges?.has(item.page) && <i className="nav-badge" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-user" onClick={onLogout} title="Sair do painel">
          {/* A mesma logo sem fundo da tela de login. */}
          <img src="/logo-pos-leve-icon.webp" alt="Pós Leve" width={34} height={34}
            style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} />
          <span>
            <strong>{staff.displayName}</strong>
            <small>{staff.role === 'MEMBER' ? 'Parceiro' : 'Administrador'}</small>
          </span>
          <LogOut size={18} />
        </button>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              aria-label={hasNews ? 'Abrir menu (há novidades)' : 'Abrir menu'}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={23} />
              {hasNews && <i className="nav-badge menu-badge" aria-hidden="true" />}
            </button>
            <div className="breadcrumbs">
              Painel <ChevronRight size={14} />
              {crumb ? <>
                <button type="button" className="breadcrumb-link" onClick={() => navigate(page)}>{currentPage?.label}</button>
                <ChevronRight size={14} /> <strong>{crumb}</strong>
              </> : <strong>{currentPage?.label ?? (page === 'couriers' ? 'Entregadores' : '')}</strong>}
            </div>
          </div>
        </header>
        <main className="content">
          {page !== 'overview' && notice && (
            <div className="toast" role="status">
              <Check size={18} />
              {notice}
              <button aria-label="Fechar mensagem" onClick={onDismissNotice}>
                <X size={16} />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

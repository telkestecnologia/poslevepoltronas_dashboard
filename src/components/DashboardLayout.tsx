import { useState, type ReactNode } from 'react'
import {
  Armchair,
  Check,
  ChevronRight,
  Home,
  LogOut,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import type { Staff } from '../api'
import type { Page } from '../types'
import { Brand } from './common'

const navigation = [
  { page: 'overview', label: 'Visão geral', icon: Home },
  { page: 'chairs', label: 'Poltronas', icon: Armchair },
  { page: 'branches', label: 'Filiais', icon: MapPin },
] as const

type Props = {
  staff: Staff
  page: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  notice: string
  onDismissNotice: () => void
  children: ReactNode
}

export function DashboardLayout({
  staff,
  page,
  onNavigate,
  onLogout,
  notice,
  onDismissNotice,
  children,
}: Props) {
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
              aria-label={item.label}
              aria-current={page === item.page ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => navigate(item.page)}
            >
              <item.icon size={20} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-user" onClick={onLogout} title="Sair do painel">
          <span className="avatar">{staff.displayName.charAt(0)}</span>
          <span>
            <strong>{staff.displayName}</strong>
            <small>Administrador</small>
          </span>
          <LogOut size={18} />
        </button>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={23} />
            </button>
            <div className="breadcrumbs">
              Painel <ChevronRight size={14} /> <strong>{currentPage?.label}</strong>
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

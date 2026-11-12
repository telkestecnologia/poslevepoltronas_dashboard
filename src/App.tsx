import { DashboardLayout } from './components/DashboardLayout'
import { Login } from './components/Login'
import { BranchModal } from './features/branches/BranchModal'
import { BranchesPage } from './features/branches/BranchesPage'
import { ChairModal } from './features/chairs/ChairModal'
import { ChairsPage } from './features/chairs/ChairsPage'
import { CourierModal } from './features/couriers/CourierModal'
import { CouriersPage } from './features/couriers/CouriersPage'
import { OrdersPage } from './features/orders/OrdersPage'
import { OrderDetailPage } from './features/orders/OrderDetailPage'
import { AgendaPage } from './features/agenda/AgendaPage'
import { AiContextPage } from './features/ai/AiContextPage'
import { OverviewPage } from './features/overview/OverviewPage'
import { AiAlertsTab, NotificationsPage } from './features/notifications/NotificationsPage'
import { FinancePage } from './features/finance/FinancePage'
import { ConversationsPage } from './features/conversations/ConversationsPage'
import { AttentionPanel } from './features/overview/AttentionPanel'
import { ProfilePage } from './features/profile/ProfilePage'
import { PaymentsPricingPage } from './features/payments/PaymentsPricingPage'
import { useDashboard } from './hooks/useDashboard'
import { useMenuBadges } from './hooks/useMenuBadges'

function App() {
  const {
    session,
    navigation,
    feedback,
    overviewPage,
    chairsPage,
    branchesPage,
    couriersPage,
    aiPage,
    notificationsPage,
    dialog,
  } = useDashboard()
  const badges = useMenuBadges(session.staff ? session.credentials : null, session.staff?.email ?? '', navigation.page)

  if (session.restoring) {
    return <div className="empty-state" role="status"><p>Entrando no painel...</p></div>
  }

  if (session.credentials === null || !session.staff) {
    return (
      <Login
        onLogin={session.login}
        busy={session.loginBusy}
        error={session.loginError}
      />
    )
  }

  const { page, route, params, navigate } = navigation
  const { pageLoading, pageError, retryPage, notice, dismissNotice, loadedPage } = feedback
  const selfLoading = ['finance', 'conversations', 'profile', 'orders', 'agenda', 'payments'].includes(page)
  // loadedPage evita mostrar por um instante os dados antigos ao voltar/avançar pelo navegador.
  const showLoading = !selfLoading && (pageLoading || (loadedPage !== page && !pageError)
    || (page === 'overview' && (!overviewPage.rentals || !overviewPage.revenue) && !pageError))
  const openOrder = (id: string) => navigate('orders', { id })
  // Volta para a lista com os mesmos filtros quando o pedido foi aberto dela; senão, abre a lista.
  const backToOrders = () => {
    if (window.history.state?.fromOrders) window.history.back()
    else navigate('orders', { replace: true })
  }

  const partner = session.staff.role === 'MEMBER'

  return (
    <div className={partner ? 'is-partner' : undefined}>
      <DashboardLayout
        staff={session.staff}
        page={page}
        onNavigate={navigate}
        onLogout={session.logout}
        crumb={page === 'orders' && route.id ? 'Acompanhamento' : undefined}
        badges={badges}
        notice={notice}
        onDismissNotice={dismissNotice}
      >
        {showLoading && (
          <div className="empty-state" role="status">
            <p>Carregando dados...</p>
          </div>
        )}
        {!showLoading && pageError && (
          <div className="empty-state" role="alert">
            <p>{pageError}</p>
            <button className="button primary" onClick={retryPage}>
              Tentar novamente
            </button>
          </div>
        )}
        {page === 'overview' && !showLoading && !pageError && overviewPage.rentals && overviewPage.revenue && (
          <OverviewPage
            rentals={overviewPage.rentals}
            revenue={overviewPage.revenue}
            onRefresh={overviewPage.onRefresh}
          >
            <AttentionPanel credentials={session.credentials}
              onOpen={target => navigate(target.page, { id: target.id, chairStatus: target.chairStatus })} />
          </OverviewPage>
        )}
        {page === 'finance' && <FinancePage credentials={session.credentials} />}
        {page === 'chairs' && !showLoading && !pageError && <ChairsPage {...chairsPage} />}
        {page === 'branches' && !showLoading && !pageError && <BranchesPage {...branchesPage} />}
        {page === 'couriers' && !showLoading && !pageError && <CouriersPage {...couriersPage} />}
        {page === 'agenda' && <AgendaPage credentials={session.credentials} onOpenOrder={openOrder} />}
        {page === 'orders' && !route.id && <OrdersPage credentials={session.credentials} params={params}
          onOpenOrder={id => navigate('orders', { id, fromList: true })} />}
        {page === 'orders' && route.id && <OrderDetailPage key={route.id} credentials={session.credentials} id={route.id}
          onBack={backToOrders} />}
        {page === 'conversations' && <ConversationsPage credentials={session.credentials} selectedId={route.id ?? null}
          onSelect={id => navigate('conversations', { id: id ?? undefined, replace: Boolean(route.id) })} />}
        {page === 'payments' && <PaymentsPricingPage credentials={session.credentials} />}
        {page === 'profile' && <ProfilePage credentials={session.credentials} onCredentialsChanged={session.login} partner={partner} />}
        {page === 'ai' && !showLoading && !pageError && <AiContextPage {...aiPage} alerts={<AiAlertsTab credentials={session.credentials} />} />}
        {page === 'notifications' && !showLoading && !pageError && notificationsPage.settings && (
          <NotificationsPage settings={notificationsPage.settings} onSave={notificationsPage.onSave} />
        )}
      </DashboardLayout>

      {dialog.modal &&
        (dialog.modal.kind === 'newBranch' || dialog.modal.kind === 'editBranch' ? (
          <BranchModal
            modal={dialog.modal}
            municipalities={dialog.municipalities}
            saving={dialog.saving}
            error={dialog.error}
            onClose={dialog.closeModal}
            onSave={dialog.saveBranch}
          />
        ) : dialog.modal.kind === 'newCourier' || dialog.modal.kind === 'editCourier' ? (
          <CourierModal
            modal={dialog.modal}
            saving={dialog.saving}
            error={dialog.error}
            onClose={dialog.closeModal}
            onSave={dialog.saveCourier}
          />
        ) : (
          <ChairModal
            modal={dialog.modal}
            branches={dialog.branches}
            saving={dialog.saving}
            error={dialog.error}
            onClose={dialog.closeModal}
            onChairSave={dialog.saveChair}
          />
        ))}
    </div>
  )
}

export default App

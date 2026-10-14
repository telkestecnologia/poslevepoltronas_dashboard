import { localLoginBypass } from './api'
import { DashboardLayout } from './components/DashboardLayout'
import { Login } from './components/Login'
import { BranchModal } from './features/branches/BranchModal'
import { BranchesPage } from './features/branches/BranchesPage'
import { ChairModal } from './features/chairs/ChairModal'
import { ChairsPage } from './features/chairs/ChairsPage'
import { CourierModal } from './features/couriers/CourierModal'
import { CouriersPage } from './features/couriers/CouriersPage'
import { OrdersPage } from './features/orders/OrdersPage'
import { AiContextPage } from './features/ai/AiContextPage'
import { OverviewPage } from './features/overview/OverviewPage'
import { useDashboard } from './hooks/useDashboard'

function App() {
  const {
    session,
    navigation,
    feedback,
    overviewPage,
    chairsPage,
    branchesPage,
    couriersPage,
    ordersPage,
    aiPage,
    dialog,
  } = useDashboard()

  if (session.credentials === null || !session.staff) {
    return (
      <Login
        onLogin={session.login}
        busy={session.loginBusy}
        error={session.loginError}
        localBypass={localLoginBypass}
      />
    )
  }

  const { page, navigate } = navigation
  const { pageLoading, pageError, retryPage, notice, dismissNotice } = feedback
  const showLoading = pageLoading || (page === 'overview' && !overviewPage.overview && !pageError)

  return (
    <>
      <DashboardLayout
        staff={session.staff}
        page={page}
        onNavigate={navigate}
        onLogout={session.logout}
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
        {page === 'overview' && !showLoading && !pageError && overviewPage.overview && (
          <OverviewPage
            overview={overviewPage.overview}
            onRefresh={overviewPage.onRefresh}
            onGoChairs={overviewPage.onGoChairs}
            onGoOrders={overviewPage.onGoOrders}
          />
        )}
        {page === 'chairs' && !showLoading && !pageError && <ChairsPage {...chairsPage} />}
        {page === 'branches' && !showLoading && !pageError && <BranchesPage {...branchesPage} />}
        {page === 'couriers' && !showLoading && !pageError && <CouriersPage {...couriersPage} />}
        {page === 'orders' && !showLoading && !pageError && <OrdersPage {...ordersPage} />}
        {page === 'ai' && !showLoading && !pageError && <AiContextPage {...aiPage} />}
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
    </>
  )
}

export default App

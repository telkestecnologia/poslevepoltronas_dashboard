import { localLoginBypass } from './api'
import { DashboardLayout } from './components/DashboardLayout'
import { Login } from './components/Login'
import { BranchModal } from './features/branches/BranchModal'
import { BranchesPage } from './features/branches/BranchesPage'
import { ChairModal } from './features/chairs/ChairModal'
import { ChairsPage } from './features/chairs/ChairsPage'
import { useDashboard } from './hooks/useDashboard'

function App() {
  const { session, navigation, feedback, chairsPage, branchesPage, dialog } = useDashboard()

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
        {page !== 'overview' && pageLoading && (
          <div className="empty-state" role="status">
            <p>Carregando dados...</p>
          </div>
        )}
        {page !== 'overview' && !pageLoading && pageError && (
          <div className="empty-state" role="alert">
            <p>{pageError}</p>
            <button className="button primary" onClick={retryPage}>
              Tentar novamente
            </button>
          </div>
        )}
        {page === 'chairs' && !pageLoading && !pageError && <ChairsPage {...chairsPage} />}
        {page === 'branches' && !pageLoading && !pageError && <BranchesPage {...branchesPage} />}
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

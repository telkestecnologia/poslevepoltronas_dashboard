import { useEffect, useState } from 'react'
import { ArrowLeft, Armchair, ChevronRight, MapPin, Plus } from 'lucide-react'
import { api, type Branch, type BranchInput, type Chair, type Municipality } from '../../api'
import { BranchModal } from './BranchModal'
import { EmptyState } from '../../components/common'
import { branchLabel, OFFICIAL_BRANCH_COUNT } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import './branches.css'

type Props = {
  branches: Branch[]
  activeCounts: Record<string, number>
  onNewBranch: () => void
  onEditBranch: (branch: Branch) => void
  onOpenChairs: (branch: Branch) => void
  credentials: string
  municipalities: Municipality[]
  saving: boolean
  formError: string
  onUpdateBranch: (branch: Branch, data: BranchInput) => Promise<void>
  onToggleFreeShipping: (branch: Branch) => Promise<void>
}

export function BranchesPage({ branches, activeCounts, onNewBranch, onToggleFreeShipping, credentials, municipalities, saving, formError, onUpdateBranch }: Props) {
  const [enteredId, setEnteredId] = useState<string | null>(null)
  const entered = branches.find(branch => branch.id === enteredId)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function toggleFreeShipping(branch: Branch) {
    setBusyId(branch.id)
    setError('')
    try {
      await onToggleFreeShipping(branch)
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusyId(null)
    }
  }


  // Dentro da filial (igual ao app): a foto da região ao fundo, Editar filial e Poltronas da filial.
  if (entered) {
    return <>
      <button type="button" className="branch-back" onClick={() => setEnteredId(null)}><ArrowLeft size={16} /> Todas as filiais</button>
      <section className="branch-enter" style={{ backgroundImage: `url(${branchPhoto(entered.name)})` }}>
        <div className="branch-enter-body">
          <h1>{branchLabel(entered.name)}</h1>
          <p>{activeCounts[entered.id] ?? 0} poltronas ativas • {entered.municipalities.length} cidades • {entered.active ? 'Atendendo' : 'Pausada'}</p>
        </div>
      </section>
      {/* Tudo da filial numa página só (igual ao app): os dados (administrador) e as poltronas dela. */}
      <section className="panel branch-section admin-only">
        <h2>Dados da filial</h2>
        <BranchModal key={entered.id} inline modal={{ kind: 'editBranch', branch: entered }} municipalities={municipalities}
          saving={saving} error={formError} onClose={() => {}} onSave={data => onUpdateBranch(entered, data)} />
      </section>
      <section className="panel branch-section">
        <h2>Poltronas da filial</h2>
        <BranchChairs credentials={credentials} branchId={entered.id} />
      </section>
    </>
  }

  return (
    <>
      <div className="page-heading with-action">
        <div>
          <span className="eyebrow">FILIAIS • PÓS LEVE</span>
          <h1>Filiais</h1>
        </div>
        {branches.length < OFFICIAL_BRANCH_COUNT && (
          <button className="button primary admin-only" onClick={onNewBranch}>
            <Plus size={18} /> Nova filial
          </button>
        )}
      </div>
      {error && <div className="form-error branch-page-error" role="alert">{error}</div>}
      <section className="panel table-panel">
        {branches.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Nenhuma filial cadastrada"
            text="Crie uma filial e informe as cidades que ela atende."
            action={{ label: 'Criar filial', onClick: onNewBranch }}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>FILIAL</th>
                  <th>MUNICÍPIOS</th>
                  <th>POLTRONAS ATIVAS</th>
                  <th>ESTADO</th>
                  <th>FRETE GRÁTIS</th>
                  <th>
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <div className="chair-cell">
                        <span className="row-icon">
                          <MapPin size={18} />
                        </span>
                        <strong>{branchLabel(branch.name)}</strong>
                      </div>
                    </td>
                    <td>
                      {branch.municipalities.length}{' '}
                      {branch.municipalities.length === 1 ? 'município' : 'municípios'}
                    </td>
                    <td>{activeCounts[branch.id] ?? 0}</td>
                    <td>{branch.active ? 'Ativa' : 'Inativa'}</td>
                    <td>
                      <button type="button"
                        className={`branch-freight-toggle admin-lock${branch.freeShipping ? ' active' : ''}`}
                        aria-pressed={branch.freeShipping}
                        disabled={busyId !== null}
                        onClick={() => void toggleFreeShipping(branch)}>
                        {busyId === branch.id ? 'Salvando...' : branch.freeShipping ? 'Desativar frete grátis' : 'Ativar frete grátis'}
                      </button>
                    </td>
                    <td>
                      <button className="table-action" disabled={busyId !== null} onClick={() => setEnteredId(branch.id)}>
                        Entrar <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function branchPhoto(name: string) {
  const text = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\bserra\b|\bibiapaba\b/.test(text)) return '/filiais/filial-serra.webp'
  if (/\bsobral\b/.test(text)) return '/filiais/filial-sobral.webp'
  return '/filiais/filial-fortaleza.webp'
}

const chairStatus: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: 'Ativa', tone: 'active' }, MAINTENANCE: { label: 'Em manutenção', tone: 'maintenance' }, INACTIVE: { label: 'Inativa', tone: 'inactive' },
}

/** Poltronas da filial, na própria página da filial. */
function BranchChairs({ credentials, branchId }: { credentials: string; branchId: string }) {
  const [chairs, setChairs] = useState<Chair[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void api.chairs(credentials, { page: 0, size: 100, search: '', status: 'ALL', branchId })
      .then(page => { if (active) setChairs(page.items) })
      .catch(cause => { if (active) setError(getMessage(cause)) })
    return () => { active = false }
  }, [credentials, branchId])
  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!chairs) return <p className="branch-muted">Carregando poltronas...</p>
  if (chairs.length === 0) return <p className="branch-muted">Nenhuma poltrona nesta filial.</p>
  return <div className="branch-chairs">{chairs.map(chair => <div key={chair.id} className={`branch-chair ${chairStatus[chair.status]?.tone ?? ''}`}>
    <span className="branch-chair-icon"><Armchair size={18} /></span>
    <span className="branch-chair-text"><strong>{chair.code}</strong><small>{chair.model}{chair.notes ? ` • ${chair.notes}` : ''}</small></span>
    <span className="branch-chair-status">{chairStatus[chair.status]?.label ?? chair.status}</span>
  </div>)}</div>
}

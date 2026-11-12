import { useState } from 'react'
import { ArrowLeft, Armchair, ChevronRight, MapPin, Pencil, Plus } from 'lucide-react'
import type { Branch } from '../../api'
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
  onToggleFreeShipping: (branch: Branch) => Promise<void>
}

export function BranchesPage({ branches, activeCounts, onNewBranch, onEditBranch, onOpenChairs, onToggleFreeShipping }: Props) {
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
          <div className="branch-enter-actions">
            <button type="button" className="button secondary admin-only" onClick={() => onEditBranch(entered)}><Pencil size={17} /> Editar filial</button>
            <button type="button" className="button primary" onClick={() => onOpenChairs(entered)}><Armchair size={17} /> Poltronas da filial</button>
          </div>
        </div>
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

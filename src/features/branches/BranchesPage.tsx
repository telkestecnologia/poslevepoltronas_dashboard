import { ChevronRight, MapPin, Plus } from 'lucide-react'
import type { Branch } from '../../api'
import { EmptyState } from '../../components/common'

type Props = {
  branches: Branch[]
  activeCounts: Record<string, number>
  onNewBranch: () => void
  onEditBranch: (branch: Branch) => void
}

export function BranchesPage({ branches, activeCounts, onNewBranch, onEditBranch }: Props) {
  return (
    <>
      <div className="page-heading with-action">
        <div>
          <span className="eyebrow">FILIAIS • PÓS LEVE</span>
          <h1>Filiais</h1>
          <p>Cadastre as cidades atendidas por cada filial.</p>
        </div>
        <button className="button primary" onClick={onNewBranch}>
          <Plus size={18} /> Nova filial
        </button>
      </div>
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
                        <strong>{branch.name}</strong>
                      </div>
                    </td>
                    <td>
                      {branch.municipalities.length}{' '}
                      {branch.municipalities.length === 1 ? 'município' : 'municípios'}
                    </td>
                    <td>{activeCounts[branch.id] ?? 0}</td>
                    <td>{branch.active ? 'Ativa' : 'Inativa'}</td>
                    <td>
                      <button className="table-action" onClick={() => onEditBranch(branch)}>
                        Editar <ChevronRight size={16} />
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

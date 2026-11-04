import { Armchair, CheckCircle2, ChevronRight, CircleHelp, MapPin, Plus, Search, Settings2, UserRound, Wrench, type LucideIcon } from 'lucide-react'
import type { Branch, Chair, ChairFilter, ChairOption, ChairSituation, ManualBlock } from '../../api'
import { EmptyState, StatusBadge } from '../../components/common'
import { CHAIR_PAGE_SIZE } from '../../types'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { BlockManager } from './BlockManager'
import './chairs-situation.css'

const situationButtons: { key: ChairFilter; label: string; count: keyof ChairSituation; tone: string; icon: LucideIcon }[] = [
  { key: 'AVAILABLE', label: 'Disponíveis', count: 'available', tone: 'available', icon: CheckCircle2 },
  { key: 'IN_USE', label: 'Em uso', count: 'inUse', tone: 'in-use', icon: UserRound },
  { key: 'MAINTENANCE', label: 'Em manutenção', count: 'maintenance', tone: 'maintenance', icon: Wrench },
]

type Props = {
  chairs: Chair[]
  total: number
  pageIndex: number
  options: ChairOption[]
  blocks: ManualBlock[]
  branches: Branch[]
  loading: boolean
  search: string
  status: ChairFilter
  situation: ChairSituation | null
  branchId: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: ChairFilter) => void
  onBranchChange: (value: string) => void
  onPageChange: (page: number) => void
  onNewChair: () => void
  onEditChair: (chair: Chair) => void
  onGoBranches: () => void
  onCreateBlock: (data: {
    chairId: string
    start: string
    end: string
    reason: string
  }) => Promise<void>
  onDeleteBlock: (id: string) => Promise<void>
}

export function ChairsPage(props: Props) {
  const {
    chairs,
    total,
    pageIndex,
    options,
    blocks,
    branches,
    loading,
    search,
    status,
    situation,
    branchId,
    onSearchChange,
    onStatusChange,
    onBranchChange,
    onPageChange,
    onNewChair,
    onEditChair,
    onGoBranches,
    onCreateBlock,
    onDeleteBlock,
  } = props
  const hasFilters = Boolean(search.trim()) || status !== 'ALL' || branchId !== 'ALL'

  return (
    <>
      <div className="page-heading with-action">
        <div>
          <span className="eyebrow">ESTOQUE • PÓS LEVE</span>
          <h1>Poltronas</h1>
          <p>Cadastre equipamentos e acompanhe sua condição operacional.</p>
        </div>
        <button className="button primary admin-only" onClick={onNewChair} disabled={branches.length === 0}>
          <Plus size={18} /> Nova poltrona
        </button>
      </div>

      <section className="chair-situation" aria-label="Situação das poltronas">
        <h2>Poltronas</h2>
        <div className="chair-situation-buttons">
          {situationButtons.map(button => {
            const selected = status === button.key
            return <button key={button.key} type="button" aria-pressed={selected}
              className={`chair-situation-button tone-${button.tone}${selected ? ' is-selected' : ''}`}
              onClick={() => onStatusChange(selected ? 'ALL' : button.key)}>
              <button.icon size={22} aria-hidden />
              <strong>{situation ? situation[button.count] : 0}</strong>
              <span>{button.label}</span>
            </button>
          })}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={19} />
            <input
              aria-label="Buscar poltrona"
              placeholder="Buscar por código ou modelo"
              value={search}
              maxLength={120}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <div className="select-wrap">
            <MapPin size={17} />
            <select
              aria-label="Filtrar por filial"
              value={branchId}
              onChange={(event) => onBranchChange(event.target.value)}
            >
              <option value="ALL">Todas as filiais</option>
              {onlyOfficialBranches(branches, (branch) => branch.name).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branchLabel(branch.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="select-wrap">
            <Settings2 size={17} />
            <select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(event) => onStatusChange(event.target.value as ChairFilter)}
            >
              <option value="ALL">Todos os estados</option>
              <option value="AVAILABLE">Disponíveis</option>
              <option value="IN_USE">Em uso</option>
              <option value="MAINTENANCE">Em manutenção</option>
              <option value="INACTIVE">Inativas</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state" role="status">
            <p>Carregando poltronas...</p>
          </div>
        ) : total === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              text="Tente outro termo ou altere os filtros."
            />
          ) : (
            <EmptyState
              icon={Armchair}
              title="Nenhuma poltrona cadastrada"
              text={
                branches.length === 0
                  ? 'Cadastre uma filial antes da primeira poltrona.'
                  : 'Cadastre a primeira poltrona para começar a organizar seu estoque.'
              }
              action={
                branches.length > 0
                  ? { label: 'Cadastrar poltrona', onClick: onNewChair }
                  : { label: 'Cadastrar filial', onClick: onGoBranches }
              }
            />
          )
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>POLTRONA</th>
                  <th>MODELO</th>
                  <th>FILIAL</th>
                  <th>ESTADO</th>
                  <th>
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {chairs.map((chair) => (
                  <tr key={chair.id}>
                    <td>
                      <div className="chair-cell">
                        <span className="row-icon">
                          <Armchair size={18} />
                        </span>
                        <strong>{chair.code}</strong>
                      </div>
                    </td>
                    <td>{chair.model}</td>
                    <td>
                      {branchLabel(
                        branches.find((branch) => branch.id === chair.branchId)?.name ??
                          'Filial não encontrada',
                      )}
                    </td>
                    <td>
                      <StatusBadge status={chair.status} />
                    </td>
                    <td>
                      <button className="table-action admin-only" onClick={() => onEditChair(chair)}>
                        Editar <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > CHAIR_PAGE_SIZE && (
          <div className="table-pagination">
            <span>
              Exibindo {pageIndex * CHAIR_PAGE_SIZE + 1}–
              {Math.min((pageIndex + 1) * CHAIR_PAGE_SIZE, total)} de {total}
            </span>
            <div>
              <button
                type="button"
                onClick={() => onPageChange(pageIndex - 1)}
                disabled={pageIndex === 0}
              >
                Anterior
              </button>
              <span>
                Página {pageIndex + 1} de {Math.ceil(total / CHAIR_PAGE_SIZE)}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(pageIndex + 1)}
                disabled={(pageIndex + 1) * CHAIR_PAGE_SIZE >= total}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </section>

      <BlockManager
        chairs={options}
        blocks={blocks}
        onCreate={onCreateBlock}
        onDelete={onDeleteBlock}
      />
      <p className="hint">
        <CircleHelp size={16} /> Bloqueie datas já comprometidas ou de manutenção para que o site
        não ofereça a poltrona nesse período.
      </p>
    </>
  )
}

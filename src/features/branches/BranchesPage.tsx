import { useEffect, useState } from 'react'
import { ArrowLeft, Armchair, CheckCircle2, ChevronRight, MapPin, PauseCircle, Plus, Search, Wrench } from 'lucide-react'
import { api, type Branch, type BranchInput, type BranchMunicipality, type Chair, type Municipality } from '../../api'
import { BranchModal } from './BranchModal'
import { EmptyState } from '../../components/common'
import { branchLabel, chairName } from '../../utils/branches'
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
  onEditChair: (chair: Chair) => void
  onNewChair: () => void
  modalOpen: boolean
  onToggleFreeShipping: (branch: Branch) => Promise<void>
}

export function BranchesPage({ branches, activeCounts, onNewBranch, credentials, municipalities, saving, formError, onUpdateBranch, onEditChair, onNewChair, modalOpen }: Props) {
  const [enteredId, setEnteredId] = useState<string | null>(null)
  const entered = branches.find(branch => branch.id === enteredId)
  const busyId = null as string | null
  const error = ''



  // Dentro da filial (igual ao app): a foto da região ao fundo, Editar filial e Poltronas da filial.
  if (entered) {
    return <>
      <button type="button" className="branch-back" onClick={() => setEnteredId(null)}><ArrowLeft size={16} /> Todas as filiais</button>
      <section className="branch-enter" style={{ backgroundImage: `url(${branchPhoto(entered.name)})` }}>
        <div className="branch-enter-body">
          <h1>{branchLabel(entered.name)}</h1>
          <div className="branch-enter-status">
            <p>{activeCounts[entered.id] ?? 0} poltronas ativas • {entered.municipalities.length} cidades</p>
            {/* Liga e desliga a filial: desligada, o site e a Isa param de oferecer aluguel nela. */}
            <button type="button" role="switch" aria-checked={entered.active} disabled={saving}
              className={`branch-switch admin-only${entered.active ? ' on' : ''}`}
              onClick={() => {
                const next = !entered.active
                if (!next && !window.confirm(`Pausar ${branchLabel(entered.name)}?\n\nO site e a Isa deixam de oferecer aluguel nesta filial até ela ser ligada de novo.`)) return
                void onUpdateBranch(entered, { name: entered.name, active: next,
                  municipalities: entered.municipalities.map(city => ({ code: city.code, freightCents: city.freightCents })) })
              }}>
              <span className="branch-switch-track"><span className="branch-switch-thumb" /></span>
              <span>{entered.active ? 'Atendendo' : 'Pausada'}</span>
            </button>
            <span className="partner-only branch-switch-text">{entered.active ? 'Atendendo' : 'Pausada'}</span>
          </div>
        </div>
      </section>
      {/* Cidades atendidas e o frete de cada uma, sempre à vista (também para o parceiro). Editar fica logo abaixo. */}
      <section className="panel branch-section">
        <h2>Cidades atendidas ({entered.municipalities.length})</h2>
        <BranchCities branch={entered} />
      </section>
      {/* Tudo da filial numa página só (igual ao app): os dados (administrador) e as poltronas dela. */}
      <section className="panel branch-section admin-only">
        <BranchModal key={`${entered.id}:${entered.active}`} inline modal={{ kind: 'editBranch', branch: entered }} municipalities={municipalities}
          saving={saving} error={formError} onClose={() => {}} onSave={data => onUpdateBranch(entered, data)} />
      </section>
      <section className="panel branch-section">
        <h2>Poltronas da filial</h2>
        <BranchChairs credentials={credentials} branchId={entered.id} branchName={entered.name} reload={modalOpen} onEdit={onEditChair} onNew={onNewChair} />
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
        {/* Só o administrador cadastra filiais. */}
        <button className="button primary admin-only branch-new-small" onClick={onNewBranch}>
          <Plus size={15} /> Nova filial
        </button>
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
                      <span className="branch-city-count">{branch.municipalities.length}{' '}
                        {branch.municipalities.length === 1 ? 'município' : 'municípios'}</span>
                      {branch.municipalities.length > 0 && <small className="branch-city-names" title={sortedCities(branch.municipalities).map(city => city.name).join(', ')}>
                        {citySummary(branch.municipalities)}</small>}
                    </td>
                    <td>{activeCounts[branch.id] ?? 0}</td>
                    <td>{branch.active ? 'Ativa' : 'Inativa'}</td>
                    <td>
                      <button className="branch-enter-button" disabled={busyId !== null} onClick={() => setEnteredId(branch.id)}>
                        Entrar <span className="branch-enter-arrow"><ChevronRight size={15} /></span>
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

const byName = (a: BranchMunicipality, b: BranchMunicipality) => a.name.localeCompare(b.name, 'pt-BR')
const sortedCities = (cities: BranchMunicipality[]) => [...cities].sort(byName)
/** Até 4 cidades em ordem alfabética e "+N" com o resto (o nome completo de todas fica no title). */
function citySummary(cities: BranchMunicipality[]) {
  const names = sortedCities(cities).map(city => city.name)
  return names.length <= 4 ? names.join(', ') : `${names.slice(0, 4).join(', ')} +${names.length - 4}`
}
const freightLabel = (cents: number) => cents === 0 ? 'Grátis'
  : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Cidades da filial com o frete de cada uma (só leitura). Filial com frete grátis geral mostra Grátis em todas. */
function BranchCities({ branch }: { branch: Branch }) {
  if (branch.municipalities.length === 0) return <p className="branch-muted">Nenhuma cidade cadastrada nesta filial.</p>
  return <ul className="branch-cities">
    {sortedCities(branch.municipalities).map(city => {
      const free = branch.freeShipping || city.freightCents === 0
      return <li key={city.code}>
        <MapPin size={15} aria-hidden="true" />
        <span>{city.name} <small>– {city.uf}</small></span>
        <strong className={free ? 'free' : ''}>{free ? 'Grátis' : freightLabel(city.freightCents)}</strong>
      </li>
    })}
  </ul>
}

function branchPhoto(name: string) {
  const text = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\bserra\b|\bibiapaba\b/.test(text)) return '/filiais/filial-serra.webp'
  if (/\bsobral\b/.test(text)) return '/filiais/filial-sobral.webp'
  return '/filiais/filial-fortaleza.webp'
}

const chairStatus: Record<string, { label: string; plural: string; tone: string }> = {
  ACTIVE: { label: 'Ativa', plural: 'Ativas', tone: 'active' }, MAINTENANCE: { label: 'Em manutenção', plural: 'Manutenção', tone: 'maintenance' },
  INACTIVE: { label: 'Inativa', plural: 'Inativas', tone: 'inactive' },
}

/** Poltronas da filial, na própria página da filial. */
function BranchChairs({ credentials, branchId, branchName, reload, onEdit, onNew }: {
  credentials: string; branchId: string; branchName: string; reload: boolean; onEdit: (chair: Chair) => void; onNew: () => void
}) {
  const branchNameOf = (_id: string) => branchName
  const [search, setSearch] = useState('')
  const [chairs, setChairs] = useState<Chair[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void api.chairs(credentials, { page: 0, size: 100, search: '', status: 'ALL', branchId })
      .then(page => { if (active) setChairs(page.items) })
      .catch(cause => { if (active) setError(getMessage(cause)) })
    return () => { active = false }
  }, [credentials, branchId, reload])
  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!chairs) return <p className="branch-muted">Carregando poltronas...</p>
  const term = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const shown = chairs.filter(chair => (!filter || chair.status === filter)
    && (!term || `${chair.code} ${chair.model} ${chair.notes ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term)))
  return <>
    {/* Botões com contador (igual ao app): clicar mostra só aquelas poltronas; clicar de novo mostra todas. */}
    <div className="branch-chair-buttons">{(['ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const).map(status => {
      const Icon = status === 'ACTIVE' ? CheckCircle2 : status === 'MAINTENANCE' ? Wrench : PauseCircle
      return <button type="button" key={status} className={`${chairStatus[status].tone}${filter === status ? ' selected' : ''}`}
        aria-pressed={filter === status} onClick={() => setFilter(filter === status ? null : status)}>
        <Icon size={20} /><strong>{chairs.filter(chair => chair.status === status).length}</strong><span>{chairStatus[status].plural}</span>
      </button>
    })}</div>
    {/* Busca com lupa e, ao lado, o botão pequeno de nova poltrona (igual ao app). */}
    <div className="branch-chair-tools">
      <label className="branch-chair-search"><Search size={16} aria-hidden="true" />
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar poltrona" aria-label="Buscar poltrona" /></label>
      <button type="button" className="button primary admin-only" onClick={onNew}><Plus size={16} /> Nova</button>
    </div>
    {shown.length === 0 ? <p className="branch-muted">{chairs.length === 0 ? 'Nenhuma poltrona nesta filial.' : 'Nenhuma poltrona nesta situação.'}</p>
      : <div className="branch-chairs">{shown.map(chair => <button type="button" key={chair.id} onClick={() => onEdit(chair)} className={`branch-chair ${chairStatus[chair.status]?.tone ?? ''}`}>
        <span className="branch-chair-icon"><Armchair size={18} /></span>
        <span className="branch-chair-text"><strong>{chairName(chair.code, branchNameOf(chair.branchId))}</strong><small>{chair.model}{chair.notes ? ` • ${chair.notes}` : ''}</small></span>
        <span className="branch-chair-status">{chairStatus[chair.status]?.label ?? chair.status}</span>
      </button>)}</div>}
  </>
}

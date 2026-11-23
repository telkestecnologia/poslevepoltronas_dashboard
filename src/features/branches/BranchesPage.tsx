import { useEffect, useState } from 'react'
import { ArrowLeft, Armchair, CheckCircle2, ChevronRight, MapPin, Plus, Search, Wrench } from 'lucide-react'
import { api, type Branch, type BranchInput, type BranchMunicipality, type Chair, type Municipality } from '../../api'
import { BranchModal } from './BranchModal'
import { EmptyState } from '../../components/common'
import { branchLabel, branchNumber, chairName, cityRegions } from '../../utils/branches'
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
  /** Nova poltrona já na filial aberta. */
  onNewChair: (branchId: string) => void
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
          {branchNumber(entered.name) && <span className="branch-number">Filial {branchNumber(entered.name)}</span>}
          <h1>{branchLabel(entered.name)}</h1>
          <div className="branch-enter-status">
            <p>{activeCounts[entered.id] ?? 0} poltronas ativas • {entered.municipalities.length} cidades</p>
            {/* Liga e desliga a filial (administrador e quem é da filial). Fica ligada até alguém pausar: pausada, o site e a Isa param de oferecer aluguel nela. */}
            <button type="button" role="switch" aria-checked={entered.active} disabled={saving}
              className={`branch-switch${entered.active ? ' on' : ''}`}
              onClick={() => {
                const next = !entered.active
                if (!next && !window.confirm(`Pausar ${branchLabel(entered.name)}?\n\nO site e a Isa deixam de oferecer aluguel nesta filial até ela ser ligada de novo.`)) return
                void onUpdateBranch(entered, { name: entered.name, active: next,
                  municipalities: entered.municipalities.map(city => ({ code: city.code, freightCents: city.freightCents, districts: city.districts ?? [] })) })
              }}>
              <span className="branch-switch-track"><span className="branch-switch-thumb" /></span>
              <span>{entered.active ? 'Atendendo' : 'Pausada'}</span>
            </button>
          </div>
        </div>
      </section>
      {/* Cidades atendidas e o frete de cada uma, sempre à vista (também para o parceiro). Editar fica logo abaixo. */}
      <section className="panel branch-section">
        <h2>Cidades atendidas</h2>
        <BranchCities branch={entered} />
      </section>
      {/* Editar cidades, bairros e frete logo abaixo, num bloco que abre e fecha (como antes). */}
      <section className="panel branch-section">
        <BranchModal key={`${entered.id}:${entered.active}:${JSON.stringify(entered.municipalities)}`} inline modal={{ kind: 'editBranch', branch: entered }}
          municipalities={municipalities} saving={saving} error={formError} onClose={() => {}} onSave={data => onUpdateBranch(entered, data)} />
      </section>
      <section className="panel branch-section">
        <h2>Poltronas da filial</h2>
        <BranchChairs credentials={credentials} branchId={entered.id} branchName={entered.name} reload={modalOpen} onEdit={onEditChair} onNew={() => onNewChair(entered.id)} />
      </section>
    </>
  }

  return (
    <>
      <div className="page-heading with-action">
        <div>
          <span className="eyebrow">FILIAIS • PÓS LEVE</span>
          <h1>Frete e Poltronas</h1>
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
                        <span className="branch-name-stack">{branchNumber(branch.name) && <small className="branch-number-small">Filial {branchNumber(branch.name)}</small>}
                          <strong>{branchLabel(branch.name)}</strong></span>
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
export function BranchCities({ branch }: { branch: Branch }) {
  if (branch.municipalities.length === 0) return <p className="branch-muted">Nenhuma cidade cadastrada nesta filial.</p>
  const groups = cityRegions(branch.name, sortedCities(branch.municipalities))
  const list = (cities: typeof branch.municipalities) => <ul className="branch-cities">
    {cities.map(city => {
      const free = branch.freeShipping || city.freightCents === 0
      const districts = city.districts ?? []
      return <li key={city.code}>
        <MapPin size={15} aria-hidden="true" />
        <span>{city.name} <small>– {city.uf}</small></span>
        <strong className={free ? 'free' : ''}>{free ? 'Grátis' : freightLabel(city.freightCents)}</strong>
        {/* Bairros com frete próprio: os demais bairros pagam o valor da cidade. */}
        {districts.length > 0 && !branch.freeShipping && <details className="branch-districts">
          <summary>{districts.length} {districts.length === 1 ? 'bairro' : 'bairros'} com frete próprio</summary>
          <ul>{districts.map(item => <li key={item.name}><span>{item.name}</span><b>{freightLabel(item.freightCents)}</b></li>)}</ul>
        </details>}
      </li>
    })}
  </ul>
  // Filial de Fortaleza: Fortaleza, os bairros de Fortaleza e a Região metropolitana, nessa ordem, todos com o frete.
  const capital = branch.municipalities.find(city => city.name === 'Fortaleza')
  if (groups.length === 1 && capital) {
    const metro = sortedCities(branch.municipalities.filter(city => city.code !== capital.code))
    const districts = branch.freeShipping ? [] : [...(capital.districts ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return <div className="branch-groups">
      <div className="branch-group"><h3>Fortaleza</h3>{list([{ ...capital, districts: [] }])}</div>
      {districts.length > 0 && <div className="branch-group"><h3>Bairros de Fortaleza <small>({districts.length})</small></h3>
        <ul className="branch-cities">{districts.map(item => <li key={item.name}>
          <MapPin size={15} aria-hidden="true" /><span>{item.name}</span><strong>{freightLabel(item.freightCents)}</strong></li>)}</ul>
      </div>}
      {metro.length > 0 && <div className="branch-group"><h3>Região metropolitana <small>({metro.length})</small></h3>{list(metro)}</div>}
    </div>
  }
  if (groups.length === 1) return list(groups[0].cities)
  // Filial unida: Serra da Ibiapaba de um lado, Sobral e Regiões Vizinhas do outro.
  return <div className="branch-regions">
    {groups.map((group, index) => <div key={group.title} className={`branch-region ${index === 0 ? 'serra' : 'sobral'}`}>
      <h3>{group.title} <small>({group.cities.length})</small></h3>
      {group.cities.length ? list(group.cities) : <p className="branch-muted">Nenhuma cidade.</p>}
    </div>)}
  </div>
}

function branchPhoto(name: string) {
  const text = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  // Ibiapaba e Sobral são uma filial só: metade serra, metade Sobral.
  if (/\bserra\b|\bibiapaba\b|\bsobral\b/.test(text)) return '/filiais/filial-ibiapaba-sobral.webp'
  return '/filiais/filial-fortaleza.webp'
}

const chairStatus: Record<string, { label: string; plural: string; tone: string }> = {
  ACTIVE: { label: 'Ativa', plural: 'Ativas', tone: 'active' }, MAINTENANCE: { label: 'Em manutenção', plural: 'Manutenção', tone: 'maintenance' },
  INACTIVE: { label: 'Inativa', plural: 'Inativas', tone: 'inactive' },
}

/** Situação da poltrona hoje: disponível para alugar, em manutenção ou alugada (com cliente). */
type Situation = 'AVAILABLE' | 'MAINTENANCE' | 'RENTED'
const situations: Record<Situation, { label: string; plural: string; tone: string }> = {
  AVAILABLE: { label: 'Disponível', plural: 'Disponível', tone: 'active' },
  MAINTENANCE: { label: 'Em manutenção', plural: 'Manutenção', tone: 'maintenance' },
  RENTED: { label: 'Alugada', plural: 'Alugadas', tone: 'inactive' },
}

/** Poltronas da filial, na própria página da filial. */
function BranchChairs({ credentials, branchId, branchName, reload, onEdit, onNew }: {
  credentials: string; branchId: string; branchName: string; reload: boolean; onEdit: (chair: Chair) => void; onNew: () => void
}) {
  const branchNameOf = (_id: string) => branchName
  const [search, setSearch] = useState('')
  const [chairs, setChairs] = useState<Chair[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Situation | null>(null)
  const [rented, setRented] = useState<Set<string>>(new Set())
  useEffect(() => {
    let active = true
    void api.chairs(credentials, { page: 0, size: 100, search: '', status: 'ALL', branchId })
      .then(page => { if (active) setChairs(page.items) })
      .catch(cause => { if (active) setError(getMessage(cause)) })
    // Alugadas: com cliente hoje (em uso, aguardando retirada ou paga aguardando entrega).
    void api.chairs(credentials, { page: 0, size: 100, search: '', status: 'IN_USE', branchId })
      .then(page => { if (active) setRented(new Set(page.items.map(chair => chair.id))) })
      .catch(() => {})
    return () => { active = false }
  }, [credentials, branchId, reload])
  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!chairs) return <p className="branch-muted">Carregando poltronas...</p>
  const term = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const situationOf = (chair: Chair): Situation | null => chair.status === 'MAINTENANCE' ? 'MAINTENANCE'
    : chair.status !== 'ACTIVE' ? null : rented.has(chair.id) ? 'RENTED' : 'AVAILABLE'
  const shown = chairs.filter(chair => (!filter || situationOf(chair) === filter)
    && (!term || `${chair.code} ${chair.model} ${chair.notes ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term)))
  return <>
    {/* Botões com contador (igual ao app): clicar mostra só aquelas poltronas; clicar de novo mostra todas. */}
    <div className="branch-chair-buttons">{(['AVAILABLE', 'MAINTENANCE', 'RENTED'] as const).map(situation => {
      const Icon = situation === 'AVAILABLE' ? CheckCircle2 : situation === 'MAINTENANCE' ? Wrench : Armchair
      return <button type="button" key={situation} className={`${situations[situation].tone}${filter === situation ? ' selected' : ''}`}
        aria-pressed={filter === situation} onClick={() => setFilter(filter === situation ? null : situation)}>
        <Icon size={20} /><strong>{chairs.filter(chair => situationOf(chair) === situation).length}</strong><span>{situations[situation].plural}</span>
      </button>
    })}</div>
    {/* Busca com lupa e, ao lado, o botão pequeno de nova poltrona (igual ao app). */}
    <div className="branch-chair-tools">
      <label className="branch-chair-search"><Search size={16} aria-hidden="true" />
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar poltrona" aria-label="Buscar poltrona" /></label>
      <button type="button" className="button primary admin-only" onClick={onNew}><Plus size={16} /> Nova</button>
    </div>
    {shown.length === 0 ? <p className="branch-muted">{chairs.length === 0 ? 'Nenhuma poltrona nesta filial.' : 'Nenhuma poltrona nesta situação.'}</p>
      : <div className="branch-chairs">{shown.map(chair => <button type="button" key={chair.id} onClick={() => onEdit(chair)} className={`branch-chair ${situationOf(chair) ? situations[situationOf(chair)!].tone : chairStatus[chair.status]?.tone ?? ''}`}>
        <span className="branch-chair-icon"><Armchair size={18} /></span>
        <span className="branch-chair-text"><strong>{chairName(chair.code, branchNameOf(chair.branchId))}</strong><small>{chair.model}{chair.notes ? ` • ${chair.notes}` : ''}</small></span>
        <span className="branch-chair-status">{situationOf(chair) ? situations[situationOf(chair)!].label : chairStatus[chair.status]?.label ?? chair.status}</span>
      </button>)}</div>}
  </>
}

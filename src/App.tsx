import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight, Armchair, Check, ChevronRight, CircleHelp, Home, LogOut,
  MapPin, Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { api, ApiError, localLoginBypass, type Branch, type BranchInput, type Chair, type ChairStatus, type Staff } from './api'

type Page = 'overview' | 'chairs' | 'branches'
type Modal = { kind: 'newChair' } | { kind: 'editChair'; chair: Chair } | { kind: 'newBranch' } | { kind: 'editBranch'; branch: Branch } | null

const navItems = [
  { id: 'overview', label: 'Visão geral', icon: Home },
  { id: 'chairs', label: 'Poltronas', icon: Armchair },
  { id: 'branches', label: 'Filiais', icon: MapPin },
] as const

const statusLabels: Record<ChairStatus, string> = {
  ACTIVE: 'Ativa',
  MAINTENANCE: 'Em manutenção',
  INACTIVE: 'Inativa',
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand${compact ? ' brand-compact' : ''}`}>
    <img src="/logo-pos-leve-icon.webp" alt="" />
    <div><strong>Pós Leve</strong><span>Painel administrativo</span></div>
  </div>
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
}

function Login({ onLogin, busy, error, localBypass }: {
  onLogin: (email: string, password: string) => Promise<void>
  busy: boolean
  error: string
  localBypass: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    void onLogin(email.trim(), password)
  }

  return <main className="login-layout">
    <section className="login-art" aria-label="Pós Leve">
      <div className="login-art-top"><Brand /><span>GESTÃO COM CUIDADO</span></div>
      <div className="login-art-copy">
        <span className="eyebrow light"><Sparkles size={15} /> CUIDAR TAMBÉM É ORGANIZAR</span>
        <h1>Mais clareza para<br />cuidar de cada<br /><em>detalhe.</em></h1>
        <p>As poltronas da Pós Leve em um só lugar.</p>
      </div>
      <img className="login-chair" src="/cadeira-metade.webp" alt="Poltrona elétrica Pós Leve" />
      <div className="login-art-bottom">Pós Leve • Conforto em cada etapa</div>
    </section>
    <section className="login-panel">
      <div className="login-mobile-brand"><Brand compact /></div>
      <div className="login-card">
        <div className="login-icon"><ShieldCheck size={26} strokeWidth={1.8} /></div>
        <span className="eyebrow">ÁREA RESTRITA</span>
        <h2>Bem-vindo de volta</h2>
        <p>{localBypass ? 'Acesse o painel no ambiente local sem informar e-mail ou senha.' : 'Acesse o painel para acompanhar a operação da Pós Leve.'}</p>
        <form onSubmit={submit} className="login-form">
          {!localBypass && <><label>E-mail
            <input type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>Senha
            <input type="password" autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} required />
          </label></>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button primary login-submit" disabled={busy} type="submit">{busy ? 'Entrando...' : 'Entrar no painel'} <ArrowRight size={18} /></button>
        </form>
        <div className="login-help"><CircleHelp size={16} /> {localBypass ? 'Acesso local de desenvolvimento.' : 'Acesso exclusivo à equipe autorizada.'}</div>
      </div>
      <small className="login-footnote">© {new Date().getFullYear()} Pós Leve Poltronas</small>
    </section>
  </main>
}

function StatusBadge({ status }: { status: ChairStatus }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i />{statusLabels[status]}</span>
}

function EmptyState({ icon: Icon, title, text, action }: {
  icon: typeof Armchair; title: string; text: string; action?: { label: string; onClick: () => void }
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={26} strokeWidth={1.7} /></div><h3>{title}</h3><p>{text}</p>
    {action && <button className="button primary" onClick={action.onClick}><Plus size={17} /> {action.label}</button>}
  </div>
}

function App() {
  const [credentials, setCredentials] = useState<string | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [chairs, setChairs] = useState<Chair[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [page, setPage] = useState<Page>('overview')
  const [modal, setModal] = useState<Modal>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ChairStatus | 'ALL'>('ALL')

  const refresh = useCallback(async (auth: string) => {
    const [nextChairs, nextBranches] = await Promise.all([api.chairs(auth), api.branches(auth)])
    setChairs(nextChairs)
    setBranches(nextBranches)
  }, [])

  async function login(email: string, password: string) {
    setLoginBusy(true)
    setLoginError('')
    try {
      const bytes = new TextEncoder().encode(`${email}:${password}`)
      const auth = localLoginBypass ? '' : btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
      const identity = await api.me(auth)
      await refresh(auth)
      setCredentials(auth)
      setStaff(identity)
    } catch (error) {
      setLoginError(getMessage(error))
    } finally {
      setLoginBusy(false)
    }
  }

  function logout() {
    setCredentials(null)
    setStaff(null)
    setChairs([])
    setBranches([])
    setPage('overview')
    setNotice('')
  }

  useEffect(() => {
    if (!modal) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setModal(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal, saving])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredChairs = useMemo(() => chairs.filter(chair => {
    const matchesText = `${chair.code} ${chair.model}`.toLowerCase().includes(search.toLowerCase().trim())
    return matchesText && (statusFilter === 'ALL' || chair.status === statusFilter)
  }), [chairs, search, statusFilter])

  function openModal(next: Modal) {
    setFormError('')
    setModal(next)
  }

  function showNotice(message: string) {
    setNotice(message)
  }

  async function saveChair(data: { code: string; model: string; notes: string; status: ChairStatus; branchId: string }) {
    if (credentials === null) return
    setSaving(true)
    setFormError('')
    try {
      if (modal?.kind === 'editChair') {
        await api.updateChair(credentials, modal.chair.id, { model: data.model, notes: data.notes, status: data.status, branchId: data.branchId })
        showNotice('Poltrona atualizada com sucesso.')
      } else {
        await api.createChair(credentials, { code: data.code, model: data.model, notes: data.notes, branchId: data.branchId })
        showNotice('Poltrona cadastrada com sucesso.')
      }
      await refresh(credentials)
      setModal(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      else setFormError(getMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function saveBranch(data: BranchInput) {
    if (credentials === null) return
    setSaving(true)
    setFormError('')
    try {
      if (modal?.kind === 'editBranch') {
        await api.updateBranch(credentials, modal.branch.id, data)
        showNotice('Filial atualizada com sucesso.')
      } else {
        await api.createBranch(credentials, data)
        showNotice('Filial cadastrada com sucesso.')
      }
      await refresh(credentials)
      setModal(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout()
      else setFormError(getMessage(error))
    } finally {
      setSaving(false)
    }
  }

  if (credentials === null || !staff) return <Login onLogin={login} busy={loginBusy} error={loginError} localBypass={localLoginBypass} />

  const titles: Record<Page, string> = {
    overview: 'Visão geral', chairs: 'Poltronas', branches: 'Filiais',
  }

  return <div className="dashboard-shell">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
      <div className="sidebar-brand"><Brand /><button className="mobile-close icon-button" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
      <div className="sidebar-section-label">MENU PRINCIPAL</div>
      <nav className="main-nav" aria-label="Menu principal">
        {navItems.map(item => <button key={item.id} className={`nav-item${page === item.id ? ' selected' : ''}`} onClick={() => { setPage(item.id); setSidebarOpen(false) }}>
          <item.icon size={20} strokeWidth={1.9} /><span>{item.label}</span>
        </button>)}
      </nav>
      <div className="sidebar-spacer" />
      <button className="sidebar-user" onClick={logout} title="Sair do painel"><span className="avatar">{staff.displayName.charAt(0)}</span><span><strong>{staff.displayName}</strong><small>Administrador</small></span><LogOut size={18} /></button>
    </aside>

    <div className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Abrir menu" onClick={() => setSidebarOpen(true)}><Menu size={23} /></button><div className="breadcrumbs">Painel <ChevronRight size={14} /> <strong>{titles[page]}</strong></div></div></header>
      <main className="content">
        {page !== 'overview' && notice && <div className="toast" role="status"><Check size={18} />{notice}<button aria-label="Fechar mensagem" onClick={() => setNotice('')}><X size={16} /></button></div>}

        {page === 'chairs' && <>
          <div className="page-heading with-action"><div><span className="eyebrow">ESTOQUE • PÓS LEVE</span><h1>Poltronas</h1><p>Cadastre equipamentos e acompanhe sua condição operacional.</p></div><button className="button primary" onClick={() => openModal({ kind: 'newChair' })} disabled={branches.length === 0}><Plus size={18} /> Nova poltrona</button></div>
          <section className="panel table-panel"><div className="table-toolbar"><div className="search-field"><Search size={19} /><input aria-label="Buscar poltrona" placeholder="Buscar por código ou modelo" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="select-wrap"><Settings2 size={17} /><select aria-label="Filtrar por estado" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ChairStatus | 'ALL')}><option value="ALL">Todos os estados</option><option value="ACTIVE">Ativas</option><option value="MAINTENANCE">Em manutenção</option><option value="INACTIVE">Inativas</option></select></div></div>
            {chairs.length === 0 ? <EmptyState icon={Armchair} title="Nenhuma poltrona cadastrada" text={branches.length === 0 ? 'Cadastre uma filial antes da primeira poltrona.' : 'Cadastre a primeira poltrona para começar a organizar seu estoque.'} action={branches.length > 0 ? { label: 'Cadastrar poltrona', onClick: () => openModal({ kind: 'newChair' }) } : { label: 'Cadastrar filial', onClick: () => setPage('branches') }} />
              : filteredChairs.length === 0 ? <EmptyState icon={Search} title="Nenhum resultado" text="Tente outro termo ou altere o filtro de estado." />
                : <div className="table-scroll"><table><thead><tr><th>POLTRONA</th><th>MODELO</th><th>FILIAL</th><th>ESTADO</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{filteredChairs.map(chair => <tr key={chair.id}><td><div className="chair-cell"><span className="row-icon"><Armchair size={18} /></span><strong>{chair.code}</strong></div></td><td>{chair.model}</td><td>{branches.find(branch => branch.id === chair.branchId)?.name ?? 'Filial não encontrada'}</td><td><StatusBadge status={chair.status} /></td><td><button className="table-action" onClick={() => openModal({ kind: 'editChair', chair })}>Editar <ChevronRight size={16} /></button></td></tr>)}</tbody></table></div>}
          </section><p className="hint"><CircleHelp size={16} /> O estado operacional não representa disponibilidade por data de reserva.</p>
        </>}

        {page === 'branches' && <>
          <div className="page-heading with-action"><div><span className="eyebrow">FILIAIS • PÓS LEVE</span><h1>Filiais</h1><p>Cadastre as cidades atendidas por cada filial.</p></div><button className="button primary" onClick={() => openModal({ kind: 'newBranch' })}><Plus size={18} /> Nova filial</button></div>
          <section className="panel table-panel">
            {branches.length === 0 ? <EmptyState icon={MapPin} title="Nenhuma filial cadastrada" text="Crie uma filial e informe as cidades que ela atende." action={{ label: 'Criar filial', onClick: () => openModal({ kind: 'newBranch' }) }} />
              : <div className="table-scroll"><table><thead><tr><th>FILIAL</th><th>CIDADES</th><th>ESTADO</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{branches.map(branch => <tr key={branch.id}><td><div className="chair-cell"><span className="row-icon"><MapPin size={18} /></span><strong>{branch.name}</strong></div></td><td>{branch.cities.length} {branch.cities.length === 1 ? 'cidade' : 'cidades'}</td><td>{branch.active ? 'Ativa' : 'Inativa'}</td><td><button className="table-action" onClick={() => openModal({ kind: 'editBranch', branch })}>Editar <ChevronRight size={16} /></button></td></tr>)}</tbody></table></div>}
          </section>
        </>}

      </main>
    </div>

    {modal && (modal.kind === 'newBranch' || modal.kind === 'editBranch'
      ? <BranchModal modal={modal} saving={saving} error={formError} onClose={() => { if (!saving) setModal(null) }} onSave={saveBranch} />
      : <EditModal modal={modal} branches={branches} saving={saving} error={formError} onClose={() => { if (!saving) setModal(null) }} onChairSave={saveChair} />)}
  </div>
}

function EditModal({ modal, branches, saving, error, onClose, onChairSave }: {
  modal: { kind: 'newChair' } | { kind: 'editChair'; chair: Chair }; branches: Branch[]; saving: boolean; error: string; onClose: () => void
  onChairSave: (data: { code: string; model: string; notes: string; status: ChairStatus; branchId: string }) => Promise<void>
}) {
  const chair = modal.kind === 'editChair' ? modal.chair : null
  const [code, setCode] = useState(chair?.code ?? '')
  const [model, setModel] = useState(chair?.model ?? '')
  const [notes, setNotes] = useState(chair?.notes ?? '')
  const [status, setStatus] = useState<ChairStatus>(chair?.status ?? 'ACTIVE')
  const [branchId, setBranchId] = useState(chair?.branchId ?? '')
  const title = chair ? 'Editar poltrona' : 'Nova poltrona'

  function submit(event: FormEvent) {
    event.preventDefault()
    void onChairSave({ code: code.trim(), model: model.trim(), notes: notes.trim(), status, branchId })
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">PÓS LEVE • ADMINISTRAÇÃO</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={submit} className="modal-form">
      <><label>Código da poltrona<input value={code} onChange={e => setCode(e.target.value)} maxLength={32} placeholder="Ex.: PL-001" required disabled={Boolean(chair)} autoFocus={!chair} /></label><label>Modelo<input value={model} onChange={e => setModel(e.target.value)} maxLength={120} placeholder="Ex.: Poltrona Power Lift" required autoFocus={Boolean(chair)} /></label><label>Filial<select value={branchId} onChange={e => setBranchId(e.target.value)} required><option value="">Selecione uma filial</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}{!branch.active ? ' (inativa)' : ''}</option>)}</select></label>{chair && <label>Estado operacional<select value={status} onChange={e => setStatus(e.target.value as ChairStatus)}><option value="ACTIVE">Ativa</option><option value="MAINTENANCE">Em manutenção</option><option value="INACTIVE">Inativa</option></select></label>}<label>Observações <span className="optional">(opcional)</span><textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Informações úteis sobre o equipamento" /></label></>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="button primary" disabled={saving}>{saving ? 'Salvando...' : chair ? 'Salvar alterações' : 'Cadastrar poltrona'} <ArrowRight size={17} /></button></div>
    </form>
  </section></div>
}

function BranchModal({ modal, saving, error, onClose, onSave }: {
  modal: { kind: 'newBranch' } | { kind: 'editBranch'; branch: Branch }
  saving: boolean; error: string; onClose: () => void; onSave: (data: BranchInput) => Promise<void>
}) {
  const branch = modal.kind === 'editBranch' ? modal.branch : null
  const [name, setName] = useState(branch?.name ?? '')
  const [citiesText, setCitiesText] = useState(branch?.cities.map(city => `${city.city}, ${city.uf}`).join('\n') ?? '')
  const [active, setActive] = useState(branch?.active ?? true)
  const [localError, setLocalError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const lines = citiesText.split('\n').map(line => line.trim()).filter(Boolean)
    const cities = lines.map(line => {
      const match = /^(.+),\s*([a-zA-Z]{2})$/.exec(line)
      return match ? { city: match[1].trim(), uf: match[2].toUpperCase() } : null
    })
    if (cities.length === 0 || cities.some(city => city === null)) {
      setLocalError('Informe uma cidade por linha no formato Cidade, UF. Ex.: Fortaleza, CE')
      return
    }
    setLocalError('')
    void onSave({ name: name.trim(), cities: cities as BranchInput['cities'], active })
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="branch-modal-title"><div className="modal-head"><div><span className="eyebrow">PÓS LEVE • FILIAIS</span><h2 id="branch-modal-title">{branch ? 'Editar filial' : 'Nova filial'}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={submit} className="modal-form">
      <label>Nome da filial<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Ex.: Serra da Ibiapaba" required autoFocus /></label>
      <label>Cidades atendidas<textarea className="cities-input" value={citiesText} onChange={event => setCitiesText(event.target.value)} rows={8} placeholder={'Tianguá, CE\nUbajara, CE'} required /><span className="field-help">Uma cidade por linha, no formato Cidade, UF.</span></label>
      <label className="branch-option"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /><span>Filial ativa</span></label>
      {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="button primary" disabled={saving}>{saving ? 'Salvando...' : branch ? 'Salvar alterações' : 'Criar filial'} <ArrowRight size={17} /></button></div>
    </form>
  </section></div>
}

export default App

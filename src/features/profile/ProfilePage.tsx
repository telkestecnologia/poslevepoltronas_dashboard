import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { NotificationToggle } from './NotificationToggle'
import { ArrowRight, ChevronRight, KeyRound, Mail, Plus, Sparkles, UserRound, Users, X } from 'lucide-react'
import { FormIntro } from '../../components/FormIntro'
import owners from '../../assets/fundadoras-capa.webp'
import renata from '../../assets/renata.webp'
import isadora from '../../assets/isadora.webp'
import { api, type AccessLevel, type Account, type Branch, type BranchInput, type Municipality, type TeamMember, type TeamMemberInput } from '../../api'
import { BranchModal } from '../branches/BranchModal'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { EmptyState } from '../../components/common'
import { getMessage } from '../../utils/errors'
import { formatPhone } from '../../utils/phone'
import './profile.css'

// Valor da opção "Todas as filiais" (acesso a todos os dados).
const ALL_BRANCHES = '__ALL__'

const roles = ['Administrador', 'Gerente', 'Atendimento', 'Financeiro', 'Logística', 'Entregador']
const accessLabels: Record<AccessLevel, { label: string; hint: string }> = {
  ALL: { label: 'Vê todos os dados', hint: 'Acessa pedidos, financeiro, filiais e todas as telas.' },
  NONE: { label: 'Começa do zero', hint: 'Entra sem ver nenhum dado até receber permissões.' },
}

type Dialog = { kind: 'password' } | { kind: 'email' } | { kind: 'member'; member: TeamMember | null } | null

/** Meus dados e equipe do painel: as mesmas funções da tela Perfil e equipe do app. */
export function ProfilePage({ credentials, onCredentialsChanged, partner = false }: {
  credentials: string; onCredentialsChanged: (email: string, password: string) => Promise<void>
  /** Parceiro ("Começa do zero") vê só os próprios dados; a equipe é do administrador. */
  partner?: boolean
}) {
  const [account, setAccount] = useState<Account | null>(null)
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)

  const load = useCallback(() => (partner
    ? api.account(credentials).then(me => { setAccount(me); setError('') })
    : Promise.all([api.account(credentials), api.team(credentials), api.teamAreas(credentials), api.branches(credentials)])
      .then(([me, members, areaList, branchList]) => { setAccount(me); setTeam(members); setAreas(areaList); setBranches(branchList); setError('') }))
    .catch(failure => { setTeam(current => current ?? []); setError(getMessage(failure)) }), [credentials, partner])
  const branchName = (id?: string | null) => {
    const branch = branches.find(item => item.id === id)
    return branch ? branchLabel(branch.name) : 'sem filial'
  }

  useEffect(() => { void load() }, [load])

  const initials = (account?.name ?? '?').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">CONTA • EQUIPE</span><h1>Perfil e equipe</h1></div>
    </div>
    {notice && <div className="profile-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {error && <div className="form-error" role="alert">{error}</div>}

    <div className="profile-grid">
      <section className={`panel profile-card${partner ? '' : ' with-cover'}`}>
        {/* Administrador: capa com a foto das proprietárias e a saudação (igual ao app). */}
        {!partner && <div className="profile-cover" style={{ backgroundImage: `url(${owners})` }} role="img" aria-label="Proprietárias da Pós Leve" />}
        {partner ? <h2><UserRound size={18} /> Meus dados</h2>
          : <h2 className="profile-hello">Olá, {account?.name.split(' ')[0] ?? ''}</h2>}
        <div className="profile-me">
          <span className="profile-avatar">{initials}</span>
          <div>
            <strong>{account?.name ?? '—'}</strong>
            <small>{account?.email}</small>
            {account?.phone && <small>WhatsApp {formatPhone(account.phone)}</small>}
            <span className="profile-pill">{partner ? 'Parceiro • vê os dados da sua filial' : account ? `${accessLabels[account.access].label} e decide quem vê o quê` : ''}</span>
          </div>
        </div>
        <div className="profile-actions">
          <button className="button secondary" onClick={() => setDialog({ kind: 'password' })}><KeyRound size={16} /> Alterar senha</button>
          <button className="button secondary" onClick={() => setDialog({ kind: 'email' })}><Mail size={16} /> Alterar e-mail</button>
        </div>
        <NotificationToggle />
        {account && !account.phone && <p className="field-help">Cadastre seu celular com WhatsApp na lista da equipe (toque no seu nome). É para ele que vai o código de “Esqueci minha senha”.</p>}
      </section>

      {!partner && <section className="panel table-panel profile-team">
        <div className="profile-team-head">
          <h2><Users size={18} /> Equipe</h2>
          <button className="button primary" onClick={() => setDialog({ kind: 'member', member: null })}><Plus size={18} /> Cadastrar usuário</button>
        </div>
        {!team ? <p className="profile-loading">Carregando equipe…</p>
          : team.length === 0 ? <EmptyState icon={Users} title="Nenhum usuário" text="Cadastre quem usa o painel, o cargo, onde atua e o que pode ver." />
            : <div className="table-scroll"><table><thead><tr>
              <th>NOME</th><th>CARGO E ÁREA</th><th>WHATSAPP</th><th>ACESSO</th><th><span className="sr-only">Ação</span></th>
            </tr></thead><tbody>{team.map(member => <tr key={member.id}>
              <td><div className="courier-identity"><strong>{member.name}{member.self ? ' (você)' : ''}</strong><small>{member.email}</small></div></td>
              <td>{[member.jobTitle, member.area].filter(Boolean).join(' • ') || '—'}</td>
              <td>{member.phone ? formatPhone(member.phone) : '—'}</td>
              <td><span className={`courier-access ${member.enabled && member.access === 'ALL' ? 'active' : 'inactive'}`}>
                {!member.enabled ? 'Desativado' : member.access === 'ALL' ? accessLabels.ALL.label : `Parceiro • ${branchName(member.branchId)}`}</span></td>
              <td><button className="table-action" onClick={() => setDialog({ kind: 'member', member })}>Editar <ChevronRight size={16} /></button></td>
            </tr>)}</tbody></table></div>}
      </section>}
    </div>

    {dialog?.kind === 'password' && <PasswordDialog credentials={credentials} email={account?.email ?? ''} onClose={() => setDialog(null)}
      onCredentialsChanged={onCredentialsChanged}
      onDone={() => { setDialog(null); setNotice('Senha alterada. Use a nova senha nos próximos acessos, aqui e no app.') }} />}
    {dialog?.kind === 'email' && <EmailDialog credentials={credentials} current={account?.email ?? ''} onClose={() => setDialog(null)}
      onCredentialsChanged={onCredentialsChanged}
      onDone={() => { setDialog(null); setNotice('E-mail alterado. Use o novo e-mail para entrar, aqui e no app.') }} />}
    {dialog?.kind === 'member' && <MemberDialog credentials={credentials} member={dialog.member} areas={areas} branches={branches} onAreas={setAreas}
      onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load() }} onBranchesChanged={() => void load()} />}
  </>
}

function Modal({ title, eyebrow, onClose, busy, children }: {
  title: string; eyebrow: string; onClose: () => void; busy: boolean; children: React.ReactNode
}) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X size={20} /></button></div>
      {children}
    </section>
  </div>
}

function PasswordDialog({ credentials, email, onClose, onDone, onCredentialsChanged }: {
  credentials: string; email: string; onClose: () => void; onDone: () => void
  onCredentialsChanged: (email: string, password: string) => Promise<void>
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (next.length < 6) return setError('A nova senha deve ter pelo menos 6 caracteres.')
    if (next !== confirm) return setError('A confirmação não é igual à nova senha.')
    setBusy(true)
    try {
      await api.changePassword(credentials, current, next)
      await onCredentialsChanged(email, next)
      onDone()
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return <Modal title="Alterar senha" eyebrow="MEUS DADOS" onClose={onClose} busy={busy}>
    <form className="modal-form" onSubmit={event => void submit(event)}>
      <label>Senha atual<input type="password" value={current} onChange={event => setCurrent(event.target.value)} required autoComplete="current-password" autoFocus /></label>
      <label>Nova senha<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" placeholder="De 6 a 72 caracteres" /></label>
      <label>Confirmar nova senha<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} required autoComplete="new-password" /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'} <ArrowRight size={17} /></button></div>
    </form>
  </Modal>
}

function EmailDialog({ credentials, current, onClose, onDone, onCredentialsChanged }: {
  credentials: string; current: string; onClose: () => void; onDone: () => void
  onCredentialsChanged: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (email.trim().toLowerCase() === current.toLowerCase()) return setError('Esse já é o seu e-mail atual.')
    setBusy(true)
    try {
      const account = await api.changeEmail(credentials, password, email.trim())
      await onCredentialsChanged(account.email, password)
      onDone()
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return <Modal title="Alterar e-mail" eyebrow="MEUS DADOS" onClose={onClose} busy={busy}>
    <form className="modal-form" onSubmit={event => void submit(event)}>
      <small className="field-help">E-mail atual: {current}</small>
      <label>Novo e-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoFocus /></label>
      <label>Senha atual<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar novo e-mail'} <ArrowRight size={17} /></button></div>
    </form>
  </Modal>
}

function MemberDialog({ credentials, member, areas, branches, onAreas, onClose, onSaved, onBranchesChanged }: {
  credentials: string; member: TeamMember | null; areas: string[]; branches: Branch[]; onAreas: (areas: string[]) => void
  onClose: () => void; onSaved: () => void; onBranchesChanged: () => void
}) {
  const [newBranch, setNewBranch] = useState<{ municipalities: Municipality[]; saving: boolean; error: string } | null>(null)
  const branchName = (id?: string | null) => {
    const branch = branches.find(item => item.id === id)
    return branch ? branchLabel(branch.name) : 'a filial escolhida'
  }
  async function openNewBranch() {
    try {
      setNewBranch({ municipalities: await api.municipalities(credentials), saving: false, error: '' })
    } catch (failure) {
      setError(getMessage(failure))
    }
  }
  async function saveBranch(data: BranchInput) {
    setNewBranch(current => current && { ...current, saving: true, error: '' })
    try {
      await api.createBranch(credentials, data)
      setNewBranch(null)
      onBranchesChanged()
    } catch (failure) {
      setNewBranch(current => current && { ...current, saving: false, error: getMessage(failure) })
    }
  }
  const [form, setForm] = useState<TeamMemberInput>({
    name: member?.name ?? '', email: member?.email ?? '', phone: member?.phone ?? '', area: member?.area ?? areas[0] ?? '',
    jobTitle: member?.jobTitle ?? roles[2], access: member?.access ?? 'NONE', password: '', enabled: member?.enabled ?? true,
    branchId: member?.branchId ?? '',
  })
  const [confirm, setConfirm] = useState('')
  const [newCity, setNewCity] = useState('')
  const [addingCity, setAddingCity] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof TeamMemberInput>(field: K, value: TeamMemberInput[K]) => setForm(current => ({ ...current, [field]: value }))

  async function saveCity() {
    if (newCity.trim().length < 3) return setError('Informe o nome da cidade.')
    try {
      onAreas(await api.addTeamArea(credentials, newCity.trim()))
      set('area', newCity.trim())
      setNewCity('')
      setAddingCity(false)
      setError('')
    } catch (failure) {
      setError(getMessage(failure))
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const digits = form.phone.replace(/\D/g, '')
    if (form.name.trim().split(' ').length < 2) return setError('Informe o nome completo.')
    if (!/^[1-9][0-9]9[0-9]{8}$/.test(digits)) return setError('Informe o celular com DDD (11 dígitos), o mesmo do WhatsApp.')
    if (!member || form.password) {
      if (form.password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')
      if (form.password !== confirm) return setError('A confirmação não é igual à senha.')
    }
    setBusy(true)
    try {
      const data = { ...form, name: form.name.trim(), email: form.email.trim(), phone: digits,
        branchId: form.access === 'NONE' && form.branchId ? form.branchId : null }
      if (member) await api.updateTeamMember(credentials, member.id, data)
      else await api.createTeamMember(credentials, data)
      onSaved()
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!member || !window.confirm(`Remover ${member.name}?\n\nA pessoa perde o acesso ao painel e ao app desta locadora.`)) return
    setBusy(true)
    try {
      await api.removeTeamMember(credentials, member.id)
      onSaved()
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <Modal title={member ? 'Editar usuário' : 'Cadastrar usuário'} eyebrow="EQUIPE" onClose={onClose} busy={busy}>
    <form className="modal-form" onSubmit={event => void submit(event)}>
      {!member && <FormIntro icon={<Sparkles size={13} />} title="Boas-vindas à Pós Leve" portraits={[renata, isadora]}>
        Preencha os dados de quem vai fazer parte do time. Ela entra no painel e no app com o e-mail e a senha que você criar aqui.</FormIntro>}
      <label>Nome completo<input value={form.name} onChange={event => set('name', event.target.value)} maxLength={120} required autoFocus placeholder="Ex.: Isadora Ivo" /></label>
      <label>E-mail<input type="email" value={form.email} onChange={event => set('email', event.target.value)} required autoComplete="off" placeholder="nome@poslevepoltronas.com.br" /></label>
      <label>Celular com WhatsApp<input type="tel" inputMode="numeric" value={formatPhone(form.phone)} onChange={event => set('phone', event.target.value.replace(/\D/g, '').slice(0, 11))} required placeholder="(85) 99999-9999" /></label>
      <small className="field-help">É para este número que vai o código de “Esqueci minha senha”.</small>
      <label>Área de atuação<select value={form.area} onChange={event => set('area', event.target.value)}>
        {areas.map(area => <option key={area} value={area}>{area}</option>)}</select></label>
      {addingCity ? <div className="profile-city">
        <input value={newCity} onChange={event => setNewCity(event.target.value)} placeholder="Ex.: Crateús/CE" aria-label="Nova cidade" />
        <button type="button" className="button secondary" onClick={() => void saveCity()}>Adicionar</button>
      </div> : <button type="button" className="profile-link" onClick={() => setAddingCity(true)}>+ Cadastrar nova cidade</button>}
      <label>Cargo<select value={form.jobTitle} onChange={event => set('jobTitle', event.target.value)}>
        {[...new Set([...roles, form.jobTitle].filter(Boolean))].map(role => <option key={role} value={role}>{role}</option>)}</select></label>
      {/* Nível de acesso: todos os dados ou só os de uma filial (pedidos, poltronas, agenda, financeiro e conversas dela). */}
      <label>Nível de acesso<select value={form.access === 'ALL' ? ALL_BRANCHES : form.branchId ?? ''}
        onChange={event => { const value = event.target.value; setForm(current => value === ALL_BRANCHES
          ? { ...current, access: 'ALL', branchId: null } : { ...current, access: 'NONE', branchId: value }) }}>
        {form.access === 'NONE' && !form.branchId && <option value="" disabled>Escolha a filial</option>}
        <option value={ALL_BRANCHES}>Vê todos os dados (todas as filiais)</option>
        {onlyOfficialBranches(branches, branch => branch.name).map(branch => <option key={branch.id} value={branch.id}>{branchLabel(branch.name)}</option>)}</select></label>
      <small className="field-help">{form.access === 'ALL' ? 'Vê pedidos, poltronas, agenda, financeiro e conversas de todas as filiais.'
        : form.branchId ? `Vê só o que é de ${branchName(form.branchId)}: pedidos, poltronas, agenda, financeiro e conversas do WhatsApp. Não vê as outras filiais.`
          : 'Escolha a filial em que a pessoa trabalha.'}</small>
      {/* Só o administrador chega aqui (a equipe é dele); a filial nova entra na lista ao salvar. */}
      <button type="button" className="profile-link" onClick={() => void openNewBranch()}>+ Cadastrar nova filial</button>
      {member && !member.self && <label className="branch-option"><input type="checkbox" checked={form.enabled ?? true}
        onChange={event => set('enabled', event.target.checked)} /><span>Acesso ativo</span></label>}
      <label>{member ? 'Nova senha' : 'Senha'} {member && <span className="optional">(opcional)</span>}
        <input type="password" value={form.password} onChange={event => set('password', event.target.value)} autoComplete="new-password"
          placeholder={member ? 'Deixe vazio para manter a atual' : 'Pelo menos 6 caracteres'} /></label>
      <label>Confirmar senha<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions">
        {member && !member.self && <button type="button" className="button profile-remove" onClick={() => void remove()} disabled={busy}>Remover</button>}
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando...' : member ? 'Salvar alterações' : 'Cadastrar usuário'} <ArrowRight size={17} /></button>
      </div>
    </form>
    {newBranch && <BranchModal modal={{ kind: 'newBranch' }} municipalities={newBranch.municipalities} saving={newBranch.saving}
      error={newBranch.error} onClose={() => setNewBranch(null)} onSave={saveBranch} />}
  </Modal>
}

import { useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, Lock, LogOut } from 'lucide-react'
import { api, type Staff } from '../api'
import { getMessage } from '../utils/errors'
import { Brand } from './common'
import './member-home.css'

/**
 * Tela de quem está como "Começa do zero": entra no painel, mas ainda não vê nenhum dado da operação até um
 * administrador mudar o acesso para "Vê todos os dados" em Perfil e equipe.
 */
export function MemberHome({ staff, credentials, onLogout, onCredentialsChanged }: {
  staff: Staff; credentials: string; onLogout: () => void; onCredentialsChanged: (email: string, password: string) => Promise<void>
}) {
  const [changing, setChanging] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (next.length < 6) return setError('A nova senha deve ter pelo menos 6 caracteres.')
    if (next !== confirm) return setError('A confirmação não é igual à nova senha.')
    setBusy(true)
    setError('')
    try {
      await api.changePassword(credentials, current, next)
      await onCredentialsChanged(staff.email, next)
      setChanging(false)
      setCurrent(''); setNext(''); setConfirm('')
      setNotice('Senha alterada. Use a nova senha nos próximos acessos.')
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <main className="member-home">
    <section className="member-card">
      <Brand />
      <h1>Olá, {staff.displayName.split(' ')[0]}!</h1>
      <p className="member-email">{staff.email}</p>
      <div className="member-info">
        <span className="member-icon"><Lock size={20} /></span>
        <div><strong>Seu acesso começa do zero</strong>
          <p>Você já entrou no painel da Pós Leve, mas ainda não há dados liberados para você: pedidos, financeiro, conversas e poltronas aparecem quando um administrador mudar o seu acesso para “Vê todos os dados”.</p></div>
      </div>
      {notice && <div className="member-notice" role="status">{notice}</div>}
      {changing ? <form className="modal-form" onSubmit={event => void submit(event)}>
        <label>Senha atual<input type="password" value={current} onChange={event => setCurrent(event.target.value)} required autoComplete="current-password" autoFocus /></label>
        <label>Nova senha<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" placeholder="De 6 a 72 caracteres" /></label>
        <label>Confirmar nova senha<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} required autoComplete="new-password" /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => { setChanging(false); setError('') }} disabled={busy}>Cancelar</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'} <ArrowRight size={17} /></button></div>
      </form> : <button className="button primary" onClick={() => { setChanging(true); setNotice('') }}><KeyRound size={16} /> Alterar senha</button>}
      <button className="member-logout" onClick={onLogout}><LogOut size={16} /> Sair</button>
    </section>
  </main>
}

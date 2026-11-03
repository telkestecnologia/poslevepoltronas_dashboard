import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, MessageCircle, RefreshCw, X } from 'lucide-react'
import { confirmPasswordReset, requestPasswordReset } from '../api'
import { getMessage } from '../utils/errors'
import { formatPhone } from '../utils/phone'
import './forgot-password.css'

const RESEND_SECONDS = 60

/** Esqueci minha senha (igual ao app): código de 6 dígitos no WhatsApp cadastrado no perfil e nova senha. */
export function ForgotPassword({ onClose, onDone }: { onClose: () => void; onDone: (email: string) => void }) {
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [wait, setWait] = useState(0)

  // Contagem para pedir outro código: o servidor aceita até 3 envios por hora.
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const digits = phone.replace(/\D/g, '')
  const sendCode = (again: boolean) => run(async () => {
    setNotice('')
    await requestPasswordReset(digits)
    setCode('')
    setWait(RESEND_SECONDS)
    setStep('code')
    if (again) setNotice(`Enviamos um novo código para o WhatsApp ${formatPhone(digits)}. Use sempre o último que chegar.`)
  })

  function submitPhone(event: FormEvent) {
    event.preventDefault()
    void sendCode(false)
  }

  function submitCode(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      if (password.length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.')
      if (password !== confirm) throw new Error('A confirmação não é igual à nova senha.')
      setEmail(await confirmPasswordReset(digits, code, password))
      setStep('done')
    })
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal forgot" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <div className="modal-head">
        <div className="forgot-title"><span className="forgot-whatsapp"><MessageCircle size={20} /></span>
          <h2 id="forgot-title">Esqueci minha senha</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X size={20} /></button>
      </div>
      {step === 'phone' && <form className="modal-form" onSubmit={submitPhone}>
        <p className="forgot-text">Informe o celular de WhatsApp cadastrado no seu perfil. Vamos enviar um código de 6 dígitos para ele.</p>
        <label>Celular com WhatsApp<input type="tel" inputMode="numeric" autoComplete="tel" value={formatPhone(digits)}
          onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="(85) 99999-9999" autoFocus required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary" type="submit" disabled={busy || digits.length !== 11}>
          {busy ? 'Enviando...' : 'Enviar código pelo WhatsApp'} <ArrowRight size={17} /></button>
      </form>}
      {step === 'code' && <form className="modal-form" onSubmit={submitCode}>
        <p className="forgot-text">Se o celular {formatPhone(digits)} estiver cadastrado, o código chega no WhatsApp em instantes. Ele vale por 10 minutos.</p>
        {notice && <div className="forgot-notice" role="status">{notice}</div>}
        <label>Código de 6 dígitos<input className="forgot-code" inputMode="numeric" autoComplete="one-time-code" value={code}
          onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus required /></label>
        <label>Nova senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password"
          minLength={6} maxLength={72} placeholder="De 6 a 72 caracteres" required /></label>
        <label>Confirmar nova senha<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary" type="submit" disabled={busy || code.length !== 6}>
          {busy ? 'Salvando...' : 'Criar nova senha'} <ArrowRight size={17} /></button>
        <div className="forgot-divider"><span>ou</span></div>
        <button type="button" className="forgot-resend" disabled={busy || wait > 0} onClick={() => void sendCode(true)}>
          <RefreshCw size={14} /> {wait > 0 ? `Não recebeu? Enviar outro código em ${wait}s` : 'Não recebeu? Enviar outro código'}</button>
        <button type="button" className="forgot-change" onClick={() => { setStep('phone'); setError(''); setNotice('') }}>Trocar o número</button>
      </form>}
      {step === 'done' && <div className="modal-form">
        <div className="forgot-notice" role="status">Senha alterada! Seu e-mail de acesso é <strong>{email}</strong>. Entre com ele e a nova senha.</div>
        <button className="button primary" type="button" onClick={() => onDone(email)}>Voltar para o login <ArrowRight size={17} /></button>
      </div>}
    </section>
  </div>
}

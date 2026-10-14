import { useState, type FormEvent } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { Courier, CourierInput } from '../../api'
import { formatPhone } from '../../utils/phone'

type Props = {
  modal: { kind: 'newCourier' } | { kind: 'editCourier'; courier: Courier }
  saving: boolean
  error: string
  onClose: () => void
  onSave: (data: CourierInput) => Promise<void>
}

export function CourierModal({ modal, saving, error, onClose, onSave }: Props) {
  const courier = modal.kind === 'editCourier' ? modal.courier : null
  const [name, setName] = useState(courier?.name ?? '')
  const [email, setEmail] = useState(courier?.email ?? '')
  const [phone, setPhone] = useState(formatPhone(courier?.phone ?? ''))
  const [vehicle, setVehicle] = useState(courier?.vehicle ?? '')
  const [password, setPassword] = useState('')
  const [active, setActive] = useState(courier?.active ?? true)
  const [localError, setLocalError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10 && digits.length !== 11) {
      setLocalError('Informe um telefone com DDD.')
      return
    }
    if ((!courier || password) && (password.length < 12 || new TextEncoder().encode(password).length > 72)) {
      setLocalError('A senha deve ter pelo menos 12 caracteres e até 72 bytes.')
      return
    }
    setLocalError('')
    void onSave({ name: name.trim(), email: email.trim(), phone: digits, vehicle: vehicle.trim(), password, active })
  }

  return <div className="modal-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !saving) onClose()
  }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="courier-modal-title">
    <div className="modal-head"><div><span className="eyebrow">EQUIPE • ENTREGAS</span>
      <h2 id="courier-modal-title">{courier ? 'Editar entregador' : 'Novo entregador'}</h2></div>
      <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={20} /></button></div>
    <form onSubmit={submit} className="modal-form">
      <label>Nome completo<input value={name} onChange={event => setName(event.target.value)}
        maxLength={100} required autoFocus placeholder="Nome do entregador" /></label>
      <label>E-mail de acesso<input type="email" value={email} onChange={event => setEmail(event.target.value)}
        maxLength={254} required autoComplete="off" placeholder="entregador@exemplo.com" /></label>
      <label>Telefone com DDD<input type="tel" inputMode="numeric" autoComplete="tel" value={phone}
        onChange={event => setPhone(formatPhone(event.target.value))}
        maxLength={15} required placeholder="(85) 99999-9999" /></label>
      <label>Veículo <span className="optional">(opcional)</span><input value={vehicle}
        onChange={event => setVehicle(event.target.value)} maxLength={100} placeholder="Ex.: Fiorino • ABC-1D23" /></label>
      <label>{courier ? 'Nova senha' : 'Senha inicial'} {courier && <span className="optional">(opcional)</span>}
        <input type="password" value={password} onChange={event => setPassword(event.target.value)}
          minLength={12} maxLength={72} required={!courier} autoComplete="new-password"
          placeholder={courier ? 'Deixe vazio para manter a senha atual' : 'Mínimo de 12 caracteres'} /></label>
      <small className="field-help">{courier
        ? 'Ao definir uma nova senha, os acessos já concedidos serão encerrados.'
        : 'Informe a senha ao entregador por um canal seguro. Ela não será exibida novamente.'}</small>
      <label className="branch-option"><input type="checkbox" checked={active}
        onChange={event => setActive(event.target.checked)} /><span>Conta ativa para login</span></label>
      {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}
        disabled={saving}>Cancelar</button><button type="submit" className="button primary" disabled={saving}>
        {saving ? 'Salvando...' : courier ? 'Salvar alterações' : 'Cadastrar entregador'} <ArrowRight size={17} />
      </button></div>
    </form>
  </section></div>
}

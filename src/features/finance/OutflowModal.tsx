import { useState, type FormEvent } from 'react'
import { ArrowDownCircle, ArrowRight, X } from 'lucide-react'
import { FormIntro } from '../../components/FormIntro'
import { api, type Branch } from '../../api'
import { branchLabel } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { announceSaved } from '../../components/SavedToast'

export const OUTFLOW_CATEGORIES = [
  ['MANUTENCAO', 'Manutenção'], ['COMBUSTIVEL', 'Combustível'], ['FRETE', 'Frete e entrega'], ['SALARIOS', 'Salários'],
  ['COMPRA_POLTRONA', 'Compra de poltrona'], ['ALUGUEL', 'Aluguel do espaço'], ['IMPOSTOS', 'Impostos e taxas'],
  ['MARKETING', 'Marketing'], ['OUTRAS_DESPESAS', 'Outras despesas'],
] as const
const METHODS = [['PIX', 'Pix'], ['DINHEIRO', 'Dinheiro'], ['CARTAO', 'Cartão'], ['TRANSFERENCIA', 'Transferência'], ['BOLETO', 'Boleto']] as const
const ALL = '__todas__'
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })

/** "70,00" → 7000 centavos. Aceita "70", "70,5", "1.200,00". */
function toCents(text: string) {
  const clean = text.replace(/[^\d,]/g, '')
  if (!clean) return 0
  const [reais, centavos = ''] = clean.split(',')
  return Number(reais || '0') * 100 + Number(centavos.padEnd(2, '0').slice(0, 2))
}

/** Registrar saída (igual ao app): valor, com o quê, descrição, filial, meio e dia. */
export function OutflowModal({ credentials, branches, onClose, onSaved }: {
  credentials: string; branches: Branch[]; onClose: () => void; onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0].id : '')
  const [category, setCategory] = useState('MANUTENCAO')
  const [method, setMethod] = useState('PIX')
  const [date, setDate] = useState(todayIso)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cents = toCents(amount)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (cents <= 0) { setError('Informe quanto saiu.'); return }
    if (!branchId) { setError('Escolha a filial.'); return }
    setSaving(true)
    setError('')
    try {
      const target = branchId === ALL ? { branchIds: branches.map(branch => branch.id) } : { branchId }
      await api.registerOutflow(credentials, { ...target, amountCents: cents, category, paymentMethod: method, description: description.trim(), date })
      onSaved()
      announceSaved(`Saída de ${money.format(cents / 100)} registrada.`)
      onClose()
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="modal outflow-modal" role="dialog" aria-modal="true" aria-labelledby="outflow-modal-title">
      <div className="modal-head"><div><span className="eyebrow">FINANCEIRO • SAÍDAS</span>
        <h2 id="outflow-modal-title">Registrar saída</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      <form onSubmit={submit} className="modal-form">
        <FormIntro icon={<ArrowDownCircle size={24} />} title="O que saiu do caixa?">
          Anote o valor e com o que foi gasto. Entra nas Saídas do Financeiro na hora.</FormIntro>
        <label>Quanto saiu (R$)<input className="outflow-amount" inputMode="decimal" value={amount} required autoFocus
          onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label>
        <fieldset className="outflow-chips"><legend>Com o quê</legend>
          {OUTFLOW_CATEGORIES.map(([value, label]) => <button type="button" key={value} aria-pressed={category === value}
            className={category === value ? 'selected' : ''} onClick={() => setCategory(value)}>{label}</button>)}
        </fieldset>
        <label>Descrição<input value={description} maxLength={200} required onChange={event => setDescription(event.target.value)}
          placeholder="Ex.: troca do motor da poltrona 12" /></label>
        <label>Filial<select value={branchId} required onChange={event => setBranchId(event.target.value)}>
          <option value="">Selecione</option>
          {branches.length > 1 && <option value={ALL}>Todas as filiais</option>}
          {branches.map(branch => <option key={branch.id} value={branch.id}>{branchLabel(branch.name)}</option>)}
        </select></label>
        {branchId === ALL && cents > 0 && <small className="field-help">
          Dividido igualmente: {money.format(Math.floor(cents / branches.length) / 100)} para cada uma das {branches.length} filiais.</small>}
        <fieldset className="outflow-chips"><legend>Como foi pago</legend>
          {METHODS.map(([value, label]) => <button type="button" key={value} aria-pressed={method === value}
            className={method === value ? 'selected' : ''} onClick={() => setMethod(value)}>{label}</button>)}
        </fieldset>
        <label>Dia da saída<input type="date" value={date} max={todayIso()} required onChange={event => setDate(event.target.value)} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Salvando...' : cents > 0 ? `Registrar saída de ${money.format(cents / 100)}` : 'Registrar saída'} <ArrowRight size={17} />
          </button></div>
      </form>
    </section>
  </div>
}

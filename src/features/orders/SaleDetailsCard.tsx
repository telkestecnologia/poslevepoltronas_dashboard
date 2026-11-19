import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { api, type Order, type SaleDetails } from '../../api'
import { getMessage } from '../../utils/errors'
import { toCents } from '../../utils/money'
import './manual-order.css'

const EMPTY_SALE: SaleDetails = {
  paymentMethod: null, pixMode: null, cardMode: null, cardInstallments: null, discount: null, discountCents: null,
  discountNote: null, plan: null, referral: null, referralName: null, invoice: null,
}
const centsText = (cents: number | null | undefined) => cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',')

/** Botões de escolha (um só selecionado), usados na ficha da venda. */
function Pick<T extends string | boolean>({ value, options, onChange }: { value: T | null; options: [T, string][]; onChange: (value: T) => void }) {
  return <div className="sd-pick" role="radiogroup">
    {options.map(([option, label]) => <button type="button" key={String(option)} role="radio" aria-checked={value === option}
      className={value === option ? 'selected' : ''} onClick={() => onChange(option)}>{label}</button>)}
  </div>
}

/**
 * Detalhes da venda (a ficha que a equipe preenchia): forma de pagamento, desconto, plano, indicação e nota fiscal.
 * Sempre aberta para editar; Salvar grava, Cancelar volta ao que estava salvo.
 */
export function SaleDetailsCard({ credentials, order }: { credentials: string; order: Order }) {
  const [saved, setSaved] = useState<SaleDetails | null | undefined>(undefined)
  const [draft, setDraft] = useState<SaleDetails>(EMPTY_SALE)
  const [discount, setDiscount] = useState('')
  const [plans, setPlans] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    api.saleDetails(credentials, order.id).then(found => {
      if (!active) return
      setSaved(found)
      setDraft(found ?? EMPTY_SALE)
      setDiscount(centsText(found?.discountCents))
    }).catch(() => { if (active) setSaved(null) })
    api.pricing(credentials).then(catalog => { if (active) setPlans(catalog.plans.map(plan => `${plan.name} (${plan.days} dias)`)) }).catch(() => {})
    return () => { active = false }
  }, [credentials, order.id])

  const set = (changes: Partial<SaleDetails>) => { setDraft(current => ({ ...current, ...changes })); setMessage('') }
  const current: SaleDetails = { ...draft, discountCents: draft.discount ? toCents(discount) : null, updatedAt: null, updatedBy: null }
  const base = saved ?? EMPTY_SALE
  const changed = JSON.stringify(current) !== JSON.stringify({ ...base, discountCents: base.discount ? base.discountCents : null, updatedAt: null, updatedBy: null })
  const planOptions = [...plans, ...(draft.plan && !plans.includes(draft.plan) && draft.plan !== 'Outro período' ? [draft.plan] : []), 'Outro período']

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const result = await api.saveSaleDetails(credentials, order.id, current)
      setSaved(result)
      setDraft(result)
      setDiscount(centsText(result.discountCents))
      setMessage('Detalhes da venda salvos.')
    } catch (cause) {
      setMessage(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    setDraft(saved ?? EMPTY_SALE)
    setDiscount(centsText(saved?.discountCents))
    setMessage('')
  }

  if (saved === undefined) return <section className="panel od-card sd-card"><p className="order-muted">Carregando detalhes da venda...</p></section>
  return <section className="panel od-card sd-card" aria-labelledby="sd-title">
    <div className="od-card-head"><h2 id="sd-title" className="od-side-title"><Wallet size={16} /> Detalhes da venda</h2></div>

    <div className="sd-field"><span>Forma de pagamento</span>
      <Pick value={draft.paymentMethod} options={[['PIX', 'Pix'], ['CARTAO', 'Cartão de crédito']]}
        onChange={value => set({ paymentMethod: value, pixMode: null, cardMode: null, cardInstallments: null })} /></div>
    {draft.paymentMethod === 'PIX' && <div className="sd-field"><span>Pix</span>
      <Pick value={draft.pixMode} options={[['A_VISTA', 'À vista'], ['ENTRADA_E_ENTREGA', 'Entrada + resto na entrega']]}
        onChange={value => set({ pixMode: value })} /></div>}
    {draft.paymentMethod === 'CARTAO' && <div className="sd-field"><span>Cartão</span>
      <Pick value={draft.cardMode} options={[['A_VISTA', 'À vista'], ['PARCELADO', 'Parcelado']]}
        onChange={value => set({ cardMode: value, cardInstallments: value === 'PARCELADO' ? draft.cardInstallments ?? 3 : null })} />
      {draft.cardMode === 'PARCELADO' && <label className="sd-inline">Parcelas
        <select value={draft.cardInstallments ?? 3} onChange={event => set({ cardInstallments: Number(event.target.value) })}>
          {Array.from({ length: 11 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count}x</option>)}</select>
        <small>com acréscimo da maquininha</small></label>}</div>}

    <div className="sd-field"><span>Teve desconto?</span>
      <Pick value={draft.discount} options={[[true, 'Sim'], [false, 'Não']]} onChange={value => set({ discount: value })} />
      {draft.discount && <div className="sd-row">
        <label className="sd-inline">Valor (R$)<input inputMode="decimal" value={discount} placeholder="0,00"
          onChange={event => { setDiscount(event.target.value); setMessage('') }} /></label>
        <label className="sd-inline sd-grow">Motivo<input maxLength={200} value={draft.discountNote ?? ''} placeholder="Ex.: paciente da Dra. Emiliane (10%)"
          onChange={event => set({ discountNote: event.target.value })} /></label></div>}</div>

    <div className="sd-field"><span>Plano escolhido</span>
      <Pick value={draft.plan} options={planOptions.map(plan => [plan, plan] as [string, string])} onChange={value => set({ plan: value })} /></div>

    <div className="sd-field"><span>Veio por indicação?</span>
      <Pick value={draft.referral} options={[[true, 'Sim'], [false, 'Não']]} onChange={value => set({ referral: value, referralName: value ? draft.referralName : null })} />
      {draft.referral && <label className="sd-inline sd-grow">De quem?<input maxLength={120} value={draft.referralName ?? ''}
        placeholder="Ex.: Dra. Emiliane, amiga Maria" onChange={event => set({ referralName: event.target.value })} /></label>}</div>

    <div className="sd-field"><span>Precisa de nota fiscal?</span>
      <Pick value={draft.invoice} options={[[true, 'Sim'], [false, 'Não']]} onChange={value => set({ invoice: value })} />
      {draft.invoice && <p className="sd-tip">A nota fiscal é entregue no momento da entrega da poltrona.</p>}</div>

    {message && <p className={message.endsWith('salvos.') ? 'sd-ok' : 'mo-warn'} role="status">{message}</p>}
    <div className="od-actions sd-actions">
      <button type="button" className="button secondary" disabled={busy || !changed} onClick={cancel}>Cancelar</button>
      <button type="button" className="button primary" disabled={busy || !changed} onClick={() => void save()}>{busy ? 'Salvando...' : 'Salvar'}</button>
    </div>
  </section>
}

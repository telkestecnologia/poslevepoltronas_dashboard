import { useEffect, useState } from 'react'
import { PenLine, Wallet } from 'lucide-react'
import { api, type Order, type SaleDetails } from '../../api'
import { currency } from '../../data/orders'
import { getMessage } from '../../utils/errors'
import { toCents } from '../../utils/money'
import './manual-order.css'

export const EMPTY_SALE: SaleDetails = {
  paymentMethod: null, pixMode: null, cardMode: null, cardInstallments: null, discount: null, discountCents: null,
  discountNote: null, plan: null, referral: null, referralName: null, invoice: null,
}
export const centsText = (cents: number | null | undefined) => cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',')

/** Nomes dos planos do cadastro de preços, para as opções de "Plano escolhido". */
export function usePlanNames(credentials: string) {
  const [plans, setPlans] = useState<string[]>([])
  useEffect(() => {
    let active = true
    api.pricing(credentials).then(catalog => { if (active) setPlans(catalog.plans.map(plan => `${plan.name} (${plan.days} dias)`)) }).catch(() => {})
    return () => { active = false }
  }, [credentials])
  return plans
}

function Pick<T extends string | boolean>({ value, options, onChange }: { value: T | null; options: [T, string][]; onChange: (value: T) => void }) {
  return <div className="sd-pick" role="radiogroup">
    {options.map(([option, label]) => <button type="button" key={String(option)} role="radio" aria-checked={value === option}
      className={value === option ? 'selected' : ''} onClick={() => onChange(option)}>{label}</button>)}
  </div>
}

/**
 * As perguntas da ficha da venda (forma de pagamento, desconto, plano, indicação e nota fiscal), controladas por quem
 * usa: o cadastro do pedido manual e a edição no Pedido manual. discount é o valor do desconto digitado (R$).
 */
export function SaleDetailsFields({ value, discount, plans, onChange, onDiscount }: {
  value: SaleDetails; discount: string; plans: string[]; onChange: (changes: Partial<SaleDetails>) => void; onDiscount: (text: string) => void
}) {
  const planOptions = [...plans, ...(value.plan && !plans.includes(value.plan) && value.plan !== 'Outro período' ? [value.plan] : []), 'Outro período']
  return <div className="sd-fields">
    <div className="sd-field"><span>Forma de pagamento</span>
      <Pick value={value.paymentMethod} options={[['PIX', 'Pix'], ['CARTAO', 'Cartão de crédito']]}
        onChange={method => onChange({ paymentMethod: method, pixMode: null, cardMode: null, cardInstallments: null })} /></div>
    {value.paymentMethod === 'PIX' && <div className="sd-field"><span>Pix</span>
      <Pick value={value.pixMode} options={[['A_VISTA', 'À vista'], ['ENTRADA_E_ENTREGA', 'Entrada + resto na entrega']]}
        onChange={mode => onChange({ pixMode: mode })} /></div>}
    {value.paymentMethod === 'CARTAO' && <div className="sd-field"><span>Cartão</span>
      <Pick value={value.cardMode} options={[['A_VISTA', 'À vista'], ['PARCELADO', 'Parcelado']]}
        onChange={mode => onChange({ cardMode: mode, cardInstallments: mode === 'PARCELADO' ? value.cardInstallments ?? 3 : null })} />
      {value.cardMode === 'PARCELADO' && <label className="sd-inline">Parcelas
        <select value={value.cardInstallments ?? 3} onChange={event => onChange({ cardInstallments: Number(event.target.value) })}>
          {Array.from({ length: 11 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count}x</option>)}</select>
        <small>com acréscimo da maquininha</small></label>}</div>}
    <div className="sd-field"><span>Teve desconto?</span>
      <Pick value={value.discount} options={[[true, 'Sim'], [false, 'Não']]} onChange={choice => onChange({ discount: choice })} />
      {value.discount && <div className="sd-row">
        <label className="sd-inline">Valor (R$)<input inputMode="decimal" value={discount} placeholder="0,00" onChange={event => onDiscount(event.target.value)} /></label>
        <label className="sd-inline sd-grow">Motivo<input maxLength={200} value={value.discountNote ?? ''} placeholder="Ex.: paciente da Dra. Emiliane (10%)"
          onChange={event => onChange({ discountNote: event.target.value })} /></label></div>}</div>
    <div className="sd-field"><span>Plano escolhido</span>
      <Pick value={value.plan} options={planOptions.map(plan => [plan, plan] as [string, string])} onChange={plan => onChange({ plan })} /></div>
    <div className="sd-field"><span>Veio por indicação?</span>
      <Pick value={value.referral} options={[[true, 'Sim'], [false, 'Não']]} onChange={choice => onChange({ referral: choice, referralName: choice ? value.referralName : null })} />
      {value.referral && <label className="sd-inline sd-grow">De quem?<input maxLength={120} value={value.referralName ?? ''}
        placeholder="Ex.: Dra. Emiliane, amiga Maria" onChange={event => onChange({ referralName: event.target.value })} /></label>}</div>
    <div className="sd-field"><span>Precisa de nota fiscal?</span>
      <Pick value={value.invoice} options={[[true, 'Sim'], [false, 'Não']]} onChange={choice => onChange({ invoice: choice })} />
      {value.invoice && <p className="sd-tip">A nota fiscal é entregue no momento da entrega da poltrona.</p>}</div>
  </div>
}

/** Texto de cada resposta, para o resumo no pedido. */
function summaryRows(sale: SaleDetails) {
  const method = sale.paymentMethod === 'PIX' ? `Pix${sale.pixMode === 'ENTRADA_E_ENTREGA' ? ' (entrada + resto na entrega)' : sale.pixMode === 'A_VISTA' ? ' à vista' : ''}`
    : sale.paymentMethod === 'CARTAO' ? `Cartão${sale.cardMode === 'PARCELADO' ? ` em ${sale.cardInstallments ?? 3}x (com acréscimo da maquininha)` : sale.cardMode === 'A_VISTA' ? ' à vista' : ''}` : null
  return [
    ['Forma de pagamento', method],
    ['Desconto', sale.discount == null ? null : sale.discount ? [sale.discountCents ? currency(sale.discountCents) : 'Sim', sale.discountNote].filter(Boolean).join(' • ') : 'Não'],
    ['Plano', sale.plan],
    ['Indicação', sale.referral == null ? null : sale.referral ? sale.referralName || 'Sim' : 'Não'],
    ['Nota fiscal', sale.invoice == null ? null : sale.invoice ? 'Sim (entregue junto com a poltrona)' : 'Não'],
  ] as [string, string | null][]
}

/**
 * Detalhes da venda no pedido: só o resumo. Para mudar, o botão leva ao Pedido manual (onde a venda foi cadastrada),
 * com este pedido aberto para editar.
 */
export function SaleDetailsSummary({ credentials, order, onEdit }: { credentials: string; order: Order; onEdit: () => void }) {
  const [sale, setSale] = useState<SaleDetails | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    api.saleDetails(credentials, order.id).then(found => { if (active) setSale(found) }).catch(() => { if (active) setSale(null) })
    return () => { active = false }
  }, [credentials, order.id])
  const rows = sale ? summaryRows(sale).filter(([, value]) => value) : []
  return <section className="panel od-card sd-card" aria-labelledby="sd-title">
    <div className="od-card-head"><h2 id="sd-title" className="od-side-title"><Wallet size={16} /> Detalhes da venda</h2></div>
    {sale === undefined ? <p className="order-muted">Carregando...</p>
      : rows.length === 0 ? <p className="order-muted">Ainda não preenchido.</p>
        : <dl className="od-facts sd-summary">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <button type="button" className="button secondary sd-edit" onClick={onEdit}><PenLine size={15} /> Alterar no Pedido manual</button>
  </section>
}

/** Edição dos detalhes da venda dentro do Pedido manual (aberta pelo botão do pedido). */
export function SaleDetailsEditor({ credentials, order, onDone }: { credentials: string; order: Order; onDone: () => void }) {
  const plans = usePlanNames(credentials)
  const [saved, setSaved] = useState<SaleDetails | null | undefined>(undefined)
  const [draft, setDraft] = useState<SaleDetails>(EMPTY_SALE)
  const [discount, setDiscount] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    api.saleDetails(credentials, order.id).then(found => {
      if (!active) return
      setSaved(found); setDraft(found ?? EMPTY_SALE); setDiscount(centsText(found?.discountCents))
    }).catch(() => { if (active) setSaved(null) })
    return () => { active = false }
  }, [credentials, order.id])

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      await api.saveSaleDetails(credentials, order.id, { ...draft, discountCents: draft.discount ? toCents(discount) : null })
      onDone()
    } catch (cause) {
      setMessage(getMessage(cause))
      setBusy(false)
    }
  }

  if (saved === undefined) return <p className="order-muted">Carregando...</p>
  return <div className="sd-card">
    <SaleDetailsFields value={draft} discount={discount} plans={plans}
      onChange={changes => { setDraft(current => ({ ...current, ...changes })); setMessage('') }} onDiscount={setDiscount} />
    {message && <p className="mo-warn" role="alert">{message}</p>}
    <div className="od-actions sd-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={onDone}>Voltar ao pedido</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => void save()}>{busy ? 'Salvando...' : 'Salvar e voltar ao pedido'}</button>
    </div>
  </div>
}

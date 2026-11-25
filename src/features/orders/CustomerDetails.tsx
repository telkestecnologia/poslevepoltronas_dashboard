import { useEffect, useState } from 'react'
import { api, type CustomerDetails, type Order, type SaleDetails } from '../../api'
import { getMessage } from '../../utils/errors'
import { toCents } from '../../utils/money'
import { brazilPhoneDigits, formatPhone } from '../../utils/phone'
import { centsText, EMPTY_SALE, SaleDetailsFields, summaryRows, usePlanNames } from './SaleDetailsCard'
import './manual-order.css'

export const EMPTY_CUSTOMER: CustomerDetails = {
  cpf: null, email: null, recipientName: null, recipientPhone: null, placeType: null, parking: null, floor: null,
}

export const placeLabels = { CASA: 'Casa', CONDOMINIO: 'Condomínio', APARTAMENTO: 'Apartamento' } as const

const formatCep = (value: string) => {
  // CEP sempre com ponto e traço: 62.360-000.
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`
    : digits.length > 2 ? `${digits.slice(0, 2)}.${digits.slice(2)}` : digits
}

export const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** CPF e e-mail do cliente (etapa Cliente do cadastro). */
export function CustomerIdFields({ value, onChange }: { value: CustomerDetails; onChange: (changes: Partial<CustomerDetails>) => void }) {
  return <>
    <label>CPF<input inputMode="numeric" value={formatCpf(value.cpf ?? '')} placeholder="000.000.000-00"
      onChange={event => onChange({ cpf: event.target.value.replace(/\D/g, '').slice(0, 11) })} /></label>
    <label>E-mail <em>(opcional)</em><input type="email" value={value.email ?? ''} maxLength={120} placeholder="cliente@email.com"
      onChange={event => onChange({ email: event.target.value })} /></label>
  </>
}

/** Quem recebe e as informações do local (etapa Endereço do cadastro). */
export function DeliveryPlaceFields({ value, onChange }: { value: CustomerDetails; onChange: (changes: Partial<CustomerDetails>) => void }) {
  return <>
    <label>Quem vai receber a poltrona<input value={value.recipientName ?? ''} maxLength={120} placeholder="Nome de quem recebe"
      onChange={event => onChange({ recipientName: event.target.value })} /></label>
    <label>Celular de quem vai receber<input type="tel" inputMode="numeric" value={formatPhone(value.recipientPhone ?? '')} maxLength={15}
      placeholder="(85) 99999-9999" onChange={event => onChange({ recipientPhone: event.target.value.replace(/\D/g, '').slice(0, 11) })} /></label>
    <div className="mw-wide sd-field"><span>É casa, condomínio ou apartamento?</span>
      <div className="sd-pick" role="radiogroup">
        {(Object.keys(placeLabels) as (keyof typeof placeLabels)[]).map(place => <button type="button" key={place} role="radio"
          aria-checked={value.placeType === place} className={value.placeType === place ? 'selected' : ''}
          onClick={() => onChange({ placeType: place })}>{placeLabels[place]}</button>)}
      </div></div>
    <label>Tem local para estacionar?<input value={value.parking ?? ''} maxLength={200} placeholder="Ex.: sim; precisa cadastrar a placa na portaria"
      onChange={event => onChange({ parking: event.target.value })} /></label>
    <label>Andar (térreo ou qual andar)<input value={value.floor ?? ''} maxLength={120} placeholder="Ex.: térreo; 2º andar sem elevador"
      onChange={event => onChange({ floor: event.target.value })} /></label>
  </>
}

/** Linhas da ficha do cliente (CPF, e-mail, quem recebe e o local). */
export function customerRows(customer: CustomerDetails | null): [string, string][] {
  const rows: [string, string | null][] = [
    ['CPF', customer?.cpf ? formatCpf(customer.cpf) : null],
    ['E-mail', customer?.email ?? null],
    ['Quem recebe', [customer?.recipientName, customer?.recipientPhone ? formatPhone(customer.recipientPhone) : null].filter(Boolean).join(' • ') || null],
    ['Local', customer?.placeType ? placeLabels[customer.placeType] : null],
    ['Estacionamento', customer?.parking ?? null],
    ['Andar', customer?.floor ?? null],
  ]
  return rows.filter((row): row is [string, string] => Boolean(row[1]))
}

/** Linhas dos detalhes da venda. */
export const saleRows = (sale: SaleDetails | null): [string, string][] =>
  sale ? summaryRows(sale).filter((row): row is [string, string] => Boolean(row[1])) : []

/** Busca a ficha do cliente e os detalhes da venda de um pedido. */
export function useFicha(credentials: string, orderId: string, enabled: boolean) {
  const [data, setData] = useState<{ id: string; customer: CustomerDetails | null; sale: SaleDetails | null } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void Promise.all([api.customerDetails(credentials, orderId).catch(() => null), api.saleDetails(credentials, orderId).catch(() => null)])
      .then(([customer, sale]) => { if (active) setData({ id: orderId, customer, sale }) })
    return () => { active = false }
  }, [credentials, orderId, enabled])
  return data?.id === orderId ? data : null
}

/**
 * Alterar a ficha do pedido dentro do Pedido manual: dados do cliente, do local e da venda, num formulário só.
 * Ao salvar, volta para o pedido.
 */
export function OrderFichaEditor({ credentials, order, onDone, onCancel, inFicha }: {
  credentials: string; order: Order; onDone: () => void
  /** Na janela da Ficha do cliente: Cancelar volta para a ficha sem salvar. */
  onCancel?: () => void; inFicha?: boolean
}) {
  const plans = usePlanNames(credentials)
  const [loaded, setLoaded] = useState(false)
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER)
  const [sale, setSale] = useState<SaleDetails>(EMPTY_SALE)
  const [discount, setDiscount] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  // Nome, WhatsApp, endereço e CEP do pedido: também podem ser corrigidos aqui.
  const [name, setName] = useState(order.customerName)
  const [phone, setPhone] = useState(formatPhone(brazilPhoneDigits(order.customerPhone)))
  const [address, setAddress] = useState(order.address)
  const [cep, setCep] = useState(formatCep(order.postalCode ?? ''))

  useEffect(() => {
    let active = true
    void Promise.all([api.customerDetails(credentials, order.id).catch(() => null), api.saleDetails(credentials, order.id).catch(() => null)])
      .then(([foundCustomer, foundSale]) => {
        if (!active) return
        setCustomer(foundCustomer ?? EMPTY_CUSTOMER); setSale(foundSale ?? EMPTY_SALE); setDiscount(centsText(foundSale?.discountCents)); setLoaded(true)
      })
    return () => { active = false }
  }, [credentials, order.id])

  async function save() {
    const digits = phone.replace(/\D/g, '')
    if (name.trim().length < 3) { setMessage('Informe o nome completo da cliente.'); return }
    if (digits.length !== 10 && digits.length !== 11) { setMessage('Informe o WhatsApp com DDD.'); return }
    if (!address.trim()) { setMessage('Informe o endereço de entrega.'); return }
    setBusy(true)
    setMessage('')
    try {
      const sameCustomer = name.trim() === order.customerName && digits === brazilPhoneDigits(order.customerPhone)
        && address.trim() === order.address && cep.replace(/\D/g, '') === (order.postalCode ?? '').replace(/\D/g, '')
      if (!sameCustomer) await api.updateOrderCustomer(credentials, order.id, { customerName: name.trim(), customerPhone: digits, address: address.trim(), cep })
      await api.saveCustomerDetails(credentials, order.id, customer)
      await api.saveSaleDetails(credentials, order.id, { ...sale, discountCents: sale.discount ? toCents(discount) : null })
      onDone()
    } catch (cause) {
      setMessage(getMessage(cause))
      setBusy(false)
    }
  }

  if (!loaded) return <p className="order-muted">Carregando...</p>
  const changeCustomer = (changes: Partial<CustomerDetails>) => { setCustomer(current => ({ ...current, ...changes })); setMessage('') }
  return <div className="sd-card">
    <p className="mw-question">Cliente</p>
    <div className="mw-grid">
      <label>Nome completo<input value={name} maxLength={120} onChange={event => { setName(event.target.value); setMessage('') }} /></label>
      <label>WhatsApp com DDD<input type="tel" inputMode="numeric" value={phone} maxLength={15} placeholder="(85) 99999-9999"
        onChange={event => { setPhone(formatPhone(event.target.value)); setMessage('') }} /></label>
      <CustomerIdFields value={customer} onChange={changeCustomer} />
    </div>
    <p className="mw-question">Entrega e local</p>
    <div className="mw-grid">
      <label className="mw-wide">Endereço de entrega <em>(rua, número, complemento e bairro)</em><input value={address} maxLength={300}
        onChange={event => { setAddress(event.target.value); setMessage('') }} /></label>
      <label>CEP <em>(opcional)</em><input inputMode="numeric" value={cep} placeholder="00.000-000"
        onChange={event => setCep(formatCep(event.target.value))} /></label>
      <label>Cidade<input value={`${order.municipalityName}/${order.municipalityUf}`} disabled /></label>
      <DeliveryPlaceFields value={customer} onChange={changeCustomer} />
    </div>
    <p className="mw-question">Detalhes da venda</p>
    <SaleDetailsFields value={sale} discount={discount} plans={plans} onChange={changes => { setSale(current => ({ ...current, ...changes })); setMessage('') }}
      onDiscount={setDiscount} />
    {message && <p className="mo-warn" role="alert">{message}</p>}
    <div className="od-actions sd-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={onCancel ?? onDone}>{inFicha ? 'Cancelar' : 'Voltar ao pedido'}</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => void save()}>{busy ? 'Salvando...' : inFicha ? 'Salvar ficha' : 'Salvar e voltar ao pedido'}</button>
    </div>
  </div>
}

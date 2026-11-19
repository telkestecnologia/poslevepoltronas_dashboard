import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, ClipboardPlus, X } from 'lucide-react'
import { api, type Branch, type Chair, type ManualOrderInput, type ManualOrderPrefill, type Order, type PaymentMethod } from '../../api'
import { FormIntro } from '../../components/FormIntro'
import { currency, paymentMethodLabels } from '../../data/orders'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { toCents, todayIso } from '../../utils/money'
import { formatPhone } from '../../utils/phone'
import './manual-order.css'

const SHIFTS = [
  { value: '', label: 'Combinar depois' },
  { value: '08:00-12:00', label: 'Manhã (08h às 12h)' },
  { value: '13:00-18:00', label: 'Tarde (13h às 18h)' },
]

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

/**
 * Cadastro manual (igual ao app): clientes de antes do sistema, já pagos e com contrato assinado fora dele, e exceções.
 * O pedido ocupa a poltrona no estoque como um pedido do site e começa na entrega (ou já em uso).
 */
export function ManualOrderModal({ credentials, branches, onClose, onCreated, inline, initial }: {
  credentials: string; branches: Branch[]; onClose?: () => void; onCreated: (order: Order) => void
  /** Vindo da conversa: o que a cliente já passou para a Isa. */
  initial?: ManualOrderPrefill | null
  /** Na página "Pedido manual" do menu: o formulário direto na tela, sem janela. */
  inline?: boolean
}) {
  const official = onlyOfficialBranches(branches, branch => branch.name)
  const options = (official.length ? official : branches).filter(branch => branch.active || official.length === 0)
  const [branchId, setBranchId] = useState(initial?.branchId ?? (options.length === 1 ? options[0].id : ''))
  const [cityCode, setCityCode] = useState(initial?.municipalityCode ?? '')
  const [name, setName] = useState(initial?.customerName ?? '')
  const [phone, setPhone] = useState(formatPhone((initial?.customerPhone ?? '').replace(/^55(?=\d{10,11}$)/, '')))
  const [cep, setCep] = useState(formatCep(initial?.cep ?? ''))
  const [street, setStreet] = useState(initial?.street ?? '')
  const [number, setNumber] = useState(initial?.number ?? '')
  const [complement, setComplement] = useState(initial?.complement ?? '')
  const [district, setDistrict] = useState(initial?.district ?? '')
  const [start, setStart] = useState(initial?.start ?? '')
  const [end, setEnd] = useState(initial?.end ?? '')
  const [deliveryTime, setDeliveryTime] = useState(SHIFTS.some(shift => shift.value === initial?.deliveryTime) ? initial!.deliveryTime! : '')
  const [pickupTime, setPickupTime] = useState(SHIFTS.some(shift => shift.value === initial?.pickupTime) ? initial!.pickupTime! : '')
  const [status, setStatus] = useState<ManualOrderInput['status']>('DELIVERY_PENDING')
  const [chairs, setChairs] = useState<{ key: string; list: Chair[]; error?: string } | null>(null)
  const [chairId, setChairId] = useState('')
  const [rental, setRental] = useState(initial?.rentalCents != null ? (initial.rentalCents / 100).toFixed(2).replace('.', ',') : '')
  const [freight, setFreight] = useState(initial?.freightCents != null ? (initial.freightCents / 100).toFixed(2).replace('.', ',') : '')
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [paidOn, setPaidOn] = useState(todayIso())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const branch = options.find(item => item.id === branchId)
  const cities = useMemo(() => [...(branch?.municipalities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [branch])
  const periodOk = Boolean(start && end && end >= start)
  const chairKey = branchId && periodOk ? `${branchId}|${start}|${end}` : ''

  // Poltronas livres em todo o período, da filial escolhida.
  useEffect(() => {
    if (!chairKey) return
    let active = true
    const [id, from, to] = chairKey.split('|')
    api.manualOrderChairs(credentials, id, from, to)
      .then(list => {
        if (!active) return
        setChairs({ key: chairKey, list })
        setChairId(current => list.some(chair => chair.id === current) ? current : list[0]?.id ?? '')
      })
      .catch(cause => { if (active) setChairs({ key: chairKey, list: [], error: getMessage(cause) }) })
    return () => { active = false }
  }, [credentials, chairKey])

  const available = chairs && chairs.key === chairKey ? chairs : null
  const totalCents = toCents(rental) + toCents(freight)
  const paidCents = toCents(paid)

  function chooseCity(code: string) {
    setCityCode(code)
    const city = cities.find(item => item.code === code)
    // Frete da cidade na filial como ponto de partida; a equipe pode mudar.
    if (city && !freight) setFreight(city.freightCents ? (city.freightCents / 100).toFixed(2).replace('.', ',') : '0')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10 && digits.length !== 11) return setError('Informe o WhatsApp do cliente com DDD.')
    if (!branchId || !cityCode) return setError('Escolha a filial e a cidade.')
    if (!periodOk) return setError('A retirada precisa ser no mesmo dia ou depois da entrega.')
    if (!chairId) return setError('Nenhuma poltrona livre nesse período. Mude as datas ou libere uma poltrona.')
    if (totalCents <= 0) return setError('Informe o valor do aluguel ou do frete.')
    if (paidCents > totalCents) return setError(`O valor já pago passa do total (${currency(totalCents)}).`)
    setError('')
    setSaving(true)
    try {
      const order = await api.createManualOrder(credentials, {
        customerName: name.trim(), customerPhone: digits, cep: cep.replace(/\D/g, '') || undefined,
        street: street.trim(), number: number.trim() || undefined, complement: complement.trim() || undefined,
        district: district.trim(), municipalityCode: cityCode, branchId, chairId, start, end,
        deliveryTime: deliveryTime || undefined, pickupTime: pickupTime || undefined,
        rentalCents: toCents(rental), freightCents: toCents(freight), status,
        internalNote: note.trim() || undefined,
        initialPayment: paidCents > 0 ? { amountCents: paidCents, method, paidOn } : undefined,
      })
      onCreated(order)
    } catch (cause) {
      setError(getMessage(cause))
      setSaving(false)
    }
  }

  const form = <>
      <form className="modal-form mo-form" onSubmit={event => void submit(event)}>
        <FormIntro icon={<ClipboardPlus size={24} />} title="Cliente de antes do sistema ou exceção">
          O contrato fica registrado como assinado fora do sistema. A poltrona fica ocupada no período, a cliente recebe os
          avisos de saída para entrega e de retirada, e não recebe recibo nem “pedido recebido”.</FormIntro>

        <fieldset><legend>Cliente</legend>
          <div className="mo-grid">
            <label>Nome completo<input value={name} onChange={event => setName(event.target.value)} required minLength={3}
              maxLength={120} autoFocus placeholder="Nome do cliente" /></label>
            <label>WhatsApp com DDD<input type="tel" inputMode="numeric" value={phone} required maxLength={15}
              onChange={event => setPhone(formatPhone(event.target.value))} placeholder="(85) 99999-9999" /></label>
          </div>
        </fieldset>

        <fieldset><legend>Endereço de entrega</legend>
          <div className="mo-grid">
            <label>Filial<select value={branchId} required onChange={event => { setBranchId(event.target.value); setCityCode('') }}>
              <option value="">Escolha a filial</option>
              {options.map(item => <option key={item.id} value={item.id}>{branchLabel(item.name)}</option>)}
            </select></label>
            <label>Cidade<select value={cityCode} required disabled={!branch} onChange={event => chooseCity(event.target.value)}>
              <option value="">{branch ? 'Escolha a cidade' : 'Escolha a filial antes'}</option>
              {cities.map(city => <option key={city.code} value={city.code}>{city.name}</option>)}
            </select></label>
            <label className="mo-wide">Rua<input value={street} onChange={event => setStreet(event.target.value)} required maxLength={160}
              placeholder="Rua, avenida..." /></label>
            <label>Número <span className="optional">(opcional)</span><input value={number} maxLength={20}
              onChange={event => setNumber(event.target.value)} placeholder="Sem número: deixe vazio" /></label>
            <label>Bairro<input value={district} onChange={event => setDistrict(event.target.value)} required maxLength={100} /></label>
            <label>Complemento <span className="optional">(opcional)</span><input value={complement} maxLength={160}
              onChange={event => setComplement(event.target.value)} placeholder="Apto, bloco, referência" /></label>
            <label>CEP <span className="optional">(opcional)</span><input inputMode="numeric" value={cep}
              onChange={event => setCep(formatCep(event.target.value))} placeholder="00000-000" /></label>
          </div>
        </fieldset>

        <fieldset><legend>Período e poltrona</legend>
          <div className="mo-grid">
            <label>Entrega<input type="date" value={start} required onChange={event => setStart(event.target.value)} /></label>
            <label>Turno da entrega<select value={deliveryTime} onChange={event => setDeliveryTime(event.target.value)}>
              {SHIFTS.map(shift => <option key={shift.value} value={shift.value}>{shift.label}</option>)}</select></label>
            <label>Retirada<input type="date" value={end} required min={start || undefined} onChange={event => setEnd(event.target.value)} /></label>
            <label>Turno da retirada<select value={pickupTime} onChange={event => setPickupTime(event.target.value)}>
              {SHIFTS.map(shift => <option key={shift.value} value={shift.value}>{shift.label}</option>)}</select></label>
            <label className="mo-wide">Poltrona
              <select value={chairId} required disabled={!available || available.list.length === 0}
                onChange={event => setChairId(event.target.value)}>
                {!chairKey && <option value="">Escolha a filial e as datas</option>}
                {chairKey && !available && <option value="">Procurando poltronas livres...</option>}
                {available && available.list.length === 0 && <option value="">Nenhuma poltrona livre em todo o período</option>}
                {available?.list.map(chair => <option key={chair.id} value={chair.id}>
                  Poltrona {chair.code}{chair.model ? ` • ${chair.model}` : ''}{chair.notes ? ` • ${chair.notes}` : ''}</option>)}
              </select>
              {available?.error && <small className="field-help mo-warn">{available.error}</small>}
              {available && available.list.length > 0 && <small className="field-help">
                {available.list.length} {available.list.length === 1 ? 'poltrona livre' : 'poltronas livres'} em todo o período.</small>}</label>
          </div>
          <div className="mo-choice" role="radiogroup" aria-label="Situação do pedido">
            <label className={status === 'DELIVERY_PENDING' ? 'selected' : ''}><input type="radio" name="mo-status"
              checked={status === 'DELIVERY_PENDING'} onChange={() => setStatus('DELIVERY_PENDING')} />
              <span><strong>Aguardando entrega</strong><small>A poltrona ainda vai ser levada.</small></span></label>
            <label className={status === 'IN_USE' ? 'selected' : ''}><input type="radio" name="mo-status"
              checked={status === 'IN_USE'} onChange={() => setStatus('IN_USE')} />
              <span><strong>Já entregue (em uso)</strong><small>A poltrona já está com o cliente.</small></span></label>
          </div>
        </fieldset>

        <fieldset><legend>Valores e pagamento</legend>
          <div className="mo-grid">
            <label>Aluguel (R$)<input inputMode="decimal" value={rental} onChange={event => setRental(event.target.value)}
              placeholder="0,00" /></label>
            <label>Frete (R$)<input inputMode="decimal" value={freight} onChange={event => setFreight(event.target.value)}
              placeholder="0,00" /></label>
            <label>Já pago (R$) <span className="optional">(opcional)</span><input inputMode="decimal" value={paid}
              onChange={event => setPaid(event.target.value)} placeholder="0,00" /></label>
            <label>Forma<select value={method} disabled={paidCents <= 0} onChange={event => setMethod(event.target.value as PaymentMethod)}>
              {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Pago em<input type="date" value={paidOn} max={todayIso()} disabled={paidCents <= 0}
              onChange={event => setPaidOn(event.target.value)} /></label>
          </div>
          <p className="mo-total">Total <strong>{currency(totalCents)}</strong>
            {totalCents > 0 && <> • {paidCents >= totalCents ? <em className="paid">quitado</em>
              : <em className="due">falta {currency(totalCents - paidCents)}</em>}</>}</p>
        </fieldset>

        <fieldset><legend>Observação interna</legend>
          <label>Só a equipe vê <span className="optional">(opcional)</span>
            <textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}
              placeholder="Ex.: só quer poltrona bege; confirmar a data depois da consulta; precisa de nota fiscal" /></label>
        </fieldset>

        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="button primary" disabled={saving}>{saving ? 'Cadastrando...' : 'Cadastrar pedido'}
            <ArrowRight size={17} /></button></div>
      </form>
  </>

  if (inline) return <section className="panel mo-page">{form}</section>

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose?.() }}>
    <section className="modal mo-modal" role="dialog" aria-modal="true" aria-labelledby="mo-title">
      <div className="modal-head"><div><span className="eyebrow">PEDIDOS • CADASTRO MANUAL</span>
        <h2 id="mo-title">Novo pedido</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      {form}
    </section>
  </div>
}

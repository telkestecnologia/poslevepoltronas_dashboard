import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, Armchair, Camera, Check, CircleHelp, ClipboardCheck, CreditCard, FileSignature, History, MapPin, MessageCircleOff,
  Eraser, Percent, PiggyBank, Upload, User, Wallet, X,
} from 'lucide-react'
import {
  api, uploadOrderEvidenceFile, type Branch, type Chair, type CustomerDetails, type ManualReason, type Order, type SaleDetails,
  type PaymentMethod,
} from '../../api'
import { ContractLinkPanel, PaymentLinkPanel } from './ManualLinks'
import { currency, dateLabel, manualReasonLabels, paymentMethodLabels } from '../../data/orders'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { toCents, todayIso } from '../../utils/money'
import { formatPhone } from '../../utils/phone'
import { toJpeg } from './OrderEvidencePanel'
import { EMPTY_SALE, SaleDetailsFields, usePlanNames } from './SaleDetailsCard'
import { CustomerIdFields, DeliveryPlaceFields, EMPTY_CUSTOMER, customerRows, saleRows } from './CustomerDetails'
import { clearDraft, readDraft, writeDraft, type ManualDraft } from '../../utils/manualDraft'
import './manual-wizard.css'

/** Locação atual ou futura de uma poltrona (pedido ativo). late: passou da devolução e ainda está com a cliente. */
type ChairPeriod = { chairId: string; start: string; end: string; late: boolean }
const OCCUPYING: Order['status'][] = ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'IN_USE', 'PICKUP_PENDING']
const shortDate = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
/** Texto das locações de uma poltrona: "alugada de 01/12 a 10/12" ou "com cliente desde 10/11, devolução atrasada". */
function periodText(list: ChairPeriod[]) {
  return list.map(period => period.late ? `com cliente desde ${shortDate(period.start)} (devolução atrasada)`
    : `alugada de ${shortDate(period.start)} a ${shortDate(period.end)}`).join(' • ')
}

const SHIFTS = [
  { value: '', label: 'Combinar depois' },
  { value: '08:00-12:00', label: 'Manhã (08h às 12h)' },
  { value: '13:00-18:00', label: 'Tarde (13h às 18h)' },
]

const REASONS: { value: ManualReason; icon: typeof History; text: string }[] = [
  { value: 'ANTES_DO_SISTEMA', icon: History, text: 'A cliente alugou antes do sistema existir (estava na agenda ou na planilha).' },
  { value: 'DESCONTO', icon: Percent, text: 'A equipe negociou um desconto que a Isa não oferece.' },
  { value: 'SINAL', icon: PiggyBank, text: 'A cliente paga uma parte agora e o resto depois.' },
  { value: 'FORA_DO_WHATSAPP', icon: MessageCircleOff, text: 'A venda foi fechada por telefone, Instagram ou pessoalmente.' },
  { value: 'OUTRO', icon: CircleHelp, text: 'Outro caso combinado com a equipe. Explique na observação.' },
]

type Step = 'reason' | 'customer' | 'address' | 'period' | 'values' | 'contract' | 'payment' | 'photos' | 'review'
const STEPS: { key: Step; label: string; icon: typeof History }[] = [
  { key: 'reason', label: 'Motivo', icon: CircleHelp },
  { key: 'customer', label: 'Cliente', icon: User },
  { key: 'address', label: 'Endereço', icon: MapPin },
  { key: 'period', label: 'Período e poltrona', icon: Armchair },
  { key: 'values', label: 'Valores', icon: Wallet },
  { key: 'contract', label: 'Contrato', icon: FileSignature },
  { key: 'payment', label: 'Pagamento', icon: CreditCard },
  { key: 'photos', label: 'Fotos', icon: Camera },
  { key: 'review', label: 'Revisão', icon: ClipboardCheck },
]
/** A partir do Contrato o pedido já existe (salvo ao sair de Valores): as etapas de antes ficam travadas. */
const SAVED_FROM = STEPS.findIndex(item => item.key === 'contract')

type PaidState = 'ALL' | 'PART' | 'NONE'

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}
const centsText = (cents: number | null | undefined) => cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',')
const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * Cadastro manual em etapas (igual ao app): motivo, cliente, endereço, período e poltrona, pagamento, contrato
 * assinado, fotos e revisão. Cada etapa explica o porquê; o pedido só é criado na revisão.
 */
export function ManualOrderWizard({ credentials, branches, onCreated, onClear }: {
  credentials: string; branches: Branch[]; onCreated: (order: Order) => void
  /** "Limpar campos": apaga o rascunho e recomeça. */
  onClear: () => void
}) {
  const official = onlyOfficialBranches(branches, branch => branch.name)
  const options = (official.length ? official : branches).filter(branch => branch.active || official.length === 0)
  // Continua de onde parou: o rascunho (guardado neste navegador) vem da conversa com a Isa ou do que já foi digitado.
  const [draft] = useState<ManualDraft>(() => readDraft() ?? {})
  // Pedido já salvo (o cadastro chegou ao Contrato): o rascunho guarda o id para continuar de onde parou.
  const [createdId] = useState(draft.createdId ?? '')
  const [order, setOrder] = useState<Order | null>(null)
  const [orderId, setOrderId] = useState(createdId)
  const [step, setStep] = useState<Step>(() => {
    const saved = STEPS.findIndex(item => item.key === draft.step)
    if (saved < 0) return 'reason'
    return saved >= SAVED_FROM && !draft.createdId ? 'values' : STEPS[saved].key
  })
  const [reason, setReason] = useState<ManualReason | ''>((draft.reason as ManualReason) ?? '')
  const [name, setName] = useState(draft.name ?? '')
  const [phone, setPhone] = useState(draft.phone ?? '')
  const [branchId, setBranchId] = useState(draft.branchId || (options.length === 1 ? options[0].id : ''))
  const [cityCode, setCityCode] = useState(draft.cityCode ?? '')
  const [street, setStreet] = useState(draft.street ?? '')
  const [number, setNumber] = useState(draft.number ?? '')
  const [complement, setComplement] = useState(draft.complement ?? '')
  const [district, setDistrict] = useState(draft.district ?? '')
  const [cep, setCep] = useState(draft.cep ?? '')
  const [delivered, setDelivered] = useState<boolean | null>(draft.delivered ?? null)
  const [start, setStart] = useState(draft.start ?? '')
  const [end, setEnd] = useState(draft.end ?? '')
  const [deliveryTime, setDeliveryTime] = useState(draft.deliveryTime ?? '')
  const [pickupTime, setPickupTime] = useState(draft.pickupTime ?? '')
  const [chairs, setChairs] = useState<{ key: string; list: Chair[]; error?: string } | null>(null)
  const [chairChoice, setChairChoice] = useState(draft.chairChoice ?? '')
  // Todas as poltronas ativas da filial e as locações de cada uma, para mostrar o período em que estão alugadas.
  const [branchChairs, setBranchChairs] = useState<{ branchId: string; chairs: Chair[]; periods: ChairPeriod[] } | null>(null)
  const [rental, setRental] = useState(draft.rental ?? '')
  const [freight, setFreight] = useState(draft.freight ?? '')
  const [paidState, setPaidState] = useState<PaidState | ''>((draft.paidState as PaidState) ?? '')
  const [partial, setPartial] = useState(draft.partial ?? '')
  const [method, setMethod] = useState<PaymentMethod>((draft.method as PaymentMethod) ?? 'PIX')
  const [paidOn, setPaidOn] = useState(draft.paidOn ?? todayIso())
  const [deliveryPhotos, setDeliveryPhotos] = useState<File[]>([])
  const [pickupPhotos, setPickupPhotos] = useState<File[]>([])
  const [note, setNote] = useState(draft.note ?? '')
  const [sale, setSale] = useState<SaleDetails>(draft.sale ?? EMPTY_SALE)
  const [saleDiscount, setSaleDiscount] = useState(draft.saleDiscount ?? '')
  const [customer, setCustomer] = useState<CustomerDetails>(draft.customer ?? EMPTY_CUSTOMER)
  const changeCustomer = (changes: Partial<CustomerDetails>) => setCustomer(current => ({ ...current, ...changes }))
  const plans = usePlanNames(credentials)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')

  // Tudo o que é digitado fica no rascunho: dá para sair da tela e continuar depois.
  useEffect(() => {
    writeDraft({ step, reason, name, phone, branchId, cityCode, street, number, complement, district, cep, delivered, start, end,
      deliveryTime, pickupTime, chairChoice, rental, freight, paidState, partial, method, paidOn, note, conversationId: draft.conversationId, sale, saleDiscount, customer,
      createdId: orderId || undefined })
  }, [customer, sale, saleDiscount, step, reason, name, phone, branchId, cityCode, street, number, complement, district, cep, delivered, start, end,
    deliveryTime, pickupTime, chairChoice, rental, freight, paidState, partial, method, paidOn, note, draft.conversationId, orderId])

  // Voltou a um cadastro que já tinha salvado o pedido: busca a situação atual (contrato e pagamento).
  useEffect(() => {
    if (!createdId) return
    let active = true
    api.order(credentials, createdId).then(found => { if (active) setOrder(found) }, () => { if (active) setOrderId('') })
    return () => { active = false }
  }, [credentials, createdId])

  const branch = options.find(item => item.id === branchId)
  const cities = useMemo(() => [...(branch?.municipalities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [branch])
  const city = cities.find(item => item.code === cityCode)
  const chairKey = branchId && start && end && end >= start ? `${branchId}|${start}|${end}` : ''

  useEffect(() => {
    if (!chairKey) return
    let active = true
    const [id, from, to] = chairKey.split('|')
    api.manualOrderChairs(credentials, id, from, to)
      .then(list => { if (active) setChairs({ key: chairKey, list }) })
      .catch(cause => { if (active) setChairs({ key: chairKey, list: [], error: getMessage(cause) }) })
    return () => { active = false }
  }, [credentials, chairKey])

  useEffect(() => {
    if (!branchId) return
    let active = true
    const today = todayIso()
    void (async () => {
      try {
        const chairPage = await api.chairs(credentials, { page: 0, size: 100, search: '', status: 'ACTIVE', branchId })
        const orders: Order[] = []
        for (let page = 0; page < 10; page++) {
          const result = await api.orderPage(credentials, { statuses: OCCUPYING, source: ['CHECKOUT', 'MANUAL'], branchId }, page, 100)
          orders.push(...result.items)
          if (orders.length >= result.total || result.items.length === 0) break
        }
        const periods = orders.filter(order => order.chairId).map(order => {
          const first = order.stockStart ?? order.start
          const planned = order.stockEnd ?? order.end
          const last = order.pickupDate && order.pickupDate > planned ? order.pickupDate : planned
          const late = (order.status === 'IN_USE' || order.status === 'PICKUP_PENDING') && last < today
          return { chairId: order.chairId, start: first, end: last, late }
        }).filter(period => period.late || period.end >= today).sort((a, b) => a.start.localeCompare(b.start))
        if (active) setBranchChairs({ branchId, chairs: chairPage.items, periods })
      } catch { /* sem as datas, a lista de livres continua funcionando */ }
    })()
    return () => { active = false }
  }, [credentials, branchId])
  const periodsOf = (chairId: string) => branchChairs?.branchId === branchId ? branchChairs.periods.filter(period => period.chairId === chairId) : []
  const available = chairs && chairs.key === chairKey ? chairs : null
  // Poltronas da filial que não estão livres no período escolhido (aparecem desabilitadas, com as datas).
  const rentedInPeriod = available && branchChairs?.branchId === branchId
    ? branchChairs.chairs.filter(item => !available.list.some(free => free.id === item.id))
      .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true })) : []
  const chairId = available?.list.some(chair => chair.id === chairChoice) ? chairChoice : available?.list[0]?.id ?? ''
  const chair = available?.list.find(item => item.id === chairId)
  const totalCents = toCents(rental) + toCents(freight)
  const paidCents = paidState === 'ALL' ? totalCents : paidState === 'PART' ? toCents(partial) : 0
  const digits = phone.replace(/\D/g, '')
  const index = STEPS.findIndex(item => item.key === step)

  /** O que falta em cada etapa; vazio = pode seguir. */
  function problem(key: Step): string {
    switch (key) {
      case 'reason': return reason ? '' : 'Escolha o motivo do pedido manual.'
      case 'customer': return name.trim().length < 3 ? 'Informe o nome completo da cliente.'
        : digits.length !== 10 && digits.length !== 11 ? 'Informe o WhatsApp com DDD.'
          : customer.cpf && customer.cpf.length !== 11 ? 'O CPF precisa ter 11 números.'
            : customer.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) ? 'Confira o e-mail.' : ''
      case 'address': return !branchId ? 'Escolha a filial.' : !cityCode ? 'Escolha a cidade.'
        : !street.trim() || !district.trim() ? 'Informe a rua e o bairro.'
          : customer.recipientPhone && (customer.recipientPhone.length < 10) ? 'Confira o celular de quem vai receber (com DDD).' : ''
      case 'period': return delivered === null ? 'Diga se a poltrona já foi entregue.'
        : !start || !end ? 'Informe o dia da entrega e o da retirada.' : end < start ? 'A retirada precisa ser depois da entrega.'
          : !chairId ? 'Nenhuma poltrona livre nesse período. Mude as datas.' : ''
      case 'values': return totalCents <= 0 ? 'Informe o valor do aluguel ou do frete.' : !paidState ? 'Diga se a cliente já pagou.'
        : paidState === 'PART' && (paidCents <= 0 || paidCents >= totalCents) ? 'Informe quanto a cliente já pagou (menos que o total).' : ''
      case 'contract': return order?.status === 'PENDING_CONTRACT'
        ? 'Envie o contrato para a cliente assinar ou anexe o contrato assinado. Se precisar sair, o pedido continua de onde parou na tela dele.' : ''
      default: return ''
    }
  }

  function go(target: Step) {
    setError('')
    setStep(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function next() {
    const issue = problem(step)
    if (issue) return setError(issue)
    if (step === 'values' && !orderId) { void createOrder(); return }
    go(STEPS[index + 1].key)
  }

  /** Assinado ou pago (pelo link ou registrado): salva a etapa e segue sozinho para a próxima. */
  function advanceFrom(from: Step, fresh: Order) {
    setOrder(fresh)
    window.setTimeout(() => setStep(current => current === from ? STEPS[STEPS.findIndex(item => item.key === from) + 1].key : current), 2500)
  }

  function chooseCity(code: string) {
    setCityCode(code)
    const chosen = cities.find(item => item.code === code)
    if (chosen && !freight) setFreight(centsText(chosen.freightCents))
  }

  /**
   * Saindo de Valores: salva o pedido (a poltrona fica reservada). Se a poltrona ainda vai ser entregue, ele nasce
   * "Aguardando contrato" e segue para o contrato e o pagamento por link.
   */
  async function createOrder() {
    const first = STEPS.slice(0, SAVED_FROM).find(item => problem(item.key))
    if (first) { go(first.key); setError(problem(first.key)); return }
    setError('')
    let created: Order | null = null
    try {
      setSaving('Salvando o pedido...')
      created = await api.createManualOrder(credentials, {
        customerName: name.trim(), customerPhone: digits, cep: cep.replace(/\D/g, '') || undefined,
        street: street.trim(), number: number.trim() || undefined, complement: complement.trim() || undefined,
        district: district.trim(), municipalityCode: cityCode, branchId, chairId, start, end,
        deliveryTime: deliveryTime || undefined, pickupTime: pickupTime || undefined,
        rentalCents: toCents(rental), freightCents: toCents(freight), status: delivered ? 'IN_USE' : 'DELIVERY_PENDING',
        internalNote: note.trim() || undefined, reason: reason as ManualReason,
        initialPayment: paidCents > 0 ? { amountCents: paidCents, method, paidOn } : undefined,
        awaitContract: !delivered,
      })
      setOrderId(created.id)
      setOrder(created)
      if (customerRows(customer).length > 0) {
        setSaving('Salvando a ficha da cliente...')
        await api.saveCustomerDetails(credentials, created.id, customer)
      }
      if (JSON.stringify(sale) !== JSON.stringify(EMPTY_SALE)) {
        setSaving('Salvando os detalhes da venda...')
        await api.saveSaleDetails(credentials, created.id, { ...sale, discountCents: sale.discount ? toCents(saleDiscount) : null })
      }
      go('contract')
    } catch (cause) {
      if (created) go('contract')
      setError(getMessage(cause))
    } finally {
      setSaving('')
    }
  }

  /** Revisão: envia as fotos e a observação e abre o pedido (já salvo desde o Contrato). */
  async function submit() {
    if (!orderId) { go('values'); return }
    setError('')
    try {
      const photos = [...deliveryPhotos.map(file => ['DELIVERY', file] as const), ...pickupPhotos.map(file => ['PICKUP', file] as const)]
      for (const [position, [phase, file]] of photos.entries()) {
        setSaving(`Enviando foto ${position + 1} de ${photos.length}...`)
        await uploadOrderEvidenceFile(credentials, orderId, phase, await toJpeg(file), file.name.replace(/\.[^.]+$/, '') + '.jpg')
      }
      let current = order ?? await api.order(credentials, orderId)
      if ((current.internalNote ?? '') !== note.trim()) {
        setSaving('Salvando a observação...')
        current = await api.updateOrderNote(credentials, orderId, note.trim())
      }
      clearDraft()
      onCreated(current)
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setSaving('')
    }
  }

  return <section className="mw" aria-label="Cadastro de pedido manual">
    <div className="mw-top">
      <span className="mw-saved">{draft.conversationId ? 'Dados trazidos da conversa com a Isa • ' : ''}Rascunho salvo automaticamente</span>
      <button type="button" className="button secondary mw-clear" disabled={!!saving}
        onClick={() => { if (window.confirm('Limpar todos os campos do pedido manual? O rascunho em aberto será apagado.')) { clearDraft(); onClear() } }}>
        <Eraser size={15} /> Limpar campos</button>
    </div>
    <ol className="mw-steps" aria-label={`Etapa ${index + 1} de ${STEPS.length}: ${STEPS[index].label}`}>
      {STEPS.map((item, position) => {
        const done = position < index
        return <li key={item.key} className={done ? 'done' : position === index ? 'current' : ''}>
          <button type="button" disabled={position > index || !!saving || (!!orderId && position < SAVED_FROM)} onClick={() => go(item.key)}>
            <span className="mw-dot">{done ? <Check size={14} strokeWidth={3} /> : position + 1}</span>
            <span className="mw-step-label">{item.label}</span>
          </button>
        </li>
      })}
    </ol>
    <p className="mw-progress">Etapa {index + 1} de {STEPS.length}</p>

    <div className="mw-card">
      {step === 'reason' && <Panel icon={CircleHelp} title="Por que este pedido é manual?"
        why="O normal é a venda passar pela Isa, com contrato e pagamento automáticos. O motivo aparece na tag amarela do pedido e mostra o que ainda falta automatizar.">
        <div className="mw-options">
          {REASONS.map(item => <button type="button" key={item.value} className={`mw-option${reason === item.value ? ' selected' : ''}`}
            aria-pressed={reason === item.value} onClick={() => setReason(item.value)}>
            <span className="mw-option-icon"><item.icon size={20} /></span>
            <span><strong>{manualReasonLabels[item.value]}</strong><small>{item.text}</small></span>
            {reason === item.value && <Check className="mw-option-check" size={18} />}
          </button>)}
        </div>
      </Panel>}

      {step === 'customer' && <Panel icon={User} title="Quem é a cliente?"
        why="É por esse WhatsApp que a cliente recebe os avisos de saída para entrega, de retirada e o lembrete da véspera.">
        <div className="mw-grid">
          <label>Nome completo<input value={name} onChange={event => setName(event.target.value)} maxLength={120} autoFocus
            placeholder="Ex.: Juliana Silva de Oliveira Brito" /></label>
          <label>WhatsApp com DDD<input type="tel" inputMode="numeric" value={phone} maxLength={15}
            onChange={event => setPhone(formatPhone(event.target.value))} placeholder="(85) 99999-9999" /></label>
          <CustomerIdFields value={customer} onChange={changeCustomer} />
        </div>
      </Panel>}

      {step === 'address' && <Panel icon={MapPin} title="Onde a poltrona vai ser entregue?"
        why="O entregador usa este endereço no dia. A filial define quais poltronas podem ir para a cliente.">
        <div className="mw-grid">
          <label>Filial<select value={branchId} onChange={event => { setBranchId(event.target.value); setCityCode('') }}>
            <option value="">Escolha a filial</option>
            {options.map(item => <option key={item.id} value={item.id}>{branchLabel(item.name)}</option>)}</select></label>
          <label>Cidade<select value={cityCode} disabled={!branch} onChange={event => chooseCity(event.target.value)}>
            <option value="">{branch ? 'Escolha a cidade' : 'Escolha a filial antes'}</option>
            {cities.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label className="mw-wide">Rua<input value={street} onChange={event => setStreet(event.target.value)} maxLength={160} placeholder="Rua, avenida..." /></label>
          <label>Número <em>(opcional)</em><input value={number} onChange={event => setNumber(event.target.value)} maxLength={20} placeholder="Sem número: deixe vazio" /></label>
          <label>Bairro<input value={district} onChange={event => setDistrict(event.target.value)} maxLength={100} /></label>
          <label>Complemento <em>(opcional)</em><input value={complement} onChange={event => setComplement(event.target.value)} maxLength={160}
            placeholder="Apto, bloco, referência" /></label>
          <label>CEP <em>(opcional)</em><input inputMode="numeric" value={cep} onChange={event => setCep(formatCep(event.target.value))} placeholder="00000-000" /></label>
        </div>
        <p className="mw-question">Quem recebe e como é o local</p>
        <div className="mw-grid"><DeliveryPlaceFields value={customer} onChange={changeCustomer} /></div>
      </Panel>}

      {step === 'period' && <Panel icon={Armchair} title="Período e poltrona"
        why="A poltrona fica reservada em todos os dias do período. A Isa não oferece essa poltrona a outra cliente nesses dias.">
        <p className="mw-question">A poltrona já está com a cliente?</p>
        <div className="mw-options two">
          <Choice selected={delivered === false} onClick={() => setDelivered(false)} title="Ainda vai receber"
            text="No dia, use “Saindo para entrega” no pedido: a cliente recebe o aviso e o vídeo." />
          <Choice selected={delivered === true} onClick={() => setDelivered(true)} title="Já está com a cliente"
            text="O pedido entra como “em uso”. Você pode anexar as fotos da entrega." />
        </div>
        <div className="mw-grid">
          <label>Dia da entrega<input type="date" value={start} onChange={event => { setStart(event.target.value); if (end && end < event.target.value) setEnd(event.target.value) }} /></label>
          <label>Turno da entrega<select value={deliveryTime} onChange={event => setDeliveryTime(event.target.value)}>
            {SHIFTS.map(shift => <option key={shift.value} value={shift.value}>{shift.label}</option>)}</select></label>
          <label>Dia da retirada<input type="date" value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} /></label>
          <label>Turno da retirada<select value={pickupTime} onChange={event => setPickupTime(event.target.value)}>
            {SHIFTS.map(shift => <option key={shift.value} value={shift.value}>{shift.label}</option>)}</select></label>
          <label className="mw-wide">Poltrona<select value={chairId} disabled={!available || available.list.length === 0}
            onChange={event => setChairChoice(event.target.value)}>
            {!chairKey && <option value="">Escolha a filial (etapa anterior) e as datas</option>}
            {chairKey && !available && <option value="">Procurando poltronas livres...</option>}
            {available && available.list.length === 0 && <option value="">Nenhuma poltrona livre em todo o período</option>}
            {available && available.list.length > 0 && <optgroup label="Livres em todo o período">
              {available.list.map(item => {
                const next = periodsOf(item.id)
                return <option key={item.id} value={item.id}>Poltrona {item.code}{item.model ? ` • ${item.model}` : ''}{next.length ? ` — próxima locação: ${periodText(next.slice(0, 1))}` : ''}</option>
              })}
            </optgroup>}
            {rentedInPeriod.length > 0 && <optgroup label="Alugadas nesse período (não podem ser escolhidas)">
              {rentedInPeriod.map(item => {
                const busy = periodsOf(item.id)
                return <option key={item.id} value={item.id} disabled>Poltrona {item.code}{item.model ? ` • ${item.model}` : ''} — {busy.length ? periodText(busy) : 'reservada nessas datas'}</option>
              })}
            </optgroup>}
          </select>
            {available && available.list.length > 0 && <small>{available.list.length} {available.list.length === 1 ? 'poltrona livre' : 'poltronas livres'} em todo o período{rentedInPeriod.length ? ` e ${rentedInPeriod.length} alugada${rentedInPeriod.length === 1 ? '' : 's'} (aparece${rentedInPeriod.length === 1 ? '' : 'm'} no fim da lista, com as datas)` : ''}. Pedido especial (bege, com massagem)? Escolha aqui a certa.</small>}
            {chair && periodsOf(chair.id).length > 0 && <small className="mw-chair-periods">Poltrona {chair.code}: {periodText(periodsOf(chair.id))}.</small>}
            {available?.error && <small className="mw-warn">{available.error}</small>}</label>
        </div>
      </Panel>}

      {step === 'values' && <Panel icon={Wallet} title="Valores"
        why="Estes valores vão no contrato. Ao continuar, o pedido é salvo e a poltrona fica reservada; depois vêm o contrato e o pagamento.">
        <div className="mw-grid">
          <label>Aluguel (R$)<input inputMode="decimal" value={rental} onChange={event => setRental(event.target.value)} placeholder="0,00" /></label>
          <label>Frete (R$)<input inputMode="decimal" value={freight} onChange={event => setFreight(event.target.value)} placeholder="0,00" /></label>
        </div>
        <p className="mw-total">Total do pedido <strong>{currency(totalCents)}</strong></p>
        <p className="mw-question">A cliente já pagou alguma parte?</p>
        <div className="mw-options three">
          <Choice selected={paidState === 'ALL'} onClick={() => setPaidState('ALL')} title="Pagou tudo" text="O pedido fica quitado." />
          <Choice selected={paidState === 'PART'} onClick={() => setPaidState('PART')} title="Pagou uma parte" text="Sinal, ou o resto fica para a entrega." />
          <Choice selected={paidState === 'NONE'} onClick={() => setPaidState('NONE')} title="Ainda não pagou"
            text={delivered ? 'A equipe lança quando ela pagar.' : 'Na etapa Pagamento você envia o link (Pix ou cartão).'} />
        </div>
        {(paidState === 'ALL' || paidState === 'PART') && <div className="mw-grid">
          {paidState === 'PART' && <label>Quanto já pagou (R$)<input inputMode="decimal" value={partial} onChange={event => setPartial(event.target.value)} placeholder="0,00" /></label>}
          <label>Forma<select value={method} onChange={event => setMethod(event.target.value as PaymentMethod)}>
            {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Pago em<input type="date" value={paidOn} max={todayIso()} onChange={event => setPaidOn(event.target.value)} /></label>
        </div>}
        {totalCents > 0 && paidState && <p className={`mw-balance ${paidCents >= totalCents ? 'paid' : 'due'}`}>
          {paidCents >= totalCents ? 'Quitado' : `Pago ${currency(paidCents)} • falta ${currency(totalCents - paidCents)}`}</p>}
        <p className="mw-question">Detalhes da venda</p>
        <SaleDetailsFields value={sale} discount={saleDiscount} plans={plans} onChange={changes => setSale(current => ({ ...current, ...changes }))}
          onDiscount={setSaleDiscount} />
      </Panel>}

      {step === 'contract' && <Panel icon={FileSignature} title="Contrato"
        why={delivered ? 'A poltrona já está com a cliente: anexe o contrato assinado fora do sistema, se tiver. Pode seguir e anexar depois.'
          : 'O mesmo contrato do site, com os dados deste pedido. Envie o link para o celular da cliente; quando ela assinar, a etapa é salva sozinha e você segue para o pagamento quando quiser.'}>
        {!order ? <p className="mw-soft">Carregando o pedido...</p>
          : <ContractLinkPanel key={order.id} credentials={credentials} order={order} allowLink={!delivered}
            onSigned={setOrder} />}
      </Panel>}

      {step === 'payment' && <Panel icon={CreditCard} title="Pagamento"
        why={delivered ? 'Registre o que a cliente já pagou por fora. O que faltar aparece no pedido como “Falta R$…”.'
          : 'Como no site: a cliente paga por Pix ou cartão pelo link. Quando o banco confirmar, a etapa é salva e o comprovante aparece aqui e vai para o WhatsApp dela.'}>
        {!order ? <p className="mw-soft">Carregando o pedido...</p>
          : <PaymentLinkPanel key={order.id} credentials={credentials} order={order} allowLink={order.status === 'PENDING_PAYMENT'}
            onPaid={fresh => fresh.status !== 'PENDING_PAYMENT' || fresh.totalCents - (fresh.totalPaidCents ?? 0) <= 0
              ? advanceFrom('payment', fresh) : setOrder(fresh)} />}
      </Panel>}

      {step === 'photos' && <Panel icon={Camera} title="Fotos da entrega e da retirada"
        why="As fotos protegem a Pós Leve: mostram como a poltrona foi entregue e como voltou.">
        {!delivered ? <p className="mw-soft">A poltrona ainda vai ser entregue. As fotos são tiradas no dia, pelo entregador ou pela tela do pedido. Pode seguir.</p> : <>
          <p className="mw-question">Fotos da entrega <em>(opcional)</em></p>
          <FileDrop multiple accept="image/*" hint="Fotos da poltrona instalada na casa da cliente"
            onFiles={files => setDeliveryPhotos(current => [...current, ...files.filter(file => file.type.startsWith('image/'))].slice(0, 20))} />
          {deliveryPhotos.map((file, position) => <FileRow key={`${file.name}-${position}`} name={file.name} size={file.size}
            onRemove={() => setDeliveryPhotos(current => current.filter((_, other) => other !== position))} />)}
          <p className="mw-question">Fotos da retirada <em>(só se a poltrona já voltou)</em></p>
          <FileDrop multiple accept="image/*" hint="Fotos da poltrona na retirada"
            onFiles={files => setPickupPhotos(current => [...current, ...files.filter(file => file.type.startsWith('image/'))].slice(0, 20))} />
          {pickupPhotos.map((file, position) => <FileRow key={`${file.name}-${position}`} name={file.name} size={file.size}
            onRemove={() => setPickupPhotos(current => current.filter((_, other) => other !== position))} />)}
        </>}
      </Panel>}

      {step === 'review' && <Panel icon={ClipboardCheck} title="Confira antes de cadastrar"
        why="Toque em uma etapa lá em cima para corrigir qualquer coisa.">
        <dl className="mw-review">
          <Row label="Motivo" value={reason ? manualReasonLabels[reason] : '—'} />
          <Row label="Cliente" value={`${name.trim() || '—'} • ${phone || 'sem WhatsApp'}`} />
          <Row label="Endereço" value={`${[street, number || 's/n', complement, district].filter(Boolean).join(', ')} • ${city?.name ?? ''}${branch ? ` (${branchLabel(branch.name)})` : ''}`} />
          {customerRows(customer).map(([label, value]) => <Row key={label} label={label} value={value} />)}
          {saleRows({ ...sale, discountCents: sale.discount ? toCents(saleDiscount) : null }).map(([label, value]) => <Row key={label} label={label} value={value} />)}
          <Row label="Período" value={start && end ? `${dateLabel(start)} a ${dateLabel(end)} • ${delivered ? 'já está com a cliente' : 'ainda vai receber'}` : '—'} />
          <Row label="Poltrona" value={chair ? `${chair.code}${chair.model ? ` • ${chair.model}` : ''}` : '—'} />
          <Row label="Valores" value={`${currency(totalCents)} • ${paidState === 'ALL' ? 'quitado' : paidState === 'PART' ? `pago ${currency(paidCents)}, falta ${currency(totalCents - paidCents)}` : 'ainda não pagou'}`} />
          <Row label="Contrato" value={!order ? '—' : order.status === 'PENDING_CONTRACT' ? 'aguardando a cliente assinar' : delivered ? 'assinado fora do sistema' : 'assinado'} />
          <Row label="Pagamento" value={!order ? '—' : order.status === 'PENDING_PAYMENT' ? 'aguardando a cliente pagar pelo link'
            : order.totalCents - (order.totalPaidCents ?? 0) <= 0 ? 'quitado' : `falta ${currency(order.totalCents - (order.totalPaidCents ?? 0))}`} />
          <Row label="Fotos" value={delivered ? `${deliveryPhotos.length} da entrega • ${pickupPhotos.length} da retirada` : 'no dia da entrega'} />
        </dl>
        <label className="mw-note">Observação interna <em>(só a equipe vê; opcional)</em>
          <textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}
            placeholder="Ex.: só quer poltrona bege; confirmar a data depois da consulta; precisa de nota fiscal" /></label>
      </Panel>}

      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="mw-actions">
        {index > 0 && !(orderId && index <= SAVED_FROM) ? <button type="button" className="button secondary" disabled={!!saving} onClick={() => go(STEPS[index - 1].key)}>
          <ArrowLeft size={16} /> Voltar</button> : <span />}
        {step === 'review'
          ? <button type="button" className="button primary mw-submit" disabled={!!saving} onClick={() => void submit()}>
            {saving || 'Concluir e abrir o pedido'} {!saving && <Check size={17} />}</button>
          : <button type="button" className="button primary" disabled={!!saving} onClick={next}>
            {saving || (step === 'values' && !orderId ? 'Salvar o pedido e ir para o contrato' : 'Continuar')} {!saving && <ArrowRight size={16} />}</button>}
      </div>
    </div>
  </section>
}

function Panel({ icon: Icon, title, why, children }: { icon: typeof History; title: string; why: string; children: ReactNode }) {
  return <div className="mw-panel">
    <header><span className="mw-panel-icon"><Icon size={22} /></span><div><h2>{title}</h2><p>{why}</p></div></header>
    {children}
  </div>
}

function Choice({ selected, onClick, title, text }: { selected: boolean; onClick: () => void; title: string; text: string }) {
  return <button type="button" className={`mw-option${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}>
    <span><strong>{title}</strong><small>{text}</small></span>
    {selected && <Check className="mw-option-check" size={18} />}
  </button>
}

function FileDrop({ accept, multiple, hint, onFiles }: { accept: string; multiple?: boolean; hint: string; onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false)
  return <label className={`mw-drop${over ? ' over' : ''}`}
    onDragOver={event => { event.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
    onDrop={event => { event.preventDefault(); setOver(false); onFiles([...event.dataTransfer.files]) }}>
    <Upload size={22} />
    <span><strong>Clique para escolher</strong> ou arraste o arquivo aqui</span>
    <small>{hint}</small>
    <input type="file" accept={accept} multiple={multiple} onChange={event => { onFiles([...(event.target.files ?? [])]); event.target.value = '' }} />
  </label>
}

function FileRow({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  return <div className="mw-file"><FileSignature size={16} /><span>{name}</span><small>{sizeLabel(size)}</small>
    <button type="button" className="icon-button" aria-label={`Tirar ${name}`} onClick={onRemove}><X size={15} /></button></div>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

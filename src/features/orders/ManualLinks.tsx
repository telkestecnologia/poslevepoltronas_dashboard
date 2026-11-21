import { useEffect, useState } from 'react'
import { Check, Copy, CreditCard, FileSignature, Link2, MessageCircle, Receipt, Upload } from 'lucide-react'
import {
  api, uploadOrderContractFile, type ContractLinkState, type Order, type PaymentLinkState, type PaymentMethod,
} from '../../api'
import { currency, paymentMethodLabels } from '../../data/orders'
import { getMessage } from '../../utils/errors'
import { toCents, todayIso } from '../../utils/money'
import { formatPhone } from '../../utils/phone'
import { formatCpf } from './CustomerDetails'
import './manual-links.css'

const POLL_MS = 5000
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' })
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''
const phoneLabel = (phone: string) => formatPhone(phone.replace(/^55/, ''))

/** Abre o WhatsApp (do celular ou do computador da equipe) já na conversa com o celular do pedido e a mensagem pronta. */
const whatsappUrl = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`

/** Link pronto: enviar pelo WhatsApp para o celular cadastrado, copiar ou abrir. */
function ShareLink({ url, phone, message }: { url: string; phone: string; message: string }) {
  const [copied, setCopied] = useState(false)
  return <div className="ml-share">
    <div className="ml-url"><Link2 size={15} /><span>{url}</span></div>
    <div className="ml-share-actions">
      <a className="button primary" href={whatsappUrl(phone, message)} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={16} /> Enviar pelo WhatsApp para {phoneLabel(phone)}</a>
      <button type="button" className="button secondary" onClick={() => void navigator.clipboard.writeText(url)
        .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) })}>
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar link'}</button>
      {navigator.share && <button type="button" className="button secondary"
        onClick={() => void navigator.share({ title: 'Pós Leve', text: message }).catch(() => undefined)}>Compartilhar</button>}
    </div>
  </div>
}

/** Contrato assinado pela cliente pelo link (mesmo texto do site), aberto para leitura. */
export function SignedContract({ state, open = false }: { state: ContractLinkState; open?: boolean }) {
  return <details className="ml-contract" open={open}>
    <summary><FileSignature size={16} /> Ver o contrato assinado{state.acceptedAt ? ` em ${when(state.acceptedAt)}` : ''}</summary>
    <div className="ml-contract-text">
      {state.title && <h3>{state.title}</h3>}
      {state.sections?.map((section, index) => <section key={index}>
        {section.title && <h4>{section.title}</h4>}
        {section.paragraphs.map((paragraph, line) => <p key={line}>{paragraph}</p>)}
      </section>)}
      {state.documentDate && <p className="ml-contract-date">{state.documentDate}</p>}
      {state.acceptedAt && <p className="ml-contract-sign">✔ Aceito eletronicamente pela cliente pelo link enviado ao WhatsApp {phoneLabel(state.phone)}, em {when(state.acceptedAt)}.</p>}
    </div>
  </details>
}

/**
 * Etapa do contrato do pedido manual: gera o contrato do site com os dados do pedido e o link para a cliente assinar,
 * ou recebe o arquivo do contrato assinado fora do sistema. Assinado, chama onSigned (a equipe segue para o pagamento quando quiser).
 */
export function ContractLinkPanel({ credentials, order, onSigned, allowLink = true }: {
  credentials: string; order: Order; onSigned: (order: Order) => void; allowLink?: boolean
}) {
  const [state, setState] = useState<ContractLinkState | null>(null)
  const [mode, setMode] = useState<'link' | 'file'>(allowLink ? 'link' : 'file')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cpf, setCpf] = useState('')
  const [needsCpf, setNeedsCpf] = useState(false)

  // Acompanha a assinatura: a cada poucos segundos enquanto o link está com a cliente.
  useEffect(() => {
    if (!allowLink) return
    let active = true
    let timer: number | undefined
    const load = () => api.contractLink(credentials, order.id).then(found => {
      if (!active) return
      setState(found)
      if (found.status === 'ACCEPTED') void api.order(credentials, order.id).then(fresh => { if (active) onSigned(fresh) })
      else if (found.status === 'READY' || found.status === 'DECLINED') timer = window.setTimeout(load, POLL_MS)
    }, cause => { if (active) setError(getMessage(cause)) })
    void load()
    return () => { active = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, order.id, allowLink, state?.status === 'READY' || state?.status === 'DECLINED'])

  async function generate() {
    setBusy(true); setError('')
    try {
      if (needsCpf) {
        const digits = cpf.replace(/\D/g, '')
        if (digits.length !== 11) { setError('O CPF precisa ter 11 números.'); return }
        const current = await api.customerDetails(credentials, order.id)
        await api.saveCustomerDetails(credentials, order.id, {
          cpf: digits, email: current?.email ?? null, recipientName: current?.recipientName ?? null, recipientPhone: current?.recipientPhone ?? null,
          placeType: current?.placeType ?? null, parking: current?.parking ?? null, floor: current?.floor ?? null,
        })
      }
      setState(await api.prepareContractLink(credentials, order.id))
      setNeedsCpf(false)
    } catch (cause) {
      const message = getMessage(cause)
      if (/CPF/i.test(message)) setNeedsCpf(true)
      setError(message)
    } finally { setBusy(false) }
  }

  async function attach(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('O contrato pode ter até 10 MB.'); return }
    setBusy(true); setError('')
    try {
      await uploadOrderContractFile(credentials, order.id, file)
      onSigned(await api.order(credentials, order.id))
    } catch (cause) { setError(getMessage(cause)) } finally { setBusy(false) }
  }

  if (state?.status === 'ACCEPTED') return <div className="ml-box ml-done">
    <p className="ml-ok"><Check size={18} /> Contrato assinado pela cliente{state.acceptedAt ? ` em ${when(state.acceptedAt)}` : ''}. Etapa salva.
      Quando for combinar o pagamento, siga para a próxima etapa.</p>
    <SignedContract state={state} open />
  </div>
  // Contrato já resolvido fora do link (arquivo anexado).
  if (allowLink && state && order.status !== 'PENDING_CONTRACT') return <div className="ml-box ml-done">
    <p className="ml-ok"><Check size={18} /> Contrato assinado anexado ao pedido. Etapa salva.</p>
  </div>

  const message = state?.url ? `Olá, ${firstName(order.customerName)}! Aqui está o contrato da locação da sua poltrona Pós Leve. `
    + `É só ler até o final e tocar em "Aceito": ${state.url}` : ''
  return <div className="ml-box">
    {allowLink && <div className="ml-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mode === 'link'} className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}>
        <Link2 size={15} /> Enviar o contrato para a cliente</button>
      <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
        <Upload size={15} /> Já assinou fora do sistema</button>
    </div>}

    {mode === 'link' && <>
      {!state || state.status === 'NONE' ? <>
        <p className="ml-help">O sistema gera o mesmo contrato do site, com os dados deste pedido. A cliente lê no celular e toca em “Aceito”.
          Assim que ela assinar, esta etapa é salva sozinha. O pagamento fica com a equipe: na próxima etapa você envia o link ou registra o que ela pagou.</p>
        {needsCpf && <label className="ml-field">CPF da cliente (vai no contrato)
          <input inputMode="numeric" value={formatCpf(cpf)} maxLength={14} placeholder="000.000.000-00" onChange={event => setCpf(event.target.value)} /></label>}
        <button type="button" className="button primary" disabled={busy || !state} onClick={() => void generate()}>
          <FileSignature size={16} /> {busy ? 'Gerando o contrato...' : 'Gerar contrato e link'}</button>
      </> : <>
        {state.status === 'DECLINED'
          ? <p className="ml-warn">A cliente tocou em “Não aceito”{state.declinedAt ? ` em ${when(state.declinedAt)}` : ''}. Converse com ela; o link continua valendo se ela mudar de ideia.</p>
          : <p className="ml-wait"><span className="ml-pulse" /> Aguardando a cliente assinar. Esta tela atualiza sozinha.</p>}
        {state.url && <ShareLink url={state.url} phone={state.phone} message={message} />}
        <details className="ml-contract"><summary><FileSignature size={16} /> Ver o contrato enviado</summary>
          <div className="ml-contract-text">{state.title && <h3>{state.title}</h3>}
            {state.sections?.map((section, index) => <section key={index}>{section.title && <h4>{section.title}</h4>}
              {section.paragraphs.map((paragraph, line) => <p key={line}>{paragraph}</p>)}</section>)}</div>
        </details>
        <button type="button" className="button secondary ml-small" disabled={busy} onClick={() => void generate()}>
          Mudou algum dado? Atualizar o contrato</button>
      </>}
    </>}

    {mode === 'file' && <>
      <p className="ml-help">Anexe o contrato assinado (PDF, JPG ou PNG, até 10 MB). Ele fica guardado no pedido e a etapa é salva.</p>
      <label className="button secondary ml-upload"><Upload size={16} /> {busy ? 'Enviando...' : 'Escolher o arquivo do contrato'}
        <input type="file" hidden accept="application/pdf,image/jpeg,image/png" disabled={busy}
          onChange={event => { void attach(event.target.files?.[0]); event.target.value = '' }} /></label>
    </>}
    {error && <p className="ml-error" role="alert">{error}</p>}
  </div>
}

/** Comprovante do pagamento feito pelo link (o mesmo recibo que a cliente recebe no WhatsApp). */
export function PaymentReceipt({ state }: { state: PaymentLinkState }) {
  return <div className="ml-receipt">
    <p className="ml-ok"><Check size={18} /> Pagamento de {currency(state.amountCents)} confirmado pelo banco{state.method ? ` (${state.method})` : ''}
      {state.paidAt ? ` em ${when(state.paidAt)}` : ''}. O comprovante foi enviado à cliente pelo WhatsApp.</p>
    {state.receiptImageUrl && <img src={state.receiptImageUrl} alt="Comprovante de pagamento" className="ml-receipt-img" />}
    {state.receiptPdfUrl && <a className="button secondary" href={state.receiptPdfUrl} target="_blank" rel="noopener noreferrer">
      <Receipt size={16} /> Abrir o comprovante em PDF</a>}
  </div>
}

/**
 * Etapa do pagamento do pedido manual: link de pagamento (Pix ou cartão, como no site) do valor que falta, pagamento
 * já recebido por fora (lançado pela equipe) ou pagamento combinado para depois. Pago, chama onPaid.
 */
export function PaymentLinkPanel({ credentials, order, onPaid, allowLink = true }: {
  credentials: string; order: Order; onPaid: (order: Order) => void; allowLink?: boolean
}) {
  const [state, setState] = useState<PaymentLinkState | null>(null)
  const [mode, setMode] = useState<'link' | 'manual' | 'later'>(allowLink ? 'link' : 'manual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [paidOn, setPaidOn] = useState(todayIso())
  const missing = order.totalCents - (order.totalPaidCents ?? 0)

  // Sempre consulta: pago pelo link, o comprovante continua aparecendo depois que o pedido sai de "Aguardando pagamento".
  useEffect(() => {
    let active = true
    let timer: number | undefined
    const load = () => api.paymentLink(credentials, order.id).then(found => {
      if (!active) return
      setState(found)
      if (found.status === 'PAID') void api.order(credentials, order.id).then(fresh => { if (active) onPaid(fresh) })
      else if (found.status === 'READY' || found.status === 'WAITING') timer = window.setTimeout(load, POLL_MS)
    }, cause => { if (active) setError(getMessage(cause)) })
    void load()
    return () => { active = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, order.id, allowLink, state?.status === 'READY' || state?.status === 'WAITING'])

  async function run(action: () => Promise<Order | PaymentLinkState>) {
    setBusy(true); setError('')
    try {
      const result = await action()
      if ('status' in result && 'receiptPdfUrl' in result) setState(result)
      else onPaid(result as Order)
    } catch (cause) { setError(getMessage(cause)) } finally { setBusy(false) }
  }

  if (state?.status === 'PAID') return <div className="ml-box ml-done"><PaymentReceipt state={state} /></div>
  if (missing <= 0) return <div className="ml-box ml-done"><p className="ml-ok"><Check size={18} /> Pedido quitado. Etapa salva.</p></div>

  const message = state?.url ? `Olá, ${firstName(order.customerName)}! Para concluir a locação da sua poltrona Pós Leve, `
    + `faça o pagamento de ${currency(state.amountCents)} por Pix ou cartão neste link: ${state.url}` : ''
  return <div className="ml-box">
    <p className="ml-amount">Falta pagar <strong>{currency(missing)}</strong>{order.totalPaidCents ? ` (já pago ${currency(order.totalPaidCents)} de ${currency(order.totalCents)})` : ''}</p>
    <div className="ml-tabs" role="tablist">
      {allowLink && <button type="button" role="tab" aria-selected={mode === 'link'} className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}>
        <CreditCard size={15} /> Enviar link de pagamento</button>}
      <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>
        Já pagou: registrar manualmente</button>
      {order.status === 'PENDING_PAYMENT' && <button type="button" role="tab" aria-selected={mode === 'later'} className={mode === 'later' ? 'on' : ''}
        onClick={() => setMode('later')}>Pagamento fica para depois</button>}
    </div>

    {mode === 'link' && (!state || state.status === 'NONE' ? <>
      <p className="ml-help">A cliente abre o link no celular e paga por Pix ou cartão, como no site. Quando o banco confirmar, esta etapa é salva
        sozinha, o comprovante aparece aqui e é enviado para a cliente pelo WhatsApp.</p>
      <button type="button" className="button primary" disabled={busy || !state} onClick={() => void run(() => api.preparePaymentLink(credentials, order.id))}>
        <CreditCard size={16} /> {busy ? 'Gerando...' : 'Gerar link de pagamento'}</button>
    </> : <>
      {state.status === 'REVIEW'
        ? <p className="ml-warn">O pagamento precisa de conferência no Asaas (valor diferente ou devolução). Veja as pendências do pedido.</p>
        : state.status === 'WAITING'
          ? <p className="ml-wait"><span className="ml-pulse" /> A cliente escolheu {state.method ?? 'a forma de pagamento'} e o banco ainda não confirmou. Esta tela atualiza sozinha.</p>
          : <p className="ml-wait"><span className="ml-pulse" /> Link enviado; aguardando a cliente pagar. Esta tela atualiza sozinha.</p>}
      {state.url && <ShareLink url={state.url} phone={state.phone} message={message} />}
    </>)}

    {mode === 'manual' && <div className="ml-manual">
      <label className="ml-field">Valor recebido (R$)<input inputMode="decimal" value={amount} placeholder={(missing / 100).toFixed(2).replace('.', ',')}
        onChange={event => setAmount(event.target.value)} /></label>
      <label className="ml-field">Forma<select value={method} onChange={event => setMethod(event.target.value as PaymentMethod)}>
        {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="ml-field">Pago em<input type="date" value={paidOn} max={todayIso()} onChange={event => setPaidOn(event.target.value)} /></label>
      <button type="button" className="button primary" disabled={busy} onClick={() => void run(() =>
        api.addOrderPayment(credentials, order.id, { amountCents: amount ? toCents(amount) : missing, method, paidOn }))}>
        <Check size={16} /> {busy ? 'Salvando...' : 'Registrar pagamento'}</button>
      <p className="ml-help">Fica no Financeiro com a tag “Pagamento registrado manualmente”.</p>
    </div>}

    {mode === 'later' && <div className="ml-manual">
      <p className="ml-help">O pedido sai de “Aguardando pagamento” e segue para a entrega, mostrando “Falta {currency(missing)}” até a equipe lançar o pagamento.</p>
      <button type="button" className="button primary" disabled={busy} onClick={() => void run(() => api.confirmManualOrder(credentials, order.id))}>
        <Check size={16} /> {busy ? 'Salvando...' : 'Confirmar o pedido e receber depois'}</button>
    </div>}
    {error && <p className="ml-error" role="alert">{error}</p>}
  </div>
}

/**
 * Na tela do pedido manual: enquanto aguarda o contrato ou o pagamento, mostra a etapa com o link (a equipe pode ter
 * saído do cadastro); depois, o contrato assinado pelo link e o comprovante do pagamento pelo link.
 */
export function ManualLinksCard({ credentials, order, onChange }: { credentials: string; order: Order; onChange: (order: Order) => void }) {
  const [contract, setContract] = useState<ContractLinkState | null>(null)
  const [payment, setPayment] = useState<PaymentLinkState | null>(null)
  const pending = order.status === 'PENDING_CONTRACT' || order.status === 'PENDING_PAYMENT'
  useEffect(() => {
    if (pending) return
    let active = true
    void api.contractLink(credentials, order.id).then(found => { if (active) setContract(found) }).catch(() => undefined)
    void api.paymentLink(credentials, order.id).then(found => { if (active) setPayment(found) }).catch(() => undefined)
    return () => { active = false }
  }, [credentials, order.id, pending])

  if (order.status === 'PENDING_CONTRACT') return <section className="panel od-card ml-card" aria-label="Contrato da cliente">
    <h2 className="od-side-title"><FileSignature size={16} /> Contrato da cliente</h2>
    <ContractLinkPanel credentials={credentials} order={order} onSigned={onChange} />
  </section>
  if (order.status === 'PENDING_PAYMENT') return <section className="panel od-card ml-card" aria-label="Pagamento da cliente">
    <h2 className="od-side-title"><CreditCard size={16} /> Pagamento da cliente</h2>
    <PaymentLinkPanel credentials={credentials} order={order} onPaid={onChange} />
  </section>
  if (contract?.status !== 'ACCEPTED' && payment?.status !== 'PAID') return null
  return <section className="panel od-card ml-card" aria-label="Contrato e pagamento pelo link">
    <h2 className="od-side-title"><Link2 size={16} /> Contrato e pagamento pelo link</h2>
    {contract?.status === 'ACCEPTED' && <SignedContract state={contract} />}
    {payment?.status === 'PAID' && <PaymentReceipt state={payment} />}
  </section>
}

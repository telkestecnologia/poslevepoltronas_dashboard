import { useEffect, useState } from 'react'
import { Armchair, FileSignature, StickyNote, Trash2, Wallet } from 'lucide-react'
import { api, uploadOrderContractFile, type Chair, type ContractFile, type Order, type PaymentMethod } from '../../api'
import { getMessage } from '../../utils/errors'
import { balanceCents, currency, dateLabel, manualTagText, paymentMethodLabels } from '../../data/orders'
import { toCents, todayIso } from '../../utils/money'
import './manual-order.css'

type Perform = (operation: () => Promise<Order>, message: string, after?: () => void) => Promise<void>

/** Observação interna do pedido: só a equipe vê (nem o cliente nem a Isa). Vale para qualquer pedido. */
export function OrderNoteCard({ credentials, order, busy, perform }: {
  credentials: string; order: Order; busy: boolean; perform: Perform
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const current = order.internalNote ?? ''

  function save() {
    void perform(() => api.updateOrderNote(credentials, order.id, text), text.trim() ? 'Observação salva.' : 'Observação apagada.',
      () => setEditing(false))
  }

  return <section className="panel od-card od-note" aria-labelledby="od-note-title">
    <div className="od-card-head">
      <h2 id="od-note-title"><StickyNote size={18} /> Observação interna</h2>
      {!editing && <button type="button" className="button secondary" onClick={() => { setText(current); setEditing(true) }}>
        {current ? 'Editar' : 'Adicionar'}</button>}
    </div>
    {editing ? <>
      <p className="od-note-help">Só a equipe vê. O cliente e a Isa não têm acesso a este texto.</p>
      <textarea aria-label="Observação interna" maxLength={1000} value={text} autoFocus onChange={event => setText(event.target.value)}
        placeholder="Ex.: só quer poltrona bege; falta pagar R$ 500 na entrega; precisa de nota fiscal" />
      <div className="od-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
        <button type="button" className="button primary" disabled={busy || text.trim() === current.trim()} onClick={save}>Salvar</button>
      </div>
    </> : current ? <p className="od-note-text">{current}</p>
      : <p className="order-muted">Nenhuma observação. Use para pedidos especiais (cor, massagem, nota fiscal, data a confirmar).</p>}
  </section>
}

/**
 * Pagamentos de um pedido cadastrado à mão: total, pago e o que falta, com o registro de cada pagamento (sinal, parcelas,
 * saldo na entrega). Os pedidos do site são confirmados só pelo banco e não usam este card.
 */
export function ManualPaymentsCard({ credentials, order, busy, perform }: {
  credentials: string; order: Order; busy: boolean; perform: Perform
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [paidOn, setPaidOn] = useState(todayIso())
  const [note, setNote] = useState('')
  const paid = order.totalPaidCents ?? 0
  const due = balanceCents(order)
  const payments = order.manualPayments ?? []
  const cancelled = order.status === 'CANCELLED'

  function register() {
    const cents = toCents(amount)
    void perform(() => api.addOrderPayment(credentials, order.id, { amountCents: cents, method, paidOn, note: note.trim() || undefined }),
      cents >= due ? 'Pagamento lançado. Pedido quitado.' : `Pagamento lançado. Falta ${currency(due - cents)}.`,
      () => { setOpen(false); setAmount(''); setNote('') })
  }

  function remove(id: string, value: number) {
    if (!window.confirm(`Desfazer o pagamento de ${currency(value)}? Ele também sai do financeiro.`)) return
    void perform(() => api.removeOrderPayment(credentials, order.id, id), 'Pagamento desfeito.')
  }

  return <section className="panel od-card od-pay" aria-labelledby="od-pay-title">
    <div className="od-card-head">
      <h2 id="od-pay-title" className="od-side-title"><Wallet size={16} /> Pagamentos</h2>
      {!open && due > 0 && !cancelled && <button type="button" className="button secondary" onClick={() => { setAmount((due / 100).toFixed(2).replace('.', ',')); setOpen(true) }}>
        Registrar pagamento</button>}
    </div>
    <div className="od-pay-summary">
      <div><small>Total</small><strong>{currency(order.totalCents)}</strong></div>
      <div className="paid"><small>Pago</small><strong>{currency(paid)}</strong></div>
      <div className={due > 0 ? 'due' : cancelled ? '' : 'paid'}><small>{due > 0 ? 'Falta' : 'Situação'}</small>
        <strong>{due > 0 ? currency(due) : cancelled ? 'Cancelado' : 'Quitado'}</strong></div>
    </div>
    {payments.length > 0 && <ul className="od-pay-list">
      {payments.map(payment => <li key={payment.id}>
        <div><strong>{currency(payment.amountCents)} • {paymentMethodLabels[payment.method] ?? payment.method}</strong>
          <small>Pago em {dateLabel(payment.paidOn)}{payment.note ? ` • ${payment.note}` : ''}</small></div>
        <button type="button" className="icon-button admin-only" aria-label={`Desfazer pagamento de ${currency(payment.amountCents)}`}
          title="Desfazer pagamento" disabled={busy} onClick={() => remove(payment.id, payment.amountCents)}><Trash2 size={15} /></button>
      </li>)}
    </ul>}
    {payments.length === 0 && !open && <p className="order-muted">Nenhum pagamento lançado.</p>}
    {open && <form className="od-pay-form" onSubmit={event => { event.preventDefault(); register() }}>
      <div className="od-pay-row">
        <label>Valor (R$)<input inputMode="decimal" required value={amount} autoFocus onChange={event => setAmount(event.target.value)} /></label>
        <label>Forma<select value={method} onChange={event => setMethod(event.target.value as PaymentMethod)}>
          {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="od-pay-row">
        <label>Pago em<input type="date" required value={paidOn} max={todayIso()} onChange={event => setPaidOn(event.target.value)} /></label>
        <label>Observação <span className="optional">(opcional)</span><input maxLength={200} value={note}
          onChange={event => setNote(event.target.value)} placeholder="Ex.: pago na entrega" /></label>
      </div>
      <div className="od-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
        <button className="button primary" disabled={busy || toCents(amount) <= 0}>Lançar</button>
      </div>
    </form>}
  </section>
}

/** Selos do pedido na lista e na agenda: cadastrado à mão, quanto falta pagar e a observação interna. */
export function OrderFlags({ order }: { order: Order }) {
  const due = balanceCents(order)
  const note = order.internalNote?.trim()
  if (order.source !== 'MANUAL' && !note) return null
  return <span className="order-flags">
    {order.source === 'MANUAL' && <span className="order-flag manual">⚠ {manualTagText(order.manualReason)}</span>}
    {due > 0 && <span className="order-flag due">Falta {currency(due)}</span>}
    {note && <span className="order-flag note" title={note}><StickyNote size={12} />
      {note.length > 40 ? `${note.slice(0, 40).trimEnd()}…` : note}</span>}
  </span>
}

/**
 * Trocar a poltrona antes da entrega (ex.: a cliente só quer a bege). Mostra só as poltronas da filial livres em todo o
 * período reservado; os dias passam para a nova poltrona.
 */
export function ChairSwap({ credentials, order, busy, perform }: {
  credentials: string; order: Order; busy: boolean; perform: Perform
}) {
  const [open, setOpen] = useState(false)
  const [chairs, setChairs] = useState<Chair[] | null>(null)
  const [chairId, setChairId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function start() {
    setOpen(true)
    setChairs(null)
    setError('')
    try {
      const list = await api.manualOrderChairs(credentials, order.branchId, order.stockStart ?? order.start, order.stockEnd ?? order.end)
      setChairs(list)
      setChairId(list[0]?.id ?? '')
    } catch (cause) {
      setError(getMessage(cause))
      setChairs([])
    }
  }

  if (!open) return <button type="button" className="button secondary od-chair-swap" disabled={busy} onClick={() => void start()}>
    <Armchair size={15} /> Trocar poltrona</button>
  return <div className="od-pay-form od-chair-swap-form">
    <label>Nova poltrona<select value={chairId} disabled={!chairs || chairs.length === 0} onChange={event => setChairId(event.target.value)}>
      {!chairs && <option value="">Procurando poltronas livres...</option>}
      {chairs && chairs.length === 0 && <option value="">Nenhuma outra poltrona livre no período</option>}
      {chairs?.map(chair => <option key={chair.id} value={chair.id}>Poltrona {chair.code}{chair.model ? ` • ${chair.model}` : ''}</option>)}
    </select></label>
    <label>Motivo <span className="optional">(opcional)</span><input maxLength={200} value={note} onChange={event => setNote(event.target.value)}
      placeholder="Ex.: cliente só quer a bege" /></label>
    {error && <p className="mo-warn">{error}</p>}
    <div className="od-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
      <button type="button" className="button primary" disabled={busy || !chairId}
        onClick={() => void perform(() => api.changeOrderChair(credentials, order.id, chairId, note.trim()), 'Poltrona trocada.',
          () => { setOpen(false); setNote('') })}>Trocar</button>
    </div>
  </div>
}

/** Contrato assinado do pedido manual: abrir o arquivo anexado, ou anexar/trocar (PDF, JPG ou PNG, até 10 MB). */
export function ContractFileCard({ credentials, order }: { credentials: string; order: Order }) {
  const [file, setFile] = useState<ContractFile | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.orderContractFile(credentials, order.id).then(found => { if (active) setFile(found) }).catch(() => { if (active) setFile(null) })
    return () => { active = false }
  }, [credentials, order.id])

  async function send(chosen: File | undefined) {
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      setFile(await uploadOrderContractFile(credentials, order.id, chosen))
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel od-card od-pay" aria-labelledby="od-contract-title">
    <div className="od-card-head"><h2 id="od-contract-title" className="od-side-title"><FileSignature size={16} /> Contrato assinado</h2></div>
    {file === undefined ? <p className="order-muted">Carregando...</p>
      : file ? <ul className="od-pay-list"><li>
        <div><strong>{file.fileName}</strong><small>Anexado em {new Date(file.uploadedAt).toLocaleDateString('pt-BR')}</small></div>
        {file.url && <a className="button secondary" href={file.url} target="_blank" rel="noopener noreferrer">Abrir</a>}
      </li></ul>
        : <p className="od-contract-missing">⚠ Contrato ainda não anexado.</p>}
    <label className="button secondary od-contract-upload">
      {busy ? 'Enviando...' : file ? 'Trocar arquivo' : 'Anexar contrato'}
      <input type="file" accept="application/pdf,image/jpeg,image/png" hidden disabled={busy}
        onChange={event => { void send(event.target.files?.[0]); event.target.value = '' }} />
    </label>
    {error && <p className="mo-warn">{error}</p>}
  </section>
}

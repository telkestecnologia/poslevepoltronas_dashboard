import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, X } from 'lucide-react'
import type { Order } from '../../api'
import { RentalDatePicker } from '../overview/RentalDatePicker'

const dayLabel = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${iso}T12:00:00Z`))
const shortDay = (iso: string) => dayLabel(iso).slice(0, 5)
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
/** Horário sempre em 24 h (o campo nativo de hora mostra AM/PM em navegadores em inglês). */
const maskTime = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}
const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

/**
 * Entrega ou retirada antecipada ou posterior (igual ao app): um botão discreto "Dia e horário" ao lado da etapa,
 * que abre uma janela pequena com o dia e o horário. Na retirada, é também onde se prorroga a locação (retirada
 * posterior). Dias fora do bloqueio conferem se a poltrona está livre; o preço não muda.
 */
export function EarlySchedule({ order, kind, busy, current, onSave }: {
  order: Order; kind: 'delivery' | 'pickup'; busy: boolean
  /** Etapa atual do processo: o botão fica em laranja. */
  current?: boolean
  /** Devolve a mensagem de erro, ou null quando salvou. */
  onSave: (changes: { deliveryDate?: string | null; deliveryTime?: string | null; pickupDate?: string | null; pickupTime?: string | null }) => Promise<string | null>
}) {
  const delivery = kind === 'delivery'
  const day = delivery ? order.deliveryDate ?? order.start : order.pickupDate ?? order.end
  const time = delivery ? order.deliveryTime : order.pickupTime
  const moved = delivery ? !!order.deliveryDate : !!order.pickupDate
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [hour, setHour] = useState('')
  const [error, setError] = useState('')
  const today = todayIso()
  const min = delivery ? today : [order.deliveryDate ?? order.start, today].sort()[1]
  const max = delivery ? order.pickupDate ?? order.end : undefined
  const changedDate = date && date !== day ? date : null
  const hourOk = validTime(hour)
  const title = delivery ? 'Entrega antecipada ou posterior' : 'Prorrogar ou antecipar a retirada'
  const close = () => { setOpen(false); setDate(''); setHour(''); setError('') }

  async function save() {
    setError('')
    const changedHour = hourOk ? hour : null
    const failure = await onSave(delivery ? { deliveryDate: changedDate, deliveryTime: changedHour } : { pickupDate: changedDate, pickupTime: changedHour })
    if (failure) setError(failure)
    else close()
  }

  return <>
    <span className="od-step-when">{moved ? 'Combinada' : 'Prevista'} para {dayLabel(day)}{time ? ` às ${time.slice(0, 5)}` : ''}</span>
    <button type="button" className={`od-media-button${current ? ' now' : ''}`} onClick={() => setOpen(true)}
      title={delivery ? undefined : 'Mudar o dia da retirada ou prorrogar a locação do cliente'}>
      <CalendarClock size={15} /><span className="od-change"><small>{delivery ? 'ALTERAR' : 'ALTERAR OU PRORROGAR'}</small>Dia e horário</span></button>
    {open && createPortal(<div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close() }}>
      <section className="modal od-early-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><div><span className="eyebrow">PEDIDO • {order.customerName}</span>
          <h2>{title}</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={close} disabled={busy}><X size={20} /></button></div>
        <form className="modal-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <p className="field-help">{moved ? 'Combinada' : 'Prevista'} para {dayLabel(day)}{time ? ` às ${time.slice(0, 5)}` : ''}.</p>
          {!delivery && <p className="field-help od-extend-help">Para <strong>prorrogar</strong> a locação do cliente, escolha um dia
            depois de {shortDay(day)}. A poltrona fica bloqueada nos dias a mais (se estiver livre). O valor não muda sozinho:
            combine a cobrança dos dias extras com o cliente.</p>}
          <RentalDatePicker label="Dia" date={date || day} minDate={min} maxDate={max} onChange={value => { setDate(value); setError('') }} />
          <label>Horário<input type="text" inputMode="numeric" placeholder={time ? time.slice(0, 5) : '14:00'} maxLength={5}
            value={hour} onChange={event => setHour(maskTime(event.target.value))}
            aria-invalid={hour !== '' && !hourOk} /></label>
          {hour !== '' && !hourOk && <p className="field-help od-time-error">Use o formato 24 h, por exemplo 14:30.</p>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={close} disabled={busy}>Cancelar</button>
            <button type="submit" className="button primary" disabled={busy || (hour !== '' && !hourOk) || (!changedDate && !hourOk)}>Salvar</button></div>
        </form>
      </section>
    </div>, document.body)}
  </>
}

/**
 * Reagendar direto na janela da etapa (sem abrir outra janela): calendário com o novo dia e o horário.
 * Entrega: antecipar ou adiar. Retirada: antecipar ou prorrogar a locação.
 */
export function InlineSchedule({ order, kind, busy, onSave }: {
  order: Order; kind: 'delivery' | 'pickup'; busy: boolean
  onSave: (changes: { deliveryDate?: string | null; deliveryTime?: string | null; pickupDate?: string | null; pickupTime?: string | null }) => Promise<string | null>
}) {
  const delivery = kind === 'delivery'
  const day = delivery ? order.deliveryDate ?? order.start : order.pickupDate ?? order.end
  const time = delivery ? order.deliveryTime : order.pickupTime
  const moved = delivery ? !!order.deliveryDate : !!order.pickupDate
  const [date, setDate] = useState('')
  const [hour, setHour] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const today = todayIso()
  const min = delivery ? today : [order.deliveryDate ?? order.start, today].sort()[1]
  const max = delivery ? order.pickupDate ?? order.end : undefined
  const changedDate = date && date !== day ? date : null
  const hourOk = validTime(hour)

  async function save() {
    setError('')
    setDone('')
    const failure = await onSave(delivery ? { deliveryDate: changedDate, deliveryTime: hourOk ? hour : null }
      : { pickupDate: changedDate, pickupTime: hourOk ? hour : null })
    if (failure) { setError(failure); return }
    setDone(`Reagendado para ${dayLabel(changedDate ?? day)}${hourOk ? ` às ${hour}` : ''}.`)
    setDate('')
    setHour('')
  }

  return <div className="od-inline-schedule">
    <div className="od-inline-now"><CalendarClock size={18} />
      <span>{moved ? 'Combinada' : 'Prevista'} para <b>{dayLabel(day)}</b>{time ? <> às <b>{time.slice(0, 5)}</b></> : ' (sem horário)'}</span></div>
    {!delivery && <p className="field-help od-extend-help">Para <strong>prorrogar</strong>, escolha um dia depois de {shortDay(day)}.
      A poltrona fica bloqueada nos dias a mais (se estiver livre). O valor não muda sozinho: combine a cobrança com o cliente.</p>}
    <div className="od-inline-fields">
      <RentalDatePicker label={delivery ? 'Novo dia da entrega' : 'Novo dia da retirada'} date={date || day} minDate={min} maxDate={max}
        onChange={value => { setDate(value); setError(''); setDone('') }} />
      <label className="order-field"><span>Novo horário</span>
        <input type="text" inputMode="numeric" placeholder={time ? time.slice(0, 5) : '14:00'} maxLength={5} value={hour}
          onChange={event => { setHour(maskTime(event.target.value)); setDone('') }} aria-invalid={hour !== '' && !hourOk} /></label>
      <button type="button" className="button primary" disabled={busy || (hour !== '' && !hourOk) || (!changedDate && !hourOk)}
        onClick={() => void save()}><CalendarClock size={16} /> Reagendar</button>
    </div>
    {hour !== '' && !hourOk && <p className="field-help od-time-error">Use o formato 24 h, por exemplo 14:30.</p>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {done && <p className="od-inline-done" role="status">✓ {done}</p>}
  </div>
}

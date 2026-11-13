import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, X } from 'lucide-react'
import type { Order } from '../../api'

const dayLabel = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${iso}T12:00:00Z`))
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })

/**
 * Entrega ou retirada antecipada ou posterior (igual ao app): um botão discreto "Dia e horário" ao lado da etapa,
 * que abre uma janela pequena com o dia e o horário. Dias fora do bloqueio conferem se a poltrona está livre.
 */
export function EarlySchedule({ order, kind, busy, onSave }: {
  order: Order; kind: 'delivery' | 'pickup'; busy: boolean
  onSave: (changes: { deliveryDate?: string | null; deliveryTime?: string | null; pickupDate?: string | null; pickupTime?: string | null }) => Promise<boolean>
}) {
  const delivery = kind === 'delivery'
  const day = delivery ? order.deliveryDate ?? order.start : order.pickupDate ?? order.end
  const time = delivery ? order.deliveryTime : order.pickupTime
  const moved = delivery ? !!order.deliveryDate : !!order.pickupDate
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [hour, setHour] = useState('')
  const today = todayIso()
  const min = delivery ? today : [order.deliveryDate ?? order.start, today].sort()[1]
  const max = delivery ? order.pickupDate ?? order.end : undefined
  const changedDate = date && date !== day ? date : null
  const close = () => { setOpen(false); setDate(''); setHour('') }

  async function save() {
    const ok = await onSave(delivery ? { deliveryDate: changedDate, deliveryTime: hour || null } : { pickupDate: changedDate, pickupTime: hour || null })
    if (ok) close()
  }

  return <>
    <span className="od-step-when">{moved ? 'Combinada' : 'Prevista'} para {dayLabel(day)}{time ? ` às ${time.slice(0, 5)}` : ''}</span>
    <button type="button" className="od-media-button" onClick={() => setOpen(true)}><CalendarClock size={15} /> Dia e horário</button>
    {open && createPortal(<div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close() }}>
      <section className="modal od-early-modal" role="dialog" aria-modal="true" aria-label={delivery ? 'Entrega antecipada ou posterior' : 'Retirada antecipada ou posterior'}>
        <div className="modal-head"><div><span className="eyebrow">PEDIDO • {order.customerName}</span>
          <h2>{delivery ? 'Entrega antecipada ou posterior' : 'Retirada antecipada ou posterior'}</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={close} disabled={busy}><X size={20} /></button></div>
        <form className="modal-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <p className="field-help">{moved ? 'Combinada' : 'Prevista'} para {dayLabel(day)}{time ? ` às ${time.slice(0, 5)}` : ''}.</p>
          <label>Dia<input type="date" value={date || day} min={min} max={max} onChange={event => setDate(event.target.value)} /></label>
          <label>Horário<input type="time" value={hour} onChange={event => setHour(event.target.value)} /></label>
          <div className="modal-actions"><button type="button" className="button secondary" onClick={close} disabled={busy}>Cancelar</button>
            <button type="submit" className="button primary" disabled={busy || (!changedDate && !hour)}>Salvar</button></div>
        </form>
      </section>
    </div>, document.body)}
  </>
}

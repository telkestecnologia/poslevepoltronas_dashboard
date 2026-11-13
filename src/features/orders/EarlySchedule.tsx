import { useState } from 'react'
import { CalendarClock, ChevronDown, ChevronUp } from 'lucide-react'
import type { Order } from '../../api'

const dayLabel = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${iso}T12:00:00Z`))
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })

/**
 * Entrega (na etapa "Aguardando entrega") ou retirada (em "Aguardando retirada") antecipada ou posterior, igual ao app:
 * só o dia e o horário. Dias fora do bloqueio conferem se a poltrona está livre; o preço não muda.
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

  async function save() {
    const ok = await onSave(delivery ? { deliveryDate: changedDate, deliveryTime: hour || null } : { pickupDate: changedDate, pickupTime: hour || null })
    if (ok) { setOpen(false); setDate(''); setHour('') }
  }

  return <div className="od-collapse od-early">
    <button type="button" className="od-collapse-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span><strong><CalendarClock size={16} /> {delivery ? 'Entrega antecipada ou posterior' : 'Retirada antecipada ou posterior'}</strong>
        <small>{moved ? 'Combinada para' : 'Prevista para'} {dayLabel(day)}{time ? ` às ${time.slice(0, 5)}` : ''}</small></span>
      {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
    {open && <div className="od-collapse-body">
      <div className="order-form-grid">
        <label className="order-field">Dia<input type="date" value={date || day} min={min} max={max} onChange={event => setDate(event.target.value)} /></label>
        <label className="order-field">Horário<input type="time" value={hour} placeholder={time ?? ''} onChange={event => setHour(event.target.value)} /></label>
      </div>
      <div><button type="button" className="button secondary" disabled={busy || (!changedDate && !hour)} onClick={() => void save()}>
        {delivery ? 'Salvar dia e horário da entrega' : 'Salvar dia e horário da retirada'}</button></div>
    </div>}
  </div>
}

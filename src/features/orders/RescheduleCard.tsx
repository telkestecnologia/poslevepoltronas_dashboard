import { useEffect, useState } from 'react'
import { Armchair, CalendarClock, CalendarSearch, Check, Unlock } from 'lucide-react'
import { api, type Order, type RescheduleAvailability } from '../../api'
import { dateLabel } from '../../data/orders'
import { getMessage } from '../../utils/errors'
import { todayIso } from '../../utils/money'
import './reschedule.css'

type Perform = (operation: () => Promise<Order>, message: string, after?: () => void) => Promise<void>
type Mode = 'hold' | 'confirm'

const daysBetween = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1

/** Pedidos que ainda podem ser remarcados: pagos, antes da entrega, ou já aguardando a nova data. */
export const canReschedule = (order: Order) => ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING', 'AWAITING_NEW_DATE'].includes(order.status)

/**
 * Remarcação da locação paga (ex.: cirurgia remarcada). Sem a data certa, a equipe bloqueia uma poltrona no período
 * provável e o pedido fica "Aguardando nova data" (os dias pagos são liberados). Com a data certa, o pedido vai para o
 * novo período com o mesmo número de dias. Em cada passo aparecem as poltronas livres com modelo e observação, para
 * escolher uma com as mesmas funcionalidades da que foi paga (ex.: massageador).
 */
export function RescheduleCard({ credentials, order, busy, perform }: {
  credentials: string; order: Order; busy: boolean; perform: Perform
}) {
  const hold = order.rescheduleHold ?? null
  const waiting = order.status === 'AWAITING_NEW_DATE'
  const paidStart = hold?.previousStart ?? order.start
  const paidEnd = hold?.previousEnd ?? order.end
  const paidDays = daysBetween(paidStart, paidEnd)
  const [mode, setMode] = useState<Mode | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [chairId, setChairId] = useState('')
  const [availability, setAvailability] = useState<RescheduleAvailability | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const today = todayIso()

  function open(next: Mode) {
    setMode(next)
    setStart(next === 'hold' && hold ? hold.start : '')
    setEnd(next === 'hold' && hold ? hold.end : '')
    setNote('')
    setAvailability(null)
    setChairId('')
    setError('')
  }

  // Poltronas livres sempre que o período muda (no passo da nova data, o fim é o mesmo número de dias já pago).
  useEffect(() => {
    if (!mode || !start || (mode === 'hold' && (!end || end < start))) { setAvailability(null); return }
    let active = true
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      api.rescheduleChairs(credentials, order.id, start, mode === 'hold' ? end : undefined)
        .then(result => {
          if (!active) return
          setAvailability(result)
          const preferred = mode === 'confirm' && hold ? hold.chairId : order.chairId
          setChairId(current => result.chairs.some(chair => chair.id === current) ? current
            : result.chairs.find(chair => chair.id === preferred)?.id ?? '')
        })
        .catch(cause => { if (active) { setAvailability(null); setError(getMessage(cause)) } })
        .finally(() => { if (active) setLoading(false) })
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [credentials, order.id, order.chairId, hold, mode, start, end])

  function submit() {
    if (!mode || !chairId || !start) return
    const chosen = availability?.chairs.find(chair => chair.id === chairId)
    if (mode === 'hold') {
      void perform(() => api.rescheduleHold(credentials, order.id, { chairId, start, end, note: note.trim() || undefined }),
        `Poltrona ${chosen?.code ?? ''} bloqueada de ${dateLabel(start)} a ${dateLabel(end)}. O pedido aguarda a nova data.`,
        () => setMode(null))
    } else {
      void perform(() => api.rescheduleConfirm(credentials, order.id, { chairId, start, note: note.trim() || undefined }),
        `Locação remarcada para ${dateLabel(start)} a ${dateLabel(availability?.end ?? start)}.`, () => setMode(null))
    }
  }

  function release() {
    if (!hold) return
    const reason = window.prompt(`Liberar a poltrona ${hold.chairCode} (bloqueada de ${dateLabel(hold.start)} a ${dateLabel(hold.end)})?\n\n`
      + 'Ela volta a ficar livre para outras clientes. O pedido continua aguardando a nova data e o pagamento não muda.\n\n'
      + 'Motivo (opcional):', '')
    if (reason === null) return
    void perform(() => api.rescheduleRelease(credentials, order.id, reason.trim() || undefined),
      `Poltrona ${hold.chairCode} liberada. O pedido continua aguardando a nova data.`)
  }

  const paid = availability?.paidChair
  return <section className={`panel od-card rs-card${waiting ? ' waiting' : ''}`} aria-labelledby="rs-title">
    <div className="od-card-head"><div>
      <span className="eyebrow">{waiting ? 'AGUARDANDO NOVA DATA' : 'REMARCAÇÃO'}</span>
      <h2 id="rs-title"><CalendarClock size={18} /> {waiting ? 'Locação aguardando a nova data' : 'Remarcar locação'}</h2>
      {waiting && hold
        ? <p>Poltrona <b>{hold.chairCode}</b> bloqueada de <b>{dateLabel(hold.start)}</b> a <b>{dateLabel(hold.end)}</b>.
          Período pago antes: {dateLabel(paidStart)} a {dateLabel(paidEnd)} ({paidDays} dias), que já foi liberado.
          {hold.note ? <> Motivo: {hold.note}.</> : null}</p>
        : waiting ? <p>Nenhuma poltrona bloqueada. Período pago antes: {dateLabel(paidStart)} a {dateLabel(paidEnd)} ({paidDays} dias).
          Marque a nova data quando a cliente tiver, ou bloqueie um período.</p>
        : <p>A cliente precisa de outra data (ex.: cirurgia remarcada)? O pagamento continua valendo para {paidDays} dias.</p>}
    </div></div>

    {!mode && <div className="rs-actions">
      <button type="button" className="button primary" disabled={busy} onClick={() => open('confirm')}>
        <Check size={16} /> {waiting ? 'Marcar a nova data' : 'Já tem a nova data'}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => open('hold')}>
        <CalendarSearch size={16} /> {hold ? 'Mudar o bloqueio' : waiting ? 'Bloquear um período' : 'Ainda sem data: bloquear um período'}</button>
      {hold && <button type="button" className="button secondary rs-release" disabled={busy} onClick={release}>
        <Unlock size={16} /> Liberar poltrona</button>}
    </div>}

    {mode && <div className="rs-form">
      <div className="rs-dates">
        <label>{mode === 'hold' ? 'Bloquear de' : 'Nova data de entrega'}
          <input type="date" min={today} value={start} onChange={event => setStart(event.target.value)} /></label>
        {mode === 'hold'
          ? <label>Até<input type="date" min={start || today} value={end} onChange={event => setEnd(event.target.value)} /></label>
          : <p className="rs-hint">{availability ? <>Retirada em <b>{dateLabel(availability.end)}</b> ({availability.days} dias, o mesmo já pago).</>
            : `O período continua com ${paidDays} dias.`}</p>}
      </div>
      {mode === 'hold' && start && end && end >= start && <p className="rs-hint">
        {daysBetween(start, end)} dias de bloqueio. Quanto menor o período, menos a poltrona fica parada para outras clientes.</p>}

      {paid && <p className="rs-paid"><Armchair size={15} /> Poltrona paga: <b>{paid.code}</b>{paid.model ? ` • ${paid.model}` : ''}
        {paid.notes ? <em> ({paid.notes})</em> : null}</p>}
      {loading && <p className="rs-hint" role="status">Procurando poltronas livres...</p>}
      {!loading && availability && availability.chairs.length === 0 && <p className="mo-warn" role="alert">
        Nenhuma poltrona livre da filial em todo esse período. Tente outras datas.</p>}
      {!loading && availability && availability.chairs.length > 0 && <fieldset className="rs-chairs">
        <legend>Poltronas livres de {dateLabel(availability.start)} a {dateLabel(availability.end)}</legend>
        {availability.chairs.map(chair => <label key={chair.id} className={`rs-chair${chair.id === chairId ? ' selected' : ''}`}>
          <input type="radio" name="rs-chair" value={chair.id} checked={chair.id === chairId} onChange={() => setChairId(chair.id)} />
          <span><strong>Poltrona {chair.code}{chair.current ? <i className="rs-tag">a mesma paga</i> : null}</strong>
            <small>{chair.model || 'Sem modelo cadastrado'}{chair.notes ? ` • ${chair.notes}` : ''}</small></span>
        </label>)}
      </fieldset>}

      <label className="rs-note">Observação <span className="optional">(opcional)</span>
        <input maxLength={200} value={note} onChange={event => setNote(event.target.value)}
          placeholder={mode === 'hold' ? 'Ex.: cirurgia adiada para janeiro, médico ainda vai marcar' : 'Ex.: cirurgia marcada para 12/01'} /></label>
      {error && <p className="mo-warn" role="alert">{error}</p>}
      <div className="od-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
        <button type="button" className="button primary" disabled={busy || loading || !chairId || !start || (mode === 'hold' && !end)} onClick={submit}>
          {mode === 'hold' ? 'Bloquear poltrona' : 'Remarcar'}</button>
      </div>
    </div>}
  </section>
}

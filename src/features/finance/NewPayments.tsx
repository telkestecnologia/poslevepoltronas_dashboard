import { useEffect, useRef, useState } from 'react'
import { BadgeDollarSign, X } from 'lucide-react'
import { api, type FinancialEntry } from '../../api'
import { branchLabel } from '../../utils/branches'
import { desktopNotificationsWanted } from '../profile/NotificationToggle'
import './new-payments.css'

const POLL_MS = 30_000
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })

type Payment = FinancialEntry & { payerName?: string | null }

/**
 * Novos recebimentos (igual ao app): a cada 30 segundos confere as entradas de hoje. Cada recebimento novo aparece em
 * destaque ("Novo recebimento R$ ...", quem pagou e a filial) e, com as notificações ligadas, avisa no computador.
 * Na primeira conferência só guarda o que já existia.
 */
/** Fica montado o tempo todo (para não perder recebimentos); visible mostra o aviso só no Financeiro e na Visão geral. */
export function NewPayments({ credentials, visible, onOpenFinance }: { credentials: string; visible: boolean; onOpenFinance?: () => void }) {
  const [latest, setLatest] = useState<Payment[]>([])
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        const day = todayIso()
        const report = await api.finance(credentials, { from: day, to: day, branchId: '', page: 0, size: 20 })
        if (!active) return
        const inflows = report.entries.filter(entry => entry.kind === 'INFLOW' && !entry.demo)
          .map(entry => ({ ...entry, payerName: report.payers?.[entry.reference] ?? null }))
        if (seen.current === null) { seen.current = new Set(inflows.map(entry => entry.id)); return }
        const known = seen.current
        const fresh = inflows.filter(entry => !known.has(entry.id))
        if (fresh.length === 0) return
        fresh.forEach(entry => known.add(entry.id))
        setLatest(current => [...fresh, ...current].slice(0, 5))
        if (desktopNotificationsWanted() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          for (const entry of fresh) {
            new Notification(`💰 Novo recebimento ${money.format(entry.amountCents / 100)}`, {
              body: [entry.payerName, entry.paymentMethod === 'CARTAO' ? 'Cartão' : 'Pix', branchLabel(entry.branchName)].filter(Boolean).join(' • '),
              icon: '/logo-pos-leve-icon.webp', tag: `payment-${entry.id}` })
          }
        }
      } catch {
        // Sem internet: tenta de novo na próxima conferência.
      }
    }
    void check()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void check() }, POLL_MS)
    return () => { active = false; window.clearInterval(timer) }
  }, [credentials])

  if (!visible || latest.length === 0) return null
  return <section className="new-payments" role="status">
    <div className="new-payments-head"><span className="new-payments-icon"><BadgeDollarSign size={18} /></span>
      <strong>{latest.length === 1 ? 'Novo recebimento' : `${latest.length} novos recebimentos`}</strong>
      <button type="button" aria-label="Fechar aviso" onClick={() => setLatest([])}><X size={16} /></button></div>
    {latest.map(entry => <button type="button" key={entry.id} className="new-payments-row" disabled={!onOpenFinance} onClick={onOpenFinance}>
      <b>{money.format(entry.amountCents / 100)}</b>
      <span><strong>{entry.payerName ?? 'Cliente'} • {entry.paymentMethod === 'CARTAO' ? 'Cartão' : 'Pix'}</strong>
        <small>{when.format(new Date(entry.occurredAt))} • {branchLabel(entry.branchName)}</small></span>
    </button>)}
  </section>
}

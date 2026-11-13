import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { api } from '../../api'
import { getMessage } from '../../utils/errors'
import { downloadIsaReport } from './isaReport'
import '../finance/financeReport.css'

const isoDay = (date: Date) => date.toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })

/**
 * Ícone de PDF ao lado de "O que a Isa sabe" (igual ao app): escolhe o período e a Isa analisa todos os atendimentos
 * dele (site e WhatsApp) num relatório geral em PDF.
 */
export function IsaReportButton({ credentials }: { credentials: string }) {
  const today = isoDay(new Date())
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`)
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (!from || !to || to < from) return setError('Escolha um período válido.')
    setBusy(true)
    setError('')
    try {
      await downloadIsaReport(await api.conversationReport(credentials, from, to))
      setOpen(false)
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button type="button" className="finance-date-icon pdf" onClick={() => { setError(''); setOpen(true) }}
      title="Baixar relatório do atendimento em PDF" aria-label="Baixar relatório do atendimento em PDF"><FileText size={19} /></button>
    {open && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false) }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="isa-report-title">
        <div className="modal-head"><div><span className="eyebrow">ISA • ATENDIMENTO</span><h2 id="isa-report-title">Relatório do atendimento</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={() => setOpen(false)} disabled={busy}><X size={20} /></button></div>
        <form className="modal-form" onSubmit={event => { event.preventDefault(); void generate() }}>
          <p className="field-help">Escolha o período. A Isa lê os atendimentos do site e do WhatsApp e monta um relatório geral em PDF.</p>
          <label>De<input type="date" value={from} max={to || today} onChange={event => setFrom(event.target.value)} required /></label>
          <label>Até<input type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="button primary" disabled={busy}>{busy ? 'A Isa está analisando...' : 'Gerar relatório em PDF'}</button></div>
        </form>
      </section>
    </div>}
  </>
}

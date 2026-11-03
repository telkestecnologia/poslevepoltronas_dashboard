import type { FinancialEntry, FinancialReport } from '../../api'
import { branchLabel } from '../../utils/branches'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' })
const shortDateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

const currency = (cents: number) => money.format(cents / 100)
const shortDate = (iso: string) => shortDateFormat.format(new Date(`${iso}T12:00:00Z`))
const monthName = (iso: string) => monthFormat.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
const dateTime = (iso: string) => dateTimeFormat.format(new Date(iso))
const escape = (text: string) => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)

/**
 * Relatório geral do financeiro (o mesmo do app): resumo, mês a mês, filiais e extrato completo. Abre numa janela
 * pronta para imprimir, onde "Salvar como PDF" gera o arquivo.
 */
export function openFinanceReport({ report, entries, from, to, branch }: {
  report: FinancialReport; entries: FinancialEntry[]; from: string; to: string; branch: string
}) {
  const months = report.monthly.filter(item => item.inflowCents || item.outflowCents)
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatório financeiro • Pós Leve</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #2a3236; margin: 32px; font-size: 12px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #168893; padding-bottom: 12px; }
  h1 { margin: 0; font-size: 22px; color: #127a84; }
  h2 { margin: 26px 0 8px; font-size: 15px; color: #127a84; }
  .muted { color: #7a8287; }
  .demo { margin-top: 14px; padding: 8px 12px; border-radius: 6px; background: #f8f2e6; color: #7a6332; }
  .totals { display: flex; gap: 10px; margin-top: 16px; }
  .total { flex: 1; padding: 12px; border: 1px solid #e7e6e2; border-radius: 8px; }
  .total b { display: block; margin-top: 4px; font-size: 17px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #7a8287; padding: 6px 8px; border-bottom: 1px solid #e7e6e2; }
  td { padding: 7px 8px; border-bottom: 1px solid #f0efeb; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .in { color: #2a8a6e; } .out { color: #d9603a; }
  footer { margin-top: 28px; font-size: 10px; color: #a3a8ab; text-align: center; }
</style></head><body>
<header>
  <div><h1>Relatório financeiro • Pós Leve</h1>
    <div class="muted">Período de ${shortDate(from)} a ${shortDate(to)} • ${escape(branch)}</div></div>
  <div class="muted">Gerado em ${dateTime(new Date().toISOString())}</div>
</header>
${report.mode === 'DEMO' ? '<div class="demo">Dados de demonstração: os valores são fictícios.</div>' : ''}
<div class="totals">
  <div class="total">Saldo acumulado<b>${currency(report.balanceCents)}</b></div>
  <div class="total">Entrou no período<b class="in">${currency(report.inflowCents)}</b></div>
  <div class="total">Saiu no período<b class="out">${currency(report.outflowCents)}</b></div>
  <div class="total">Sobrou<b>${currency(report.netCents)}</b></div>
</div>
<h2>Mês a mês</h2>
<table><tr><th>Mês</th><th class="num">Entrou</th><th class="num">Saiu</th><th class="num">Sobrou</th></tr>
${months.map(item => `<tr><td>${monthName(item.start)}</td><td class="num in">${currency(item.inflowCents)}</td><td class="num out">${currency(item.outflowCents)}</td><td class="num">${currency(item.inflowCents - item.outflowCents)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sem movimentação.</td></tr>'}
</table>
<h2>Resultado por filial</h2>
<table><tr><th>Filial</th><th class="num">Entrou</th><th class="num">Saiu</th><th class="num">Sobrou</th></tr>
${report.branches.map(item => `<tr><td>${escape(branchLabel(item.branchName))}</td><td class="num in">${currency(item.inflowCents)}</td><td class="num out">${currency(item.outflowCents)}</td><td class="num">${currency(item.inflowCents - item.outflowCents)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sem movimentação.</td></tr>'}
</table>
<h2>Extrato completo (${entries.length} lançamentos)</h2>
<table><tr><th>Data</th><th>Descrição</th><th>Filial</th><th>Meio</th><th class="num">Valor</th></tr>
${entries.map(entry => `<tr><td>${dateTime(entry.occurredAt)}</td><td><b>${escape(entry.description)}</b><br/><span class="muted">${escape(entry.category)}${entry.reference ? ` • Ref. ${escape(entry.reference)}` : ''}</span></td><td>${escape(branchLabel(entry.branchName))}</td><td>${escape(entry.paymentMethod)}</td><td class="num ${entry.kind === 'INFLOW' ? 'in' : 'out'}">${entry.kind === 'INFLOW' ? '+' : '−'} ${currency(entry.amountCents)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhum lançamento no período.</td></tr>'}
</table>
<footer>Pós Leve Poltronas • relatório gerado pelo painel</footer>
<script>window.onload = () => setTimeout(() => window.print(), 300)</script>
</body></html>`
  const page = window.open('', '_blank')
  if (!page) return false
  page.document.open()
  page.document.write(html)
  page.document.close()
  return true
}

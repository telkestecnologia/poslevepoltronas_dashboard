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

const teal = [18, 122, 132] as const
const muted = [122, 130, 135] as const
const inflow = [42, 138, 110] as const
const outflow = [217, 96, 58] as const

/**
 * Relatório geral do financeiro (o mesmo do app): resumo, mês a mês, filiais e extrato completo.
 * Gera o PDF no navegador e baixa o arquivo direto, sem abrir janela de impressão.
 */
export async function downloadFinanceReport({ report, entries, from, to, branch }: {
  report: FinancialReport; entries: FinancialEntry[]; from: string; to: string; branch: string
}) {
  // Carregadas só quando alguém pede o relatório, para não pesar a abertura do painel.
  const [{ jsPDF }, plugin] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  // O pacote do autotable é CommonJS: conforme o empacotador, a função vem em default ou em default.default.
  const loaded = plugin.default as unknown as typeof plugin.default | { default: typeof plugin.default }
  const autoTable = typeof loaded === 'function' ? loaded : loaded.default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 52

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...teal)
  doc.text('Relatório financeiro • Pós Leve', margin, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...muted)
  doc.text(`Gerado em ${dateTime(new Date().toISOString())}`, width - margin, y, { align: 'right' })
  y += 16
  doc.text(`Período de ${shortDate(from)} a ${shortDate(to)} • ${branch}`, margin, y)
  y += 10
  doc.setDrawColor(22, 136, 147).setLineWidth(2).line(margin, y, width - margin, y)
  y += 18


  const totals = [
    { label: 'Saldo acumulado', value: report.balanceCents, color: [42, 50, 54] as const },
    { label: 'Entrou no período', value: report.inflowCents, color: inflow },
    { label: 'Saiu no período', value: report.outflowCents, color: outflow },
    { label: 'Resultado', value: report.netCents, color: [42, 50, 54] as const },
  ]
  const gap = 8
  const boxWidth = (width - margin * 2 - gap * (totals.length - 1)) / totals.length
  totals.forEach((total, index) => {
    const x = margin + index * (boxWidth + gap)
    doc.setDrawColor(231, 230, 226).setLineWidth(1).roundedRect(x, y, boxWidth, 46, 5, 5, 'S')
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...muted).text(total.label, x + 9, y + 16)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(total.color[0], total.color[1], total.color[2]).text(currency(total.value), x + 9, y + 35)
  })
  y += 66

  const table = (title: string, head: string[], body: (string | { content: string; color?: readonly number[] })[][],
    numericFrom: number) => {
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...teal).text(title, margin, y)
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      head: [head],
      body: body.map(row => row.map(cell => typeof cell === 'string' ? cell : {
        content: cell.content, styles: cell.color ? { textColor: [...cell.color] as [number, number, number] } : {},
      })),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [42, 50, 54], lineColor: [240, 239, 235], lineWidth: { bottom: 0.6 } },
      headStyles: { fontSize: 7.5, textColor: [...muted], fontStyle: 'bold' },
      columnStyles: Object.fromEntries(head.map((_, index) => [index, index >= numericFrom ? { halign: 'right' as const } : {}])),
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
  }

  const empty = (columns: number, text: string) => [[{ content: text, color: muted }, ...Array(columns - 1).fill('')]]
  const months = report.monthly.filter(item => item.inflowCents || item.outflowCents)
  table('Mês a mês', ['MÊS', 'ENTROU', 'SAIU', 'SOBROU'], months.length ? months.map(item => [
    monthName(item.start), { content: currency(item.inflowCents), color: inflow },
    { content: currency(item.outflowCents), color: outflow }, currency(item.inflowCents - item.outflowCents),
  ]) : empty(4, 'Sem movimentação.'), 1)
  table('Resultado por filial', ['FILIAL', 'ENTROU', 'SAIU', 'SOBROU'], report.branches.length ? report.branches.map(item => [
    branchLabel(item.branchName), { content: currency(item.inflowCents), color: inflow },
    { content: currency(item.outflowCents), color: outflow }, currency(item.inflowCents - item.outflowCents),
  ]) : empty(4, 'Sem movimentação.'), 1)
  table(`Extrato completo (${entries.length} lançamentos)`, ['DATA', 'DESCRIÇÃO', 'FILIAL', 'MEIO', 'VALOR'], entries.length
    ? entries.map(entry => [
      dateTime(entry.occurredAt),
      `${entry.description}\n${entry.category}${entry.reference ? ` • Ref. ${entry.reference}` : ''}`,
      branchLabel(entry.branchName), entry.paymentMethod,
      { content: `${entry.kind === 'INFLOW' ? '+' : '-'} ${currency(entry.amountCents)}`, color: entry.kind === 'INFLOW' ? inflow : outflow },
    ])
    : empty(5, 'Nenhum lançamento no período.'), 4)

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(163, 168, 171)
    doc.text(`Pós Leve Poltronas • relatório gerado pelo painel • página ${page} de ${pages}`,
      width / 2, doc.internal.pageSize.getHeight() - 24, { align: 'center' })
  }

  const now = new Date()
  const stamp = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`
  const name = `relatorio-financeiro-posleve-${from}-a-${to}-${stamp}.pdf`
  doc.save(name)
  return name
}

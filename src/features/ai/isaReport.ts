import type { ConversationReport } from '../../api'

const shortDateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' })
const shortDate = (iso: string) => shortDateFormat.format(new Date(`${iso}T12:00:00Z`))

const teal = [18, 122, 132] as const
const ink = [42, 50, 54] as const
const muted = [122, 130, 135] as const
const red = [192, 57, 43] as const
const purple = [69, 53, 184] as const

/**
 * Relatório geral do atendimento feito pela Isa (o mesmo do app): números, nota, como está o atendimento, pontos
 * fortes, problemas, perguntas frequentes, vendas perdidas, dúvidas sem resposta e sugestões. Baixa o PDF direto.
 */
export async function downloadIsaReport(report: ConversationReport) {
  const [{ jsPDF }, plugin] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const loaded = plugin.default as unknown as typeof plugin.default | { default: typeof plugin.default }
  const autoTable = typeof loaded === 'function' ? loaded : loaded.default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const margin = 40
  const inner = width - margin * 2
  let y = 52

  const room = (needed: number) => { if (y + needed > height - 50) { doc.addPage(); y = 52 } }
  const title = (text: string) => {
    room(40)
    doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(...teal).text(text, margin, y)
    y += 16
  }
  const paragraph = (text: string, color: readonly number[] = ink, indent = 0) => {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(color[0], color[1], color[2])
    for (const line of doc.splitTextToSize(text, inner - indent) as string[]) {
      room(14)
      doc.text(line, margin + indent, y)
      y += 14
    }
  }
  const bullets = (items: string[], empty: string) => {
    if (!items.length) { paragraph(empty, muted); y += 8; return }
    for (const item of items) {
      room(14)
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...teal).text('•', margin + 2, y)
      paragraph(item, ink, 14)
      y += 2
    }
    y += 8
  }

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...teal).text('Relatório do atendimento • Isa', margin, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...muted)
  doc.text(`Gerado em ${dateTimeFormat.format(new Date(report.generatedAt))}`, width - margin, y, { align: 'right' })
  y += 16
  doc.text(`Período de ${shortDate(report.from)} a ${shortDate(report.to)} • site e WhatsApp`, margin, y)
  y += 10
  doc.setDrawColor(22, 136, 147).setLineWidth(2).line(margin, y, width - margin, y)
  y += 16

  const t = report.totals
  const cards: [string, number, readonly number[]][] = [
    ['Atendimentos', t.conversations, ink], ['WhatsApp', t.whatsApp, ink], ['Chat do site', t.site, ink], ['Com ajuda da equipe', t.handledByTeam, ink],
    ['Mensagens de clientes', t.customerMessages, ink], ['Respostas da Isa', t.isaMessages, ink], ['Respostas da equipe', t.staffMessages, ink],
    ['Isa pediu ajuda', t.needsAttention, t.needsAttention ? red : ink],
  ]
  const gap = 8
  const boxWidth = (inner - gap * 3) / 4
  cards.forEach(([label, value, color], index) => {
    const x = margin + (index % 4) * (boxWidth + gap)
    const top = y + Math.floor(index / 4) * 54
    doc.setDrawColor(231, 230, 226).setLineWidth(1).roundedRect(x, top, boxWidth, 46, 5, 5, 'S')
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...muted).text(label, x + 9, top + 16)
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(color[0], color[1], color[2]).text(String(value), x + 9, top + 36)
  })
  y += 120

  const score = report.analysis.score == null ? '—' : report.analysis.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const reason = doc.setFontSize(10).splitTextToSize(report.analysis.scoreReason || '', inner - 90) as string[]
  const scoreHeight = Math.max(52, 30 + reason.length * 13)
  doc.setFillColor(241, 239, 253).roundedRect(margin, y, inner, scoreHeight, 8, 8, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(...purple).text(score, margin + 16, y + 34)
  doc.setFontSize(10.5).setTextColor(...ink).text('Nota geral do atendimento (0 a 10)', margin + 80, y + 20)
  doc.setFont('helvetica', 'normal').setFontSize(10).text(reason, margin + 80, y + 36)
  y += scoreHeight + 22

  title('Como está o atendimento')
  paragraph(report.analysis.summary)
  y += 10
  title('Pontos fortes'); bullets(report.analysis.strengths, 'Nada a destacar.')
  title('Problemas encontrados'); bullets(report.analysis.problems, 'Nenhum problema encontrado.')
  title('O que os clientes mais perguntam'); bullets(report.analysis.frequentQuestions, 'Sem assuntos repetidos.')
  title('Vendas que podem ter sido perdidas'); bullets(report.analysis.opportunities, 'Nenhuma no período.')
  title('Perguntas que a Isa não soube responder'); bullets(report.unanswered, 'Nenhuma no período.')
  title('Sugestões da Isa'); bullets(report.analysis.suggestions, 'Sem sugestões.')

  title('Em que etapa os atendimentos estão')
  const stages = Object.entries(report.stages).sort((a, b) => b[1] - a[1])
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ETAPA', 'ATENDIMENTOS']],
    body: stages.length ? stages.map(([stage, count]) => [stage, String(count)]) : [['Sem atendimentos.', '']],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 5, textColor: [...ink], lineColor: [240, 239, 235], lineWidth: { bottom: 0.6 } },
    headStyles: { fontSize: 7.5, textColor: [...muted], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(163, 168, 171)
    doc.text(`Pós Leve Poltronas • relatório feito pela Isa a partir das conversas do período • página ${page} de ${pages}`,
      width / 2, height - 24, { align: 'center' })
  }
  const now = new Date()
  const stamp = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`
  const name = `relatorio-atendimento-isa-${report.from}-a-${report.to}-${stamp}.pdf`
  doc.save(name)
  return name
}

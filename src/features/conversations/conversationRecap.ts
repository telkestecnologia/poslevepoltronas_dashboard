/**
 * Resumo do atendimento montado a partir das mensagens, para a equipe entender a conversa sem ler tudo.
 * Mesmo código no app e no dashboard (app: src/lib/conversation-recap.ts).
 */

type RecapMessage = { role: 'CUSTOMER' | 'AI' | 'STAFF'; content: string; createdAt: string; staffName?: string | null }
type RecapConversation = { stage?: string | null; needsAttention: boolean; lastCustomerMessage?: string | null; state: string }

export type ConversationRecap = {
  /** Frases curtas do que já aconteceu, na ordem. */
  facts: string[]
  /** O que falta acontecer. */
  next: string
  lastQuestion: string | null
  lastAnswer: { who: string; text: string } | null
}

const CITIES = ['Fortaleza', 'Caucaia', 'Maracanaú', 'Eusébio', 'Aquiraz', 'Maranguape', 'Pacatuba', 'Itaitinga', 'Horizonte',
  'Sobral', 'Tianguá', 'Ubajara', 'Viçosa do Ceará', 'São Benedito', 'Ibiapina', 'Guaraciaba do Norte', 'Carnaubal', 'Crateús',
  'Juazeiro do Norte', 'Crato', 'Barbalha']

const NEXT_BY_STAGE: Record<string, string> = {
  'Coletando dados da locação': 'A Isa está pedindo os dados que faltam (datas, CEP e endereço) para fazer o orçamento.',
  'Orçamento enviado': 'Esperar o cliente aceitar o orçamento.',
  'Resumo confirmado': 'O cliente confirmou os dados; falta o contrato.',
  'Contrato enviado': 'Esperar o cliente aceitar o contrato.',
  'Contrato aceito': 'Esperar o pagamento.',
  'Aguardando PIX': 'Esperar o pagamento do PIX.',
  'Aguardando pagamento': 'Esperar o pagamento.',
  'PIX em análise': 'Conferir o comprovante do PIX.',
  'Pagamento confirmado': 'Pago. Combinar a entrega.',
  'Aguardando entrega': 'Fazer a entrega da poltrona.',
  'Poltrona em uso': 'Poltrona com o cliente. Ajudar no que ele precisar.',
  'Aguardando retirada': 'Buscar a poltrona.',
  'Locação concluída': 'Locação concluída. Nada pendente.',
  'Reserva expirada': 'A reserva expirou. Ver se o cliente ainda quer alugar.',
  'Pedido cancelado': 'Pedido cancelado. Nada pendente.',
}

const has = (text: string, ...words: string[]) => words.some(word => text.includes(word))
const clip = (text: string, size = 160) => {
  const flat = text.replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim()
  return flat.length > size ? `${flat.slice(0, size - 1).trimEnd()}…` : flat
}

export function conversationRecap(conversation: RecapConversation, messages: RecapMessage[]): ConversationRecap {
  const customer = messages.filter(message => message.role === 'CUSTOMER' && message.content.trim())
  const team = messages.filter(message => message.role !== 'CUSTOMER' && message.content.trim())
  const customerText = customer.map(message => message.content).join('\n').toLowerCase()
  const allText = messages.map(message => message.content).join('\n')
  const facts: string[] = []

  // O que o cliente procura.
  const wants: string[] = []
  if (has(customerText, 'alug', 'locação', 'locacao', 'orçamento', 'orcamento', 'preço', 'preco', 'valor', 'quanto'))
    wants.push('quer alugar uma poltrona')
  if (has(customerText, 'problema', 'defeito', 'quebr', 'não funciona', 'nao funciona', 'reclama', 'parou'))
    wants.push('relatou um problema')
  if (has(customerText, 'comprovante', 'paguei', 'pagamento', 'pix', 'cartão', 'cartao', 'boleto'))
    wants.push('falou sobre pagamento')
  if (has(customerText, 'buscar', 'retirar', 'retirada', 'devolver', 'devolução'))
    wants.push('falou sobre a retirada')
  else if (has(customerText, 'entrega', 'entregar', 'chega', 'horário', 'horario'))
    wants.push('perguntou sobre a entrega')
  facts.push(wants.length ? `Cliente ${wants.join(', ')}.` : customer[0] ? `Cliente começou com: “${clip(customer[0].content, 90)}”` : 'Cliente ainda não escreveu.')

  // Para quem é.
  const surgery = customerText.match(/cirurgia ((?:de |no |na |do |da )?[a-zà-ú]+)/)
  if (surgery) facts.push(`Para pós-operatório (cirurgia ${surgery[1]}).`)
  else if (has(customerText, 'cirurgia', 'operad', 'pós-operat', 'pos-operat', 'pos operat')) facts.push('Para pós-operatório.')
  else if (has(customerText, 'idos', 'minha mãe', 'minha mae', 'meu pai', 'avó', 'avô', 'vovó', 'vovô')) facts.push('Para uma pessoa idosa da família.')

  // Período, local e valor citados na conversa.
  const dates = messages.flatMap(message => [...message.content.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)].map(match => {
    const day = Number(match[1])
    const month = Number(match[2])
    if (day < 1 || day > 31 || month < 1 || month > 12) return null
    const sent = new Date(message.createdAt)
    let year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : sent.getFullYear()
    // Sem ano: um mês bem antes do mês da mensagem é do ano seguinte (ex.: "10/01" escrito em dezembro).
    if (!match[3] && month < sent.getMonth() + 1 - 6) year += 1
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  })).filter((date): date is string => date !== null)
  const days = customerText.match(/(\d{1,3})\s*dias/)
  if (dates.length >= 2) facts.push(`Período: ${dates[dates.length - 2]} a ${dates[dates.length - 1]}.`)
  else if (dates.length === 1) facts.push(`Data citada: ${dates[0]}${days ? `, por ${days[1]} dias` : ''}.`)
  else if (days) facts.push(`Por ${days[1]} dias.`)
  const cep = allText.match(/\b\d{5}-?\d{3}\b/)
  const city = CITIES.find(name => allText.toLowerCase().includes(name.toLowerCase()))
  if (city || cep) facts.push(`Local: ${[city, cep ? `CEP ${cep[0]}` : null].filter(Boolean).join(', ')}.`)
  const prices = team.flatMap(message => [...message.content.matchAll(/R\$\s?([\d.]+,\d{2})/g)].map(match => match[1]))
  if (prices.length) facts.push(`Valor informado: R$ ${prices[prices.length - 1]}.`)

  // Etapas que a própria Isa deixa na conversa.
  const teamText = team.map(message => message.content).join('\n').toLowerCase()
  if (has(teamText, 'pagamento confirmado', 'pagamento foi confirmado', 'recebemos o pagamento')) facts.push('Pagamento confirmado.')
  else if (has(teamText, 'copia e cola', 'chave pix', 'código pix', 'codigo pix')) facts.push('PIX enviado ao cliente.')
  else if (has(teamText, 'link de pagamento', 'pagar com cartão', 'pagar no cartão')) facts.push('Link de pagamento enviado.')
  const staff = [...new Set(team.filter(message => message.role === 'STAFF').map(message => message.staffName || 'Equipe'))]
  if (staff.length) facts.push(`A equipe já respondeu (${staff.join(', ')}).`)

  const lastCustomer = customer[customer.length - 1]
  const lastTeam = team[team.length - 1]
  const next = conversation.needsAttention
    ? 'Responder o cliente: a Isa não soube responder a última pergunta.'
    : lastCustomer && (!lastTeam || lastCustomer.createdAt > lastTeam.createdAt)
      ? 'O cliente escreveu por último e está esperando resposta.'
      : NEXT_BY_STAGE[conversation.stage ?? ''] ?? 'Esperar o cliente responder.'

  return {
    facts,
    next,
    lastQuestion: lastCustomer ? clip(conversation.needsAttention && conversation.lastCustomerMessage ? conversation.lastCustomerMessage : lastCustomer.content) : null,
    lastAnswer: lastTeam ? { who: lastTeam.role === 'AI' ? 'Isa' : lastTeam.staffName || 'Equipe', text: clip(lastTeam.content) } : null,
  }
}

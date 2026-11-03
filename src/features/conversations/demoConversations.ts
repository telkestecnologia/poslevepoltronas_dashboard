// Conversas fictícias para mostrar como será acompanhar a Isa. Nada aqui vem de clientes reais
// nem é enviado a eles; as mudanças ficam só na memória enquanto a página está aberta.
export type DemoMessage = { id: string; role: 'CUSTOMER' | 'ISA' | 'TEAM'; text: string; at: string; author?: string }
export type DemoConversation = {
  id: string; customer: string; phone: string | null; channel: 'WHATSAPP' | 'SITE'; state: 'AI' | 'HUMAN'
  needsHelp: boolean; assignee?: string; messages: DemoMessage[]
}

/** Equipe de teste: quem responde os clientes quando a Isa precisa de ajuda. */
export const teamMembers = ['Isadora Ivo', 'Renan Beco', 'Renata Ivo'] as const
export type TeamMember = (typeof teamMembers)[number]
export const memberColors: Record<string, string> = { 'Isadora Ivo': '#027eb5', 'Renan Beco': '#c4532c', 'Renata Ivo': '#8b3fb5' }

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export function seedConversations(): DemoConversation[] {
  return [
    {
      id: 'demo-1', customer: 'Maria Oliveira', phone: '85988123456', channel: 'WHATSAPP', state: 'AI', needsHelp: true,
      messages: [
        { id: 'm1', role: 'CUSTOMER', text: 'Boa tarde! Minha mãe vai operar o joelho na sexta. Vocês têm poltrona disponível?', at: minutesAgo(42) },
        { id: 'm2', role: 'ISA', text: 'Boa tarde, Maria! Sinto muito pela cirurgia da sua mãe, vamos ajudar. Para qual cidade seria a entrega?', at: minutesAgo(41) },
        { id: 'm3', role: 'CUSTOMER', text: 'Fortaleza, bairro Aldeota.', at: minutesAgo(39) },
        { id: 'm4', role: 'ISA', text: 'Temos poltronas disponíveis em Fortaleza. Por quantos dias vocês precisam?', at: minutesAgo(38) },
        { id: 'm5', role: 'CUSTOMER', text: 'Uns 20 dias. Vocês aceitam cartão de crédito parcelado?', at: minutesAgo(12) },
        { id: 'm6', role: 'ISA', text: 'Essa eu preciso confirmar com a equipe. Já chamei uma pessoa para te responder, tudo bem?', at: minutesAgo(11) },
      ],
    },
    {
      id: 'demo-2', customer: 'Visitante do site', phone: null, channel: 'SITE', state: 'AI', needsHelp: false,
      messages: [
        { id: 'm1', role: 'CUSTOMER', text: 'Qual o prazo mínimo de aluguel?', at: minutesAgo(95) },
        { id: 'm2', role: 'ISA', text: 'O aluguel mínimo é de 7 dias. Você pode simular o valor aqui mesmo no site, informando o CEP e as datas.', at: minutesAgo(94) },
        { id: 'm3', role: 'CUSTOMER', text: 'E a entrega já vem com instalação?', at: minutesAgo(90) },
        { id: 'm4', role: 'ISA', text: 'Sim! Nossa equipe entrega, posiciona a poltrona e mostra como usar os controles.', at: minutesAgo(89) },
      ],
    },
    {
      id: 'demo-3', customer: 'José Carlos', phone: '88999871234', channel: 'WHATSAPP', state: 'HUMAN', needsHelp: false, assignee: 'Renan Beco',
      messages: [
        { id: 'm1', role: 'CUSTOMER', text: 'A poltrona chegou mas o controle não está ligando.', at: minutesAgo(180) },
        { id: 'm2', role: 'ISA', text: 'Que pena, José! Vou passar para a equipe técnica resolver com você.', at: minutesAgo(179) },
        { id: 'm3', role: 'TEAM', author: 'Renan Beco', text: 'Oi, José! Aqui é o Renan, da Pós Leve. Confere, por favor, se o cabo está bem encaixado atrás da poltrona?', at: minutesAgo(170) },
        { id: 'm4', role: 'CUSTOMER', text: 'Era isso! Funcionou, obrigado.', at: minutesAgo(160) },
        { id: 'm5', role: 'TEAM', author: 'Isadora Ivo', text: 'Que bom, José! Qualquer coisa é só chamar. Boa recuperação!', at: minutesAgo(158) },
      ],
    },
    {
      id: 'demo-4', customer: 'Ana Beatriz', phone: '88981234567', channel: 'WHATSAPP', state: 'AI', needsHelp: false,
      messages: [
        { id: 'm1', role: 'CUSTOMER', text: 'Vocês atendem Tianguá?', at: minutesAgo(300) },
        { id: 'm2', role: 'ISA', text: 'Atendemos sim! Tianguá faz parte da nossa filial da Serra da Ibiapaba.', at: minutesAgo(299) },
      ],
    },
  ]
}

export function conversationState(item: DemoConversation) {
  if (item.state === 'HUMAN') return { label: `${item.assignee ?? 'Equipe'} atendendo`, tone: 'human' }
  if (item.needsHelp) return { label: 'Isa pediu ajuda', tone: 'help' }
  return { label: 'Isa respondendo', tone: 'ai' }
}
